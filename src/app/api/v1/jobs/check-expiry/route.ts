// src/app/api/v1/jobs/check-expiry/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';
import { firestore } from 'firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Verify Request Authorization header for Cron Secret
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || 'test_cron_secret';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = firestore.Timestamp.now();
    const nowMs = now.toMillis();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const processedExpired: string[] = [];
    const processed7Day: string[] = [];
    const processed1Day: string[] = [];

    // --- TASK 1: Handle Expired Memberships ---
    const expiredSnap = await adminDb
      .collection('profiles')
      .where('subscription', 'in', ['active', 'cancelled'])
      .where('subscriptionExpiresAt', '<', now)
      .get();

    for (const doc of expiredSnap.docs) {
      const profile = doc.data();
      const uid = doc.id;
      
      const batch = adminDb.batch();

      // Update profile status
      batch.update(doc.ref, {
        subscription: 'expired',
        updatedAt: now,
        remindersSent: firestore.FieldValue.arrayUnion('expired'),
      });

      // Write event log
      const eventRef = adminDb.collection('subscriptionEvents').doc();
      batch.set(eventRef, {
        uid,
        event: 'expired',
        timestamp: now,
      });

      // Create in-app notification
      const notifRef = adminDb.collection('notifications').doc();
      batch.set(notifRef, {
        uid,
        title: 'Membership Expired',
        body: 'Your Alpha Academy Premium subscription has expired. Renew anytime from your profile settings.',
        read: false,
        createdAt: now,
      });

      await batch.commit();

      // Trigger Email & SMS notifications (non-blocking)
      if (profile.email) {
        sendEmail({
          to: profile.email,
          subject: 'Your Alpha Academy Premium Subscription Has Expired',
          html: `<p>Dear ${profile.displayName || 'Scholar'},</p><p>Your Alpha Academy Premium subscription has expired. Renew today to get back to class, ask questions in lesson forums, and build your technical certifications portfolio.</p>`,
        }).catch((e) => console.error('Expiry email failed for', uid, e));
      }

      if (profile.phoneNumber) {
        sendSMS(
          profile.phoneNumber,
          `Your Alpha Academy Premium subscription has expired. Renew today at http://localhost:3000/settings`
        ).catch((e) => console.error('Expiry SMS failed for', uid, e));
      }

      processedExpired.push(uid);
    }

    // --- TASK 2: 7-Day Renewal/Expiration Reminders ---
    const sevenDaysOut = new firestore.Timestamp(now.seconds + 7 * 24 * 60 * 60, 0);
    const snap7Day = await adminDb
      .collection('profiles')
      .where('subscription', 'in', ['active', 'cancelled'])
      .where('subscriptionExpiresAt', '<=', sevenDaysOut)
      .get();

    for (const doc of snap7Day.docs) {
      const profile = doc.data();
      const uid = doc.id;
      const reminders = profile.remindersSent || [];

      // Check date is indeed within 7 days and reminder wasn't sent yet
      const expiresAt = profile.subscriptionExpiresAt;
      if (expiresAt && expiresAt.toMillis() > nowMs && !reminders.includes('7day')) {
        const isCancelled = profile.subscription === 'cancelled';
        
        await doc.ref.update({
          remindersSent: firestore.FieldValue.arrayUnion('7day'),
        });

        // Create in-app notification
        await adminDb.collection('notifications').add({
          uid,
          title: isCancelled ? 'Subscription Expiring Soon' : 'Subscription Renewing Soon',
          body: isCancelled 
            ? 'Your premium access expires in 7 days. Auto-renew is turned off.'
            : 'Your premium subscription auto-renews in 7 days.',
          read: false,
          createdAt: now,
        });

        if (profile.email) {
          sendEmail({
            to: profile.email,
            subject: isCancelled 
              ? 'Your Alpha Academy Premium Membership Expires in 7 Days' 
              : 'Your Alpha Academy Premium Subscription Renews in 7 Days',
            html: isCancelled
              ? `<p>Dear ${profile.displayName || 'Scholar'},</p><p>This is a reminder that your Premium access will expire in 7 days. If you want to keep learning, you can enable auto-renewal in your Settings page.</p>`
              : `<p>Dear ${profile.displayName || 'Scholar'},</p><p>Your Premium subscription is scheduled to auto-renew in 7 days. If you wish to make changes to your billing, you can manage renewal inside your Settings page.</p>`,
          }).catch((e) => console.error('7-day email failed for', uid, e));
        }

        if (profile.phoneNumber) {
          const smsMsg = isCancelled
            ? `Your Premium access expires in 7 days. Manage your plan options at http://localhost:3000/settings`
            : `Your Premium subscription auto-renews in 7 days. Manage settings at http://localhost:3000/settings`;
          sendSMS(profile.phoneNumber, smsMsg).catch((e) => console.error('7-day SMS failed for', uid, e));
        }

        processed7Day.push(uid);
      }
    }

    // --- TASK 3: 1-Day Renewal/Expiration Reminders ---
    const oneDayOut = new firestore.Timestamp(now.seconds + 24 * 60 * 60, 0);
    const snap1Day = await adminDb
      .collection('profiles')
      .where('subscription', 'in', ['active', 'cancelled'])
      .where('subscriptionExpiresAt', '<=', oneDayOut)
      .get();

    for (const doc of snap1Day.docs) {
      const profile = doc.data();
      const uid = doc.id;
      const reminders = profile.remindersSent || [];

      const expiresAt = profile.subscriptionExpiresAt;
      if (expiresAt && expiresAt.toMillis() > nowMs && !reminders.includes('1day')) {
        const isCancelled = profile.subscription === 'cancelled';

        await doc.ref.update({
          remindersSent: firestore.FieldValue.arrayUnion('1day'),
        });

        // Create in-app notification
        await adminDb.collection('notifications').add({
          uid,
          title: isCancelled ? 'Subscription Expires Tomorrow' : 'Subscription Renews Tomorrow',
          body: isCancelled
            ? 'Your premium access will expire tomorrow. Renew to prevent disruption.'
            : 'Your premium subscription auto-renews tomorrow.',
          read: false,
          createdAt: now,
        });

        if (profile.email) {
          sendEmail({
            to: profile.email,
            subject: isCancelled
              ? 'Your Alpha Academy Premium Membership Expires Tomorrow'
              : 'Your Alpha Academy Premium Subscription Renews Tomorrow',
            html: isCancelled
              ? `<p>Dear ${profile.displayName || 'Scholar'},</p><p>Your Premium subscription expires tomorrow. Renew now to avoid losing access to courses, discussions, and certificates.</p>`
              : `<p>Dear ${profile.displayName || 'Scholar'},</p><p>Your Premium subscription auto-renews tomorrow. No action is required to maintain your premium access.</p>`,
          }).catch((e) => console.error('1-day email failed for', uid, e));
        }

        if (profile.phoneNumber) {
          const smsMsg = isCancelled
            ? `Your Premium access expires tomorrow. Renew to prevent disruption: http://localhost:3000/settings`
            : `Your Premium subscription auto-renews tomorrow. Manage settings at http://localhost:3000/settings`;
          sendSMS(profile.phoneNumber, smsMsg).catch((e) => console.error('1-day SMS failed for', uid, e));
        }

        processed1Day.push(uid);
      }
    }

    return NextResponse.json({
      status: 'success',
      expiredCount: processedExpired.length,
      sevenDayCount: processed7Day.length,
      oneDayCount: processed1Day.length,
    });
  } catch (error) {
    console.error('Subscription cron job error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
