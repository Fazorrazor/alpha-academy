// src/app/api/v1/subscriptions/webhook/route.ts
import { NextResponse } from 'next/server';
import { firestore } from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { verifyPaystackSignature } from '@/lib/paystack';
import { apiError, handleRouteError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    // 1. Read signature and raw body text
    const signature = request.headers.get('x-paystack-signature') || '';
    const rawBody = await request.text();

    // 2. Enforce HMAC verification before any Firestore write
    if (!verifyPaystackSignature(rawBody, signature)) {
      return apiError('UNAUTHORIZED', 'Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const data = payload.data;

    if (eventType === 'charge.success') {
      const reference = data.reference;
      if (!reference) {
        return apiError('BAD_REQUEST', 'Missing payment reference');
      }

      // 3. Prevent duplicate processing
      const eventRef = adminDb.collection('subscriptionEvents').doc(reference);
      const eventSnap = await eventRef.get();
      if (eventSnap.exists) {
        return NextResponse.json({ status: 'ignored', message: 'Duplicate event' });
      }

      // 4. Resolve user UID from metadata or fallback to email lookup
      const { uid, plan } = data.metadata || {};
      let userUid = uid;

      if (!userUid && data.customer?.email) {
        const profilesSnap = await adminDb
          .collection('profiles')
          .where('email', '==', data.customer.email)
          .limit(1)
          .get();
        if (!profilesSnap.empty) {
          userUid = profilesSnap.docs[0].id;
        }
      }

      // 5. Calculate subscription expiration date (monthly vs annual)
      const daysToAdd = plan === 'annual' ? 365 : 30;
      const expiresAtDate = new Date();
      expiresAtDate.setDate(expiresAtDate.getDate() + daysToAdd);
      const expiresAt = firestore.Timestamp.fromDate(expiresAtDate);

      // 6. Write log and update profile in a transaction/batch
      const batch = adminDb.batch();

      batch.set(eventRef, {
        id: reference,
        uid: userUid || 'unknown',
        paystackReference: reference,
        event: eventType,
        plan: plan || 'monthly',
        amount: data.amount || 0,
        currency: data.currency || 'GHS',
        status: 'success',
        createdAt: firestore.Timestamp.now(),
      });

      if (userUid) {
        const userRef = adminDb.collection('profiles').doc(userUid);
        batch.update(userRef, {
          subscription: 'active',
          subscriptionPlan: plan || 'monthly',
          subscriptionExpiresAt: expiresAt,
          paystackCustomerCode: data.customer?.customer_code || null,
          paystackSubscriptionCode: data.subscription?.subscription_code || null,
          updatedAt: firestore.Timestamp.now(),
        });
      }

      await batch.commit();
    } else if (eventType === 'subscription.disable') {
      const subscriptionCode = data.subscription_code;
      if (subscriptionCode) {
        const profilesSnap = await adminDb
          .collection('profiles')
          .where('paystackSubscriptionCode', '==', subscriptionCode)
          .limit(1)
          .get();

        if (!profilesSnap.empty) {
          const userRef = profilesSnap.docs[0].ref;
          await userRef.update({
            subscription: 'expired',
            updatedAt: firestore.Timestamp.now(),
          });
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return handleRouteError(error);
  }
}
