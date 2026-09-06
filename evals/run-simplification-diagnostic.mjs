import { runSimplificationDiagnostic } from './simplification-diagnostic.mjs'
process.stdout.write(`${JSON.stringify(await runSimplificationDiagnostic(), null, 2)}\n`)
