// src/lib/redis.ts
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function safeRedisCall<T>(
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const client = getRedis();
  if (!client) return fallback;
  try {
    return await fn(client);
  } catch (err) {
    console.warn('Redis call failed, using fallback:', err);
    return fallback;
  }
}
