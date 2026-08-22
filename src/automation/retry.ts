export async function retry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  delay = 2000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (i < attempts - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );
      }
    }
  }

  throw lastError;
}