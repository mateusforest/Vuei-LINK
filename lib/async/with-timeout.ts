export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(message))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}
