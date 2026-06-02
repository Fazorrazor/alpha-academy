import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyPaystackSignature,
  initializePaystackSubscription,
  cancelPaystackSubscription,
} from '../paystack';

describe('paystack library', () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mockkey';
  });

  afterEach(() => {
    process.env.PAYSTACK_SECRET_KEY = originalKey;
  });

  it('should successfully verify signatures', () => {
    const body = '{"event":"charge.success"}';
    const signature = crypto
      .createHmac('sha512', 'sk_test_mockkey')
      .update(body)
      .digest('hex');
    expect(verifyPaystackSignature(body, signature)).toBe(true);
  });

  it('should fail on invalid signature', () => {
    const body = '{"event":"charge.success"}';
    expect(verifyPaystackSignature(body, 'invalid_sig')).toBe(false);
  });

  it('should return mock checkout url when using mock credentials', async () => {
    const res = await initializePaystackSubscription(
      'student@test.com',
      'PLN_monthly',
      'http://localhost:3000/callback',
      15000
    );
    expect(res.authorization_url).toContain('/subscribe/callback?reference=mock_ref_');
    expect(res.reference).toBeDefined();
    expect(res.access_code).toBeDefined();
  });

  it('should return success on mock cancellation', async () => {
    const res = await cancelPaystackSubscription('SUB_123', 'tok_123');
    expect(res).toBe(true);
  });
});
