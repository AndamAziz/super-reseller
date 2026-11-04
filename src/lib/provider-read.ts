/** Retry only transient read failures, never credential denials or permanent HTTP errors. */
export const providerTransientStatus = (status: number) => status === 0 || status === 429 || status >= 500;

export async function retryProviderRead<T>(read: (attempt: number) => Promise<T>, shouldRetry: (result: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await read(attempt);
      if (attempt === 0 && shouldRetry(result)) continue;
      return result;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error('Provider read unavailable');
}