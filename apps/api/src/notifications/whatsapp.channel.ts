import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MessageChannel, toWhatsAppNumber } from './message-channel';

/**
 * WhatsApp Cloud API.
 *
 * Authentication templates are a fixed shape on Meta's side: the code goes in
 * the body *and* again in the copy-code button, and the two must match or the
 * button copies the wrong thing. The template itself is approved in Meta's
 * console — this only fills in the variable.
 */
@Injectable()
export class WhatsAppChannel implements MessageChannel {
  readonly name = 'whatsapp';
  private readonly logger = new Logger(WhatsAppChannel.name);

  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  private readonly template = process.env.WHATSAPP_OTP_TEMPLATE ?? 'otp_login';
  private readonly language = process.env.WHATSAPP_OTP_LANGUAGE ?? 'en';
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

  static isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const res = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toWhatsAppNumber(phone),
          type: 'template',
          template: {
            name: this.template,
            language: { code: this.language },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: code }],
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      // Meta's body carries the actual reason — a template not yet approved, a
      // number outside the allowed list, an expired token. Logging the status
      // alone turns a fixable configuration error into a mystery.
      const detail = await res.text().catch(() => '');
      this.logger.error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 500)}`);
      throw new ServiceUnavailableException('Unable to send a verification code right now');
    }
  }
}
