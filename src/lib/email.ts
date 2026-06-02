// src/lib/email.ts
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY || '';
  const isMock = !apiKey || apiKey.startsWith('re_mock');
  
  if (isMock) {
    return null;
  }
  
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  
  return resendClient;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailPayload): Promise<{ id: string }> {
  const client = getResendClient();

  if (!client) {
    console.info(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
    return { id: 'mock_email_id_' + Math.random().toString(36).substring(7) };
  }

  try {
    const response = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Alpha Academy <noreply@alphaacademy.edu.gh>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Basic fallback plain-text conversion
    });

    if (response.error) {
      throw new Error(`Resend error: ${response.error.message}`);
    }

    return { id: response.data?.id || 'resend_success' };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    throw error;
  }
}
