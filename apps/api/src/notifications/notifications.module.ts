import { Module, Logger } from '@nestjs/common';
import { MESSAGE_CHANNEL } from './message-channel';
import { LogChannel } from './log.channel';
import { WhatsAppChannel } from './whatsapp.channel';

/**
 * Picks the channel once, at boot, from what is actually configured — so the
 * choice appears in the startup log rather than being rediscovered per request.
 */
@Module({
  providers: [
    LogChannel,
    WhatsAppChannel,
    {
      provide: MESSAGE_CHANNEL,
      inject: [WhatsAppChannel, LogChannel],
      useFactory: (whatsapp: WhatsAppChannel, log: LogChannel) => {
        const chosen = WhatsAppChannel.isConfigured() ? whatsapp : log;
        new Logger('NotificationsModule').log(`Message channel: ${chosen.name}`);
        return chosen;
      },
    },
  ],
  exports: [MESSAGE_CHANNEL],
})
export class NotificationsModule {}
