import "server-only"

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }

  return "unknown"
}

export function checkRateLimit(key: string, options: { limit: number; windowMs: number }) {
  const now = Date.now()
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    const nextEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + options.windowMs,
    }
    store.set(key, nextEntry)
    return {
      allowed: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt: nextEntry.resetAt,
    }
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    }
  }

  current.count += 1
  store.set(key, current)

  return {
    allowed: true,
    remaining: Math.max(options.limit - current.count, 0),
    resetAt: current.resetAt,
  }
}
