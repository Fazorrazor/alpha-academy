// src/lib/sms.ts

export function formatGhanaNumber(phone: string): string {
  // Strip non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // If number starts with 233, return it
  if (cleaned.startsWith('233') && cleaned.length >= 12) {
    return cleaned;
  }

  // If number starts with 0, replace it with 233
  if (cleaned.startsWith('0')) {
    return '233' + cleaned.substring(1);
  }

  // If it's already a 9-digit number without leading 0, prepend 233
  if (cleaned.length === 9) {
    return '233' + cleaned;
  }

  return cleaned;
}

export async function sendSMS(to: string, message: string): Promise<{ id: string }> {
  const apiKey = process.env.TERMII_API_KEY || '';
  const senderId = process.env.TERMII_SENDER_ID || 'ALPHAACAD';
  const isMock = !apiKey || apiKey.startsWith('mock');
  const formattedPhone = formatGhanaNumber(to);

  if (isMock) {
    console.info(`[MOCK SMS] To: ${formattedPhone} | Message: ${message}`);
    return { id: 'mock_sms_id_' + Math.random().toString(36).substring(7) };
  }

  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        to: formattedPhone,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send SMS via Termii');
    }

    return { id: data.message_id || 'termii_success' };
  } catch (error) {
    console.error('Failed to send SMS via Termii:', error);
    throw error;
  }
}
