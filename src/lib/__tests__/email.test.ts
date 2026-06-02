import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendEmail } from '../email';

describe('email library', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_mockkey';
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('should log mock console message and return mock ID', async () => {
    const res = await sendEmail({
      to: 'student@test.com',
      subject: 'Welcome',
      html: '<p>Hello!</p>',
    });

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[MOCK EMAIL] To: student@test.com | Subject: Welcome')
    );
    expect(res.id).toContain('mock_email_id_');
  });
});
