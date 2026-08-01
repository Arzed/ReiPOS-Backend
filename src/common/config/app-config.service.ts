import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AppConfigService {
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }

  get databaseUrl(): string {
    const url =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;
    if (!url) {
      throw new Error('FATAL: DATABASE_URL environment variable is not defined.');
    }
    return url;
  }

  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
    }
    return secret;
  }

  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  get openaiBaseUrl(): string | undefined {
    return process.env.OPENAI_BASE_URL;
  }

  get whatsappApiUrl(): string | undefined {
    return process.env.WHATSAPP_API_URL;
  }

  get whatsappToken(): string | undefined {
    return process.env.WHATSAPP_TOKEN;
  }
}
