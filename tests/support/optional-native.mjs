// usearch is an optional dependency; tests that need the native index skip without it.
export const usearchSkip = await import('usearch').then(
  () => false,
  () => 'optional usearch package is not installed',
)
