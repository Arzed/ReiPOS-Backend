import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    'postgresql://neondb_owner:npg_h45MEJjYWHTq@ep-sparkling-silence-azqxwshe.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15';
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      'postgresql://neondb_owner:npg_h45MEJjYWHTq@ep-sparkling-silence-azqxwshe.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15';
    super({
      datasources: { db: { url: dbUrl } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
