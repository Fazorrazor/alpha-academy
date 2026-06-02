import { safeRedisCall } from './redis';

export async function checkRateLimit(
  uid: string,
  endpoint: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate:user:${uid}:${endpoint}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 60;

  return safeRedisCall(
    async (redis) => {
      const pipe = redis.pipeline();
      pipe.zremrangebyscore(key, 0, windowStart);
      pipe.zadd(key, { score: now, member: `${now}-${Math.random()}` });
      pipe.zcard(key);
      pipe.expire(key, 120);
      const results = await pipe.exec();
      const count = results[2] as number;
      return {
        allowed: count <= limitPerMinute,
        remaining: Math.max(0, limitPerMinute - count),
      };
    },
    { allowed: true, remaining: limitPerMinute }
  );
}
