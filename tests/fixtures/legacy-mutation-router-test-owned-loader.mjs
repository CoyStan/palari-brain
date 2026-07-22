// Test-only compatibility wrapper for the historical A2 instrumentation child.
// Production M2-B removes router.execute; this loader reconstructs that helper
// solely in the child process with a test-owned mutation coordinator.

const ROUTER_SUFFIX = '/src/legacy-mutation-router.mjs'
const WRAPPER_PREFIX = 'test-owned-legacy-router:'

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context)
  if (
    resolved.url.endsWith(ROUTER_SUFFIX) &&
    !resolved.url.includes('?test-owned-raw')
  ) {
    return {
      shortCircuit: true,
      url: `${WRAPPER_PREFIX}${encodeURIComponent(resolved.url)}`,
    }
  }
  return resolved
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith(WRAPPER_PREFIX)) return nextLoad(url, context)

  const rawUrl = decodeURIComponent(url.slice(WRAPPER_PREFIX.length))
  const rawSpecifier = `${rawUrl}?test-owned-raw`
  const coordinatorSpecifier = new URL(
    './mutation-coordinator.mjs',
    rawUrl,
  ).href
  return {
    format: 'module',
    shortCircuit: true,
    source: `
      export * from ${JSON.stringify(rawSpecifier)}
      import {
        createLegacyMutationRouter as createProductionLegacyMutationRouter,
      } from ${JSON.stringify(rawSpecifier)}
      import { createMutationCoordinator } from ${JSON.stringify(coordinatorSpecifier)}

      function mutableCopy(value) {
        if (Array.isArray(value)) {
          const result = []
          for (let index = 0; index < value.length; index += 1) {
            result.push(mutableCopy(value[index]))
          }
          return result
        }
        if (value !== null && typeof value === 'object') {
          const result = {}
          for (const key of Object.keys(value)) {
            result[key] = mutableCopy(value[key])
          }
          return result
        }
        return value
      }

      export function createLegacyMutationRouter(db, options = undefined) {
        const router = createProductionLegacyMutationRouter(db, options)
        const coordinator = createMutationCoordinator(db)
        return Object.freeze({
          apply: router.apply,
          capture: router.capture,
          execute(intent) {
            const captured = router.capture(intent)
            let result
            coordinator.run((lease) => {
              const plan = router.resolve(lease, captured)
              router.apply(lease, plan)
              result = mutableCopy(plan.result)
            })
            return result
          },
          resolve: router.resolve,
        })
      }
    `,
  }
}
