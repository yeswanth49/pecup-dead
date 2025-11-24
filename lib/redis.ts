import Redis from 'ioredis'

const getRedisClient = () => {
  if (process.env.REDIS_URL) {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1, // Fail fast if connection is bad
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Redis] Connection failed, stopping retries. Caching will be disabled.')
          return null // Stop retrying
        }
        return Math.min(times * 50, 2000)
      }
    })

    client.on('error', (err) => {
      // Suppress unhandled error events
      console.error('[Redis] Client Error:', err.message)
    })

    return client
  }
  console.warn('[Redis] REDIS_URL not set, caching will be disabled')
  return null
}

export const redis = getRedisClient()

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (!redis) {
    return fetchFn()
  }

  try {
    const cached = await redis.get(key)
    if (cached) {
      try {
        const data = JSON.parse(cached) as T
        return data
      } catch (e) {
        console.error(`[Cache] Failed to parse cache for key ${key}`, e)
      }
    }
  } catch (e) {
    console.error(`[Cache] Redis get error for key ${key}`, e)
  }

  const data = await fetchFn()

  try {
    if (data) {
      await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
    }
  } catch (e) {
    console.error(`[Cache] Redis set error for key ${key}`, e)
  }

  return data
}
