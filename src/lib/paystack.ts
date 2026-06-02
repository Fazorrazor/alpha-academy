// src/lib/paystack.ts
import crypto from 'crypto';

export function verifyPaystackSignature(body: string, signature: string): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  if (!signature || !secretKey) return false;
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(body)
    .digest('hex');
  return hash === signature;
}

export interface InitializeResponse {
  authorization_url: string;
  reference: string;
  access_code: string;
}

export async function initializePaystackSubscription(
  email: string,
  planCode: string,
  callbackUrl: string,
  amount: number,
  metadata?: Record<string, unknown>
): Promise<InitializeResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const isMock = !secretKey || secretKey.startsWith('sk_test_mock') || process.env.MOCK_PAYSTACK === 'true';

  if (isMock) {
    const mockRef = `mock_ref_${Math.random().toString(36).substring(7)}`;
    const plan = metadata?.plan || 'monthly';
    return {
      authorization_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscribe/callback?reference=${mockRef}&plan=${plan}`,
      reference: mockRef,
      access_code: `mock_access_${Math.random().toString(36).substring(7)}`,
    };
  }

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      plan: planCode,
      callback_url: callbackUrl,
      metadata: metadata || {},
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to initialize Paystack transaction');
  }

  return data.data as InitializeResponse;
}

export async function cancelPaystackSubscription(
  subscriptionCode: string,
  emailToken: string
): Promise<boolean> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const isMock = !secretKey || secretKey.startsWith('sk_test_mock') || process.env.MOCK_PAYSTACK === 'true';

  if (isMock) {
    console.info(`[MOCK PAYSTACK] Cancelled subscription: ${subscriptionCode}`);
    return true;
  }

  const response = await fetch('https://api.paystack.co/subscription/disable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: subscriptionCode,
      token: emailToken,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Failed to cancel subscription');
  }

  return true;
}
