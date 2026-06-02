// src/lib/leaderboard.ts
import { safeRedisCall } from './redis';

/**
 * Invalidates the leaderboard top 50 cache key in Redis.
 * Called whenever a student's totalPoints or coursesCompleted changes.
 */
export async function invalidateLeaderboardCache(): Promise<void> {
  await safeRedisCall(async (redis) => {
    await redis.del('leaderboard:top50:v1');
  }, null);
}
