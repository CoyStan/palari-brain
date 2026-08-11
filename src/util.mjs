// Vendored from palari-v05 @ 190a4ad2f8d5187f5f21222048dd11efb2ad9991
//   apps/palari-local-workbench/scripts/workspace-backend/shared.mjs
//   (blob b47ebc15716f; booleanEnv line 15, slugify line 241)
// Copied verbatim so the kernel does not import the product shared module.
// Full extraction provenance remains at release tag v0.1.0-alpha.1.

export function booleanEnv(value) {
  return /^(1|true|yes)$/i.test(String(value ?? '').trim())
}

export function slugify(value, fallback) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || fallback
  )
}
