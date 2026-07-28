use anyhow::{Context, Result, bail};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use jcode_base::memory::{MemoryCategory, MemoryEntry, MemoryManager, MemoryScope, TrustLevel};
use jcode_base::memory_rerank::rerank_candidates_consensus;
use jcode_base::sidecar::Sidecar;
use jcode_message_types::{Message, StreamEvent, ToolDefinition};
use jcode_provider_core::{EventStream, Provider};
use jcode_provider_gemini_runtime::GeminiProvider;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const JCODE_COMMIT: &str = "c7f487309ad693c61a6b3268132ff2cb2813fced";
const GEMINI_MODEL: &str = "gemini-2.5-flash-lite";
const EMBEDDING_MODEL: &str = "text-embedding-3-small";
const GEMINI_INPUT_USD_PER_MILLION: f64 = 0.10;
const GEMINI_OUTPUT_USD_PER_MILLION: f64 = 0.40;
const GEMINI_MAX_OUTPUT_TOKENS: u64 = 65_536;
const EMBEDDING_USD_PER_MILLION: f64 = 0.02;
const DEFAULT_CAP_USD: f64 = 1.0;

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
enum Command {
    Smoke,
    Ingest {
        event_at: String,
        scope: String,
        turn: Turn,
    },
    Forget {
        containing: String,
        #[serde(rename = "scope")]
        _scope: String,
    },
    Retrieve {
        question: String,
        #[serde(rename = "scope")]
        _scope: String,
    },
}

#[derive(Debug, Deserialize, Serialize)]
struct Turn {
    id: String,
    #[serde(default)]
    user: String,
    #[serde(default)]
    assistant: String,
    #[serde(default, rename = "sourceTexts")]
    source_texts: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct TranscriptRow {
    event_at: String,
    origin: String,
    scope: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    speaker: Option<String>,
    text: String,
    turn_id: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
struct MeterState {
    accounted_usd: f64,
    gemini_calls: u64,
    gemini_input_tokens: u64,
    gemini_output_tokens: u64,
    measured_usd: f64,
    openai_embedding_calls: u64,
    openai_embedding_tokens: u64,
    uncertain_usd: f64,
    #[serde(default)]
    model_versions: BTreeSet<String>,
}

struct Meter {
    cap_usd: f64,
    path: PathBuf,
    transcript_path: PathBuf,
    state: MeterState,
    pending_gemini: f64,
}

impl Meter {
    fn load(artifact_dir: &Path) -> Result<Self> {
        fs::create_dir_all(artifact_dir)?;
        let path = artifact_dir.join("jcode-meter.json");
        let state = if path.exists() {
            serde_json::from_slice(&fs::read(&path)?).context("parse existing jcode meter")?
        } else {
            MeterState::default()
        };
        let cap_usd = std::env::var("PALARI_TRUST_SPEND_CAP_USD")
            .ok()
            .and_then(|value| value.parse::<f64>().ok())
            .unwrap_or(DEFAULT_CAP_USD);
        if !(cap_usd > 0.0 && cap_usd <= DEFAULT_CAP_USD) {
            bail!("jcode trust adapter cap must be in (0, 1.00]");
        }
        Ok(Self {
            cap_usd,
            path,
            transcript_path: artifact_dir.join("jcode-provider.jsonl"),
            state,
            pending_gemini: 0.0,
        })
    }

    fn save(&self) -> Result<()> {
        let bytes = serde_json::to_vec_pretty(&self.state)?;
        let temporary = self.path.with_extension("json.tmp");
        fs::write(&temporary, bytes)?;
        fs::rename(temporary, &self.path)?;
        Ok(())
    }

    fn append_transcript(&self, record: &Value) -> Result<()> {
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.transcript_path)?;
        serde_json::to_writer(&mut file, record)?;
        file.write_all(b"\n")?;
        Ok(())
    }

    fn reserve_gemini(&mut self, input_upper_tokens: u64) -> Result<f64> {
        let reservation = input_upper_tokens as f64 / 1_000_000.0 * GEMINI_INPUT_USD_PER_MILLION
            + GEMINI_MAX_OUTPUT_TOKENS as f64 / 1_000_000.0 * GEMINI_OUTPUT_USD_PER_MILLION;
        if self.state.accounted_usd + self.pending_gemini + reservation > self.cap_usd + 1e-12 {
            bail!(
                "JCODE_TRUST_SPEND_CAP: next Gemini request could exceed ${:.2}",
                self.cap_usd
            );
        }
        self.pending_gemini += reservation;
        Ok(reservation)
    }

    fn settle_gemini(
        &mut self,
        reservation: f64,
        input_tokens: Option<u64>,
        output_tokens: Option<u64>,
    ) -> Result<()> {
        self.pending_gemini = (self.pending_gemini - reservation).max(0.0);
        self.state.gemini_calls += 1;
        if let (Some(input), Some(output)) = (input_tokens, output_tokens) {
            let cost = input as f64 / 1_000_000.0 * GEMINI_INPUT_USD_PER_MILLION
                + output as f64 / 1_000_000.0 * GEMINI_OUTPUT_USD_PER_MILLION;
            self.state.gemini_input_tokens += input;
            self.state.gemini_output_tokens += output;
            self.state.measured_usd += cost;
            self.state.accounted_usd += cost;
        } else {
            self.state.uncertain_usd += reservation;
            self.state.accounted_usd += reservation;
        }
        self.save()
    }

    fn charge_embedding(&mut self, tokens: u64) -> Result<()> {
        let cost = tokens as f64 / 1_000_000.0 * EMBEDDING_USD_PER_MILLION;
        if self.state.accounted_usd + self.pending_gemini + cost > self.cap_usd + 1e-12 {
            bail!(
                "JCODE_TRUST_SPEND_CAP: next embedding request could exceed ${:.2}",
                self.cap_usd
            );
        }
        self.state.openai_embedding_calls += 1;
        self.state.openai_embedding_tokens += tokens;
        self.state.measured_usd += cost;
        self.state.accounted_usd += cost;
        self.save()
    }
}

#[derive(Clone)]
struct MeteredGemini {
    inner: Arc<GeminiProvider>,
    meter: Arc<Mutex<Meter>>,
}

impl MeteredGemini {
    fn new(inner: GeminiProvider, meter: Arc<Mutex<Meter>>) -> Self {
        Self {
            inner: Arc::new(inner),
            meter,
        }
    }
}

#[async_trait]
impl Provider for MeteredGemini {
    async fn complete(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        resume_session_id: Option<&str>,
    ) -> Result<EventStream> {
        let input_upper_tokens = system.len() as u64
            + messages
                .iter()
                .map(|message| format!("{message:?}").len() as u64)
                .sum::<u64>();
        let reservation = self
            .meter
            .lock()
            .map_err(|_| anyhow::anyhow!("jcode meter mutex poisoned"))?
            .reserve_gemini(input_upper_tokens)?;
        let inner_stream = match self
            .inner
            .complete(messages, tools, system, resume_session_id)
            .await
        {
            Ok(value) => value,
            Err(error) => {
                self.meter
                    .lock()
                    .map_err(|_| anyhow::anyhow!("jcode meter mutex poisoned"))?
                    .settle_gemini(reservation, None, None)?;
                return Err(error);
            }
        };
        let meter = Arc::clone(&self.meter);
        let state = Arc::new(Mutex::new((String::new(), None::<u64>, None::<u64>, false)));
        let state_for_stream = Arc::clone(&state);
        let mapped = inner_stream.then(move |event| {
            let meter = Arc::clone(&meter);
            let state = Arc::clone(&state_for_stream);
            async move {
                let mut settle = false;
                {
                    let mut observed = state
                        .lock()
                        .map_err(|_| anyhow::anyhow!("jcode response mutex poisoned"))?;
                    match &event {
                        Ok(StreamEvent::TextDelta(delta)) => observed.0.push_str(delta),
                        Ok(StreamEvent::TokenUsage {
                            input_tokens,
                            output_tokens,
                            ..
                        }) => {
                            observed.1 = *input_tokens;
                            observed.2 = *output_tokens;
                        }
                        Ok(StreamEvent::MessageEnd { .. }) | Err(_) => {
                            if !observed.3 {
                                observed.3 = true;
                                settle = true;
                            }
                        }
                        _ => {}
                    }
                }
                if settle {
                    let (text, input_tokens, output_tokens, _) = state
                        .lock()
                        .map_err(|_| anyhow::anyhow!("jcode response mutex poisoned"))?
                        .clone();
                    let mut meter = meter
                        .lock()
                        .map_err(|_| anyhow::anyhow!("jcode meter mutex poisoned"))?;
                    meter.append_transcript(&json!({
                        "framework": "jcode",
                        "model": GEMINI_MODEL,
                        "responseText": text,
                        "usage": {
                            "inputTokens": input_tokens,
                            "outputTokens": output_tokens,
                        },
                    }))?;
                    meter.settle_gemini(reservation, input_tokens, output_tokens)?;
                }
                event
            }
        });
        Ok(Box::pin(mapped))
    }

    fn name(&self) -> &str {
        self.inner.name()
    }

    fn model(&self) -> String {
        self.inner.model()
    }

    fn set_model(&self, model: &str) -> Result<()> {
        self.inner.set_model(model)
    }

    fn supports_image_input(&self) -> bool {
        self.inner.supports_image_input()
    }

    fn fork(&self) -> Arc<dyn Provider> {
        Arc::new(self.clone())
    }
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingDatum>,
    model: Option<String>,
    usage: Option<EmbeddingUsage>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingDatum {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Debug, Deserialize)]
struct EmbeddingUsage {
    total_tokens: u64,
}

async fn embed(
    input: &[String],
    openai_api_key: &str,
    meter: &Arc<Mutex<Meter>>,
) -> Result<Vec<Vec<f32>>> {
    if input.is_empty() {
        return Ok(Vec::new());
    }
    let upper_tokens = input.iter().map(|text| text.len() as u64).sum::<u64>();
    {
        let meter = meter
            .lock()
            .map_err(|_| anyhow::anyhow!("jcode meter mutex poisoned"))?;
        let upper_cost = upper_tokens as f64 / 1_000_000.0 * EMBEDDING_USD_PER_MILLION;
        if meter.state.accounted_usd + meter.pending_gemini + upper_cost > meter.cap_usd + 1e-12 {
            bail!("JCODE_TRUST_SPEND_CAP: embedding request would exceed cap");
        }
    }
    let response = reqwest::Client::new()
        .post("https://api.openai.com/v1/embeddings")
        .bearer_auth(openai_api_key)
        .json(&json!({
            "input": input,
            "model": EMBEDDING_MODEL,
        }))
        .send()
        .await
        .context("jcode embedding transport failed")?;
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        bail!("jcode embedding provider rejected request ({status})");
    }
    let mut parsed: EmbeddingResponse =
        serde_json::from_str(&body).context("parse jcode embedding response")?;
    parsed.data.sort_by_key(|entry| entry.index);
    let tokens = parsed
        .usage
        .as_ref()
        .map(|usage| usage.total_tokens)
        .unwrap_or(upper_tokens);
    {
        let mut meter = meter
            .lock()
            .map_err(|_| anyhow::anyhow!("jcode meter mutex poisoned"))?;
        meter.charge_embedding(tokens)?;
        meter.append_transcript(&json!({
            "framework": "jcode",
            "model": parsed.model.unwrap_or_else(|| EMBEDDING_MODEL.to_string()),
            "operation": "embedding",
            "usage": { "totalTokens": tokens },
        }))?;
    }
    Ok(parsed
        .data
        .into_iter()
        .map(|entry| entry.embedding)
        .collect())
}

fn transcript_path() -> Result<PathBuf> {
    let root = std::env::var("JCODE_HOME").context("JCODE_HOME missing")?;
    Ok(PathBuf::from(root).join("trust-transcript.json"))
}

fn load_transcript() -> Result<Vec<TranscriptRow>> {
    let path = transcript_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    serde_json::from_slice(&fs::read(path)?).context("parse jcode transcript")
}

fn save_transcript(rows: &[TranscriptRow]) -> Result<()> {
    let path = transcript_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(rows)?)?;
    Ok(())
}

fn project_dir() -> Result<PathBuf> {
    let root = std::env::var("JCODE_HOME").context("JCODE_HOME missing")?;
    let path = PathBuf::from(root).join("trust-project");
    fs::create_dir_all(&path)?;
    Ok(path)
}

fn extraction_transcript(turn: &Turn) -> String {
    let mut parts = Vec::new();
    for source in &turn.source_texts {
        parts.push(format!("Tool Result:\n{source}"));
    }
    if !turn.user.trim().is_empty() {
        parts.push(format!("User:\n{}", turn.user));
    }
    if !turn.assistant.trim().is_empty() {
        parts.push(format!("Assistant:\n{}", turn.assistant));
    }
    parts.join("\n\n")
}

fn append_turn_rows(rows: &mut Vec<TranscriptRow>, event_at: &str, scope: &str, turn: &Turn) {
    for source in &turn.source_texts {
        rows.push(TranscriptRow {
            event_at: event_at.to_string(),
            origin: "source".to_string(),
            scope: scope.to_string(),
            speaker: None,
            text: source.clone(),
            turn_id: turn.id.clone(),
        });
    }
    if !turn.user.trim().is_empty() {
        rows.push(TranscriptRow {
            event_at: event_at.to_string(),
            origin: "transcript".to_string(),
            scope: scope.to_string(),
            speaker: Some("user".to_string()),
            text: turn.user.clone(),
            turn_id: turn.id.clone(),
        });
    }
    if !turn.assistant.trim().is_empty() {
        rows.push(TranscriptRow {
            event_at: event_at.to_string(),
            origin: "transcript".to_string(),
            scope: scope.to_string(),
            speaker: Some("assistant".to_string()),
            text: turn.assistant.clone(),
            turn_id: turn.id.clone(),
        });
    }
}

fn category(value: &str) -> MemoryCategory {
    match value {
        "preference" => MemoryCategory::Preference,
        "correction" => MemoryCategory::Correction,
        "entity" => MemoryCategory::Entity,
        _ => MemoryCategory::Fact,
    }
}

fn trust(value: &str) -> TrustLevel {
    match value {
        "high" => TrustLevel::High,
        "low" => TrustLevel::Low,
        _ => TrustLevel::Medium,
    }
}

fn query_terms(question: &str) -> Vec<String> {
    const STOP: &[&str] = &[
        "a", "an", "and", "does", "has", "is", "of", "the", "to", "user", "what", "where",
    ];
    question
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
        .filter(|term| term.len() >= 2 && !STOP.contains(&term.as_str()))
        .collect()
}

fn transcript_hits(rows: &[TranscriptRow], question: &str) -> Vec<Value> {
    let terms = query_terms(question);
    if terms.is_empty() {
        return Vec::new();
    }
    rows.iter()
        .filter(|row| {
            let text = row.text.to_lowercase();
            terms.iter().all(|term| text.contains(term))
        })
        .map(|row| {
            json!({
                "observedAt": row.event_at,
                "origin": row.origin,
                "speaker": row.speaker,
                "superseded": false,
                "text": row.text,
            })
        })
        .collect()
}

async fn run(command: Command) -> Result<Value> {
    let artifact_dir =
        std::env::var("PALARI_TRUST_ARTIFACT_DIR").context("PALARI_TRUST_ARTIFACT_DIR missing")?;
    let openai_api_key = std::env::var("PALARI_JCODE_OPENAI_API_KEY")
        .context("PALARI_JCODE_OPENAI_API_KEY missing")?;
    if std::env::var("GEMINI_API_KEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .is_none()
    {
        bail!("GEMINI_API_KEY missing");
    }
    let meter = Arc::new(Mutex::new(Meter::load(Path::new(&artifact_dir))?));
    let provider = GeminiProvider::new();
    provider.set_model(GEMINI_MODEL)?;
    jcode_base::provider::set_active_provider(Arc::new(MeteredGemini::new(
        provider,
        Arc::clone(&meter),
    )));

    // OPENAI_API_KEY is deliberately absent from the child environment while
    // Sidecar selects its backend, otherwise jcode prefers OpenAI over the
    // registered live Gemini provider. The key is used only by the explicit
    // embedding call below and never written to process-global jcode config.
    let sidecar = Sidecar::new();
    if sidecar.backend_name() != "provider" || sidecar.model_name() != GEMINI_MODEL {
        bail!(
            "jcode sidecar selected unexpected backend/model: {}/{}",
            sidecar.backend_name(),
            sidecar.model_name()
        );
    }
    let manager = MemoryManager::new()
        .with_project_dir(project_dir()?)
        .with_skills(false);

    match command {
        Command::Smoke => {
            let extracted = sidecar
                .extract_memories(
                    "User:\nIn this throwaway project, always run cargo fmt before tests.",
                )
                .await?;
            if let Some(first) = extracted.first() {
                let vectors = embed(
                    std::slice::from_ref(&first.content),
                    &openai_api_key,
                    &meter,
                )
                .await?;
                if vectors.first().map(Vec::len) != Some(1536) {
                    bail!("jcode connectivity embedding had unexpected dimension");
                }
            } else {
                bail!("jcode connectivity extraction returned no memory");
            }
            Ok(json!({
                "framework": "jcode",
                "model": GEMINI_MODEL,
                "ok": true,
            }))
        }
        Command::Ingest {
            event_at,
            scope,
            turn,
        } => {
            let existing = manager
                .list_all()
                .unwrap_or_default()
                .into_iter()
                .filter(|entry| entry.active)
                .map(|entry| entry.content)
                .collect::<Vec<_>>();
            let extracted = sidecar
                .extract_memories_with_existing(&extraction_transcript(&turn), &existing)
                .await?;
            let contents = extracted
                .iter()
                .map(|memory| memory.content.clone())
                .collect::<Vec<_>>();
            let embeddings = embed(&contents, &openai_api_key, &meter).await?;
            let observed_at: DateTime<Utc> = event_at.parse()?;
            for (memory, vector) in extracted.iter().zip(embeddings) {
                let mut entry =
                    MemoryEntry::new(category(&memory.category), memory.content.clone())
                        .with_source(turn.id.clone())
                        .with_trust(trust(&memory.trust));
                entry.created_at = observed_at;
                entry.updated_at = observed_at;
                entry.set_embedding(Some(vector), Some(format!("openai:{EMBEDDING_MODEL}")));
                manager.remember_project(entry)?;
            }
            let mut rows = load_transcript()?;
            append_turn_rows(&mut rows, &event_at, &scope, &turn);
            save_transcript(&rows)?;
            Ok(json!({ "stored": extracted.len() }))
        }
        Command::Forget {
            containing,
            _scope: _,
        } => {
            let needle = containing.to_lowercase();
            let ids = manager
                .list_all()?
                .into_iter()
                .filter(|entry| entry.content.to_lowercase().contains(&needle))
                .map(|entry| entry.id)
                .collect::<Vec<_>>();
            for id in &ids {
                manager.forget(id)?;
            }
            // jcode's memory forget removes graph entries, not source session
            // transcripts. The adapter intentionally leaves transcript rows.
            Ok(json!({ "forgotten": ids.len() }))
        }
        Command::Retrieve {
            question,
            _scope: _,
        } => {
            let query = embed(std::slice::from_ref(&question), &openai_api_key, &meter)
                .await?
                .pop()
                .context("jcode query embedding missing")?;
            let candidates =
                manager.find_similar_hybrid_scoped(&question, &query, 20, MemoryScope::Project)?;
            let memories = rerank_candidates_consensus(&sidecar, &question, candidates, 2, 2).await;
            let mut items = memories
                .into_iter()
                .map(|entry| {
                    json!({
                        "observedAt": entry.updated_at.to_rfc3339(),
                        "origin": "memory",
                        "speaker": Value::Null,
                        "superseded": !entry.active,
                        "text": entry.content,
                    })
                })
                .collect::<Vec<_>>();
            items.extend(transcript_hits(&load_transcript()?, &question));
            Ok(json!({ "items": items }))
        }
    }
}

#[tokio::main]
async fn main() {
    let result = (|| -> Result<Command> {
        let mut input = String::new();
        std::io::stdin().read_to_string(&mut input)?;
        serde_json::from_str(&input).context("parse jcode bridge command")
    })();
    let output = match result {
        Ok(command) => run(command).await.map(|value| {
            json!({
                "jcodeCommit": JCODE_COMMIT,
                "ok": true,
                "value": value,
            })
        }),
        Err(error) => Err(error),
    };
    match output {
        Ok(value) => println!("{}", value),
        Err(error) => {
            println!(
                "{}",
                json!({
                    "error": format!("{error:#}"),
                    "jcodeCommit": JCODE_COMMIT,
                    "ok": false,
                })
            );
            std::process::exit(1);
        }
    }
}
