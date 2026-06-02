import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/v1/webhooks/mux
 *
 * Receives Mux webhook events. Handles:
 *   - video.asset.ready  → find lesson by muxUploadId, set muxAssetId + muxPlaybackId
 *   - video.asset.errored → mark lesson as errored for admin awareness
 *
 * Mux sends a Mux-Signature header we verify against MUX_WEBHOOK_SECRET (optional
 * but strongly recommended in production). In dev/emulator mode we skip it.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // ── Optional signature verification ──────────────────────────────────────
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== 'mock_mux_webhook_secret') {
      const signature = request.headers.get('mux-signature') ?? '';
      const { createHmac } = await import('crypto');

      // Mux signature format: "t=<timestamp>,v1=<hmac>"
      const parts = Object.fromEntries(
        signature.split(',').map((p) => p.split('=') as [string, string])
      );
      const timestamp = parts['t'];
      const expected = createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      if (parts['v1'] !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.type;
    const data = event.data;

    console.log(`[Mux Webhook] Received event: ${eventType}`);

    // ── video.asset.ready ─────────────────────────────────────────────────────
    if (eventType === 'video.asset.ready') {
      const muxAssetId: string = data.id;
      const uploadId: string = data.upload_id;
      const playbackId: string | undefined = data.playback_ids?.[0]?.id;

      if (!uploadId || !playbackId) {
        console.warn('[Mux Webhook] Missing uploadId or playbackId in payload', data);
        return NextResponse.json({ received: true });
      }

      // Find the lesson that has this muxUploadId stored
      // We query across all course sub-collections via a collection group query
      const snapshot = await adminDb
        .collectionGroup('lessons')
        .where('muxUploadId', '==', uploadId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.warn(`[Mux Webhook] No lesson found with muxUploadId: ${uploadId}`);
        return NextResponse.json({ received: true });
      }

      const lessonDoc = snapshot.docs[0];
      await lessonDoc.ref.update({
        muxAssetId,
        muxPlaybackId: playbackId,
        // Duration is in seconds from Mux, comes as a float
        durationSeconds: data.duration ? Math.round(data.duration) : null,
        updatedAt: new Date(),
      });

      console.log(`[Mux Webhook] Lesson ${lessonDoc.id} updated with playbackId: ${playbackId}`);
    }

    // ── video.asset.errored ───────────────────────────────────────────────────
    if (eventType === 'video.asset.errored') {
      const uploadId: string = data.upload_id;

      if (uploadId) {
        const snapshot = await adminDb
          .collectionGroup('lessons')
          .where('muxUploadId', '==', uploadId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const lessonDoc = snapshot.docs[0];
          await lessonDoc.ref.update({
            muxAssetId: null,
            muxPlaybackId: null,
            muxError: data.errors?.messages?.join(', ') ?? 'Unknown Mux error',
            updatedAt: new Date(),
          });
          console.error(`[Mux Webhook] Asset error for lesson ${lessonDoc.id}:`, data.errors);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Mux Webhook] Unhandled error:', error);
    // Always return 200 to Mux so it doesn't keep retrying on our bugs
    return NextResponse.json({ received: true });
  }
}
