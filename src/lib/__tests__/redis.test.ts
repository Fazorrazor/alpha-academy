import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRedisCall } from '../redis';

// Mock Upstash Redis client
vi.mock('@upstash/redis', () => {
  class MockRedis {
    ping() {
      return Promise.resolve('PONG');
    }
    get() {
      return Promise.resolve('value');
    }
  }
  return {
    Redis: MockRedis,
  };
});

describe('redis library', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it('should return fallback if env variables are missing', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const res = await safeRedisCall(async (redis) => {
      return await redis.get('key');
    }, 'fallback-val');
    expect(res).toBe('fallback-val');
  });

  it('should successfully run function if Redis is initialized', async () => {
    const res = await safeRedisCall(async (redis) => {
      return await redis.get('key');
    }, 'fallback-val');
    expect(res).toBe('value');
  });

  it('should return fallback if Redis call throws an error', async () => {
    const res = await safeRedisCall(async () => {
      throw new Error('Redis connection failure');
    }, 'fallback-val');
    expect(res).toBe('fallback-val');
  });
});
