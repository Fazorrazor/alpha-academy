import Mux from '@mux/mux-node';
import jwt from 'jsonwebtoken';

/**
 * src/lib/video.ts
 *
 * Mux client and helpers for:
 *   - Creating direct upload URLs (used by admin asset uploader)
 *   - Generating signed playback JWTs (15-minute expiry, used for student viewing)
 */

let _mux: Mux | null = null;

function getMuxClient(): Mux {
  if (_mux) return _mux;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (
    !tokenId || !tokenSecret ||
    tokenId === 'mock_mux_token_id' ||
    tokenSecret === 'mock_mux_token_secret'
  ) {
    // Return a dummy that won't be called in emulator mode
    return { video: { uploads: { create: async () => ({ url: 'mock://mux-upload' }) } } } as unknown as Mux;
  }

  _mux = new Mux({ tokenId, tokenSecret });
  return _mux;
}

/**
 * Create a Mux direct upload URL.
 * The admin browser uploads the video file directly to this URL.
 * Mux processes it and fires video.asset.ready webhook on completion.
 */
export async function createMuxUpload(): Promise<{
  uploadId: string;
  uploadUrl: string;
}> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
    new_asset_settings: {
      playback_policy: ['signed'],
      encoding_tier: 'smart',
    },
  });

  return {
    uploadId: upload.id,
    uploadUrl: upload.url ?? '',
  };
}

/**
 * Generate a signed Mux playback JWT.
 * Expiry: 15 minutes (900 seconds).
 * Must be passed as the ?token= query param to the Mux stream URL.
 *
 * In emulator/dev mode (no signing key), returns null so the player
 * can fall back to an unsigned test URL.
 */
export function generateMuxSignedToken(playbackId: string): string | null {
  const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
  const signingPrivateKey = process.env.MUX_SIGNING_PRIVATE_KEY;

  if (
    !signingKeyId || !signingPrivateKey ||
    signingKeyId === 'mock_mux_signing_key_id' ||
    signingPrivateKey === 'mock_mux_signing_private_key'
  ) {
    // In development, no signing key — return null and let the caller handle it
    return null;
  }

  // Mux expects the private key with real newlines
  const privateKey = signingPrivateKey.replace(/\\n/g, '\n');

  const payload = {
    sub: playbackId,
    aud: 'v',  // 'v' = video playback audience
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    kid: signingKeyId,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Build the HLS stream URL for a Mux playback ID.
 * If a signed token is provided, appends it as a query parameter.
 */
export function buildMuxStreamUrl(playbackId: string, token?: string | null): string {
  const base = `https://stream.mux.com/${playbackId}.m3u8`;
  return token ? `${base}?token=${token}` : base;
}

/**
 * Build the thumbnail URL for a Mux playback ID.
 */
export function buildMuxThumbnailUrl(
  playbackId: string,
  token?: string | null,
  time = 0
): string {
  const base = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
  return token ? `${base}&token=${token}` : base;
}
