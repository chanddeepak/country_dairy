import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MessageChannel } from './message-channel';

/**
 * The channel used when no real one is configured.
 *
 * In development it prints the code so the flow can be walked without a
 * WhatsApp account. In production it **refuses**: an OTP endpoint that returns
 * success while sending nothing strands every customer at the code screen with
 * no error anywhere, and that failure is invisible until someone complains.
 * Better to fail loudly at the first request than quietly at every one.
 */
@Injectable()
export class LogChannel implements MessageChannel {
  readonly name = 'log';
  private readonly logger = new Logger(LogChannel.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        'Phone sign-in is on but no message channel is configured. ' +
          'Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN, or turn ENABLE_OTP_LOGIN off.',
      );
      throw new ServiceUnavailableException('Unable to send a verification code right now');
    }

    this.logger.debug(`[dev] OTP for ${phone} is ${code}`);
  }
}
