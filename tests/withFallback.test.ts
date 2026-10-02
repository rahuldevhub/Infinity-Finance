import assert from 'node:assert/strict'
import test from 'node:test'
import { withFallback } from '../src/utils/withFallback.js'

test('uses the primary operation when it succeeds', async () => {
  const result = await withFallback(async () => 'modern', async () => 'legacy')
  assert.deepEqual(result, { value: 'modern', usedFallback: false })
})

test('uses the fallback operation when the primary operation fails', async () => {
  const result = await withFallback(
    async () => { throw new Error('modern template failed') },
    async () => 'legacy'
  )
  assert.deepEqual(result, { value: 'legacy', usedFallback: true })
})

test('preserves both errors when primary and fallback operations fail', async () => {
  await assert.rejects(
    withFallback(
      async () => { throw new Error('modern template failed') },
      async () => { throw new Error('legacy template failed') }
    ),
    (error: unknown) => error instanceof AggregateError && error.errors.length === 2
  )
})
