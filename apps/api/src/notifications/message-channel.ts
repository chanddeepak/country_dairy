/**
 * How the API talks to a customer's phone.
 *
 * An interface rather than a direct call because the channel is expected to
 * change: WhatsApp first because authentication templates are ₹0.115–0.13 and
 * need no DLT registration, SMS later as a fallback for handsets without the
 * app. Nothing above this line should know which one ran.
 */
export interface MessageChannel {
  /** For logs and errors — never shown to a customer. */
  readonly name: string;

  /**
   * @param phone `+91XXXXXXXXXX`, as validated by SendOtpDto.
   * @param code  The plain six digits. Never logged outside development.
   */
  sendOtp(phone: string, code: string): Promise<void>;
}

export const MESSAGE_CHANNEL = Symbol('MESSAGE_CHANNEL');

/**
 * `+919876543210` becomes `919876543210`.
 *
 * Meta's API rejects the leading `+`, and the DTO guarantees the rest of the
 * shape, so this stays deliberately dumb rather than re-validating.
 */
export function toWhatsAppNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}
