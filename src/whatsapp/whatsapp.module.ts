import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { MetaWhatsappWebhookController } from './meta-whatsapp-webhook.controller';
import { WhatsappService } from './whatsapp.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [WhatsappController, MetaWhatsappWebhookController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
