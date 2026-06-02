// src/app/api/v1/subscriptions/verify/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireSession } from '@/lib/firebase/auth-helper';
import { apiError, handleRouteError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    // 1. Ensure user is authenticated
    const profile = await requireSession();
    
    // 2. Parse request parameters
    const body = await request.json();
    const { reference, plan } = body;

    if (!reference) {
      return apiError('BAD_REQUEST', 'Missing payment reference');
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const isMock = !secretKey || secretKey.startsWith('sk_test_mock') || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

    // 3. In Mock local development/emulator mode
    if (isMock) {
      console.log(`[MOCK CHECKOUT] Simulating Paystack webhook for reference: ${reference}`);
      const payload = {
        event: 'charge.success',
        data: {
          reference,
          amount: plan === 'annual' ? 50000 : 5000, // 500.00 GHS vs 50.00 GHS in subunits
          currency: 'GHS',
          metadata: {
            uid: profile.uid,
            plan: plan || 'monthly',
          },
          customer: {
            email: profile.email || 'mock@example.com',
            customer_code: 'CUS_mock_123',
          },
          subscription: {
            subscription_code: `SUB_mock_${Math.random().toString(36).substring(7)}`,
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');

      const webhookUrl = `${
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }/api/v1/subscriptions/webhook`;

      // Call our own webhook route with computed mock signature
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': signature,
        },
        body: rawBody,
      });

      if (!response.ok) {
        throw new Error('Local webhook simulation failed');
      }

      const result = await response.json();
      return NextResponse.json({
        status: 'success',
        mockTriggered: true,
        webhookResponse: result,
      });
    }

    // 4. In Production Mode: Query Paystack Verification endpoint
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Failed to verify transaction with Paystack');
    }

    // If successful, trigger our webhook logic immediately to activate profile without waiting
    if (data.data.status === 'success') {
      const payload = {
        event: 'charge.success',
        data: data.data,
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');

      const webhookUrl = `${
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }/api/v1/subscriptions/webhook`;

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': signature,
        },
        body: rawBody,
      });
    }

    return NextResponse.json({
      status: 'success',
      data: data.data,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
