import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AppConfigService } from '../../common/config/app-config.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private config: AppConfigService,
  ) {}

  @Get()
  async checkHealth() {
    const memoryUsage = process.memoryUsage();
    let dbStatus = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch (e) {
      dbStatus = 'down';
    }

    const checks = {
      database: dbStatus,
      openai: this.config.openaiApiKey ? 'configured' : 'missing_key',
      whatsapp: this.config.whatsappToken ? 'configured' : 'missing_token',
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    const isHealthy = dbStatus === 'up';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      checks,
    };
  }
}
