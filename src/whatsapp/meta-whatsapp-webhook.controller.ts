import { Controller, Post, Get, Body, Query, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';

@Controller('whatsapp')
export class MetaWhatsappWebhookController {
  constructor(private whatsappService: WhatsappService) {}

  /**
   * Meta WhatsApp Webhook Verification Endpoint
   * Meta sends a GET request to verify the webhook URL.
   */
  @Get('webhook')
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = process.env.META_WA_VERIFY_TOKEN || process.env.WEBHOOK_SECRET;

    if (mode && token) {
      if (mode === 'subscribe' && token === expectedToken) {
        console.log('[META WA WEBHOOK] Verified successfully.');
        return res.status(HttpStatus.OK).send(challenge);
      } else {
        console.error('[META WA WEBHOOK] Token mismatch.');
        return res.sendStatus(HttpStatus.FORBIDDEN);
      }
    }
    return res.sendStatus(HttpStatus.BAD_REQUEST);
  }

  /**
   * Meta WhatsApp Webhook Event Handler
   * Meta sends POST requests containing incoming messages & status updates.
   */
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('webhook')
  async handleWebhookPayload(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    // 1. Validate Meta App Secret Signature (X-Hub-Signature-256) if configured
    const appSecret = process.env.META_WA_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!signature) {
        return res.status(HttpStatus.UNAUTHORIZED).send('Missing signature');
      }
      const rawBody = (req as any).rawBody || JSON.stringify(body);
      const expectedHash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (`sha256=${expectedHash}` !== signature) {
        return res.status(HttpStatus.UNAUTHORIZED).send('Invalid signature');
      }
    }

    // 2. Parse Meta WhatsApp Cloud API Payload Structure
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const msg = messages[0];
        const from = msg.from; // Phone number (e.g. "628123456789")
        const text = msg.text?.body || '';

        if (from && text) {
          // Asynchronously process incoming AI message
          this.whatsappService
            .handleIncomingMessage(from, text)
            .then((reply) => {
              console.log(`[META WA REPLIED] To: ${from} | Reply: ${reply.substring(0, 50)}...`);
            })
            .catch((err) => {
              console.error(`[META WA ERROR] Processing message from ${from}:`, err);
            });
        }
      }

      // Always return 200 OK quickly to Meta within 20s
      return res.status(HttpStatus.OK).send('EVENT_RECEIVED');
    }

    return res.sendStatus(HttpStatus.NOT_FOUND);
  }
}
