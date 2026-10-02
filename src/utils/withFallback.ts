export interface FallbackResult<T> {
  value: T
  usedFallback: boolean
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<FallbackResult<T>> {
  try {
    return { value: await primary(), usedFallback: false }
  } catch (primaryError) {
    if (!fallback) throw primaryError

    try {
      return { value: await fallback(), usedFallback: true }
    } catch (fallbackError) {
      throw new AggregateError(
        [primaryError, fallbackError],
        'Both primary and fallback operations failed'
      )
    }
  }
}
