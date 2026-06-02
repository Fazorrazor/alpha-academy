// src/app/api/v1/subscriptions/initialize/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/firebase/auth-helper';
import { initializePaystackSubscription } from '@/lib/paystack';
import { apiError, handleRouteError } from '@/lib/errors';

const initializeSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate user session
    const profile = await requireSession();

    // 2. Validate input plan
    const body = await request.json();
    const result = initializeSchema.safeParse(body);

    if (!result.success) {
      return apiError(
        'BAD_REQUEST',
        'Invalid plan selected',
        result.error.issues.map((e) => e.message)
      );
    }

    const { plan } = result.data;

    // 3. Fetch plan code from environment
    const planCode =
      plan === 'monthly'
        ? (process.env.PAYSTACK_MONTHLY_PLAN_CODE || 'PLN_monthly_mock')
        : (process.env.PAYSTACK_ANNUAL_PLAN_CODE || 'PLN_annual_mock');

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscribe/callback`;

    // Paystack requires amount in subunits (e.g. 150 GHS -> 15000 pesewas, 1200 GHS -> 120000 pesewas)
    const amountInSubunits = plan === 'monthly' ? 15000 : 120000;

    // 4. Initialize Paystack checkout
    const checkoutData = await initializePaystackSubscription(
      profile.email || '',
      planCode,
      callbackUrl,
      amountInSubunits,
      { uid: profile.uid, plan }
    );

    return NextResponse.json({
      status: 'success',
      authorizationUrl: checkoutData.authorization_url,
      reference: checkoutData.reference,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
