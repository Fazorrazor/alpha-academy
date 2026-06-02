import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendSMS, formatGhanaNumber } from '../sms';

describe('sms library', () => {
  const originalKey = process.env.TERMII_API_KEY;

  beforeEach(() => {
    process.env.TERMII_API_KEY = 'mockkey';
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.TERMII_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  describe('formatGhanaNumber', () => {
    it('should format numbers starting with 0 correctly', () => {
      expect(formatGhanaNumber('0541234567')).toBe('233541234567');
      expect(formatGhanaNumber('0249876543')).toBe('233249876543');
    });

    it('should format 9-digit numbers correctly', () => {
      expect(formatGhanaNumber('541234567')).toBe('233541234567');
    });

    it('should preserve already formatted 233 numbers', () => {
      expect(formatGhanaNumber('233541234567')).toBe('233541234567');
    });

    it('should strip non-digits before formatting', () => {
      expect(formatGhanaNumber('+233 (54) 123-4567')).toBe('233541234567');
      expect(formatGhanaNumber('054-123-4567')).toBe('233541234567');
    });
  });

  describe('sendSMS', () => {
    it('should log mock SMS message and return mock ID', async () => {
      const res = await sendSMS('0541234567', 'Your OTP code is 1234');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[MOCK SMS] To: 233541234567 | Message: Your OTP code is 1234')
      );
      expect(res.id).toContain('mock_sms_id_');
    });
  });
});
