import { Controller, Post, Get, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { SchedulerService } from '../scheduler/scheduler.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private whatsappService: WhatsappService,
    private schedulerService: SchedulerService,
  ) {}

  @Post('simulator')
  async simulateMessage(@Body() body: { from: string; body: string; storeId?: string; skillId?: string }) {
    const reply = await this.whatsappService.handleIncomingMessage(body.from, body.body, body.storeId, body.skillId);
    return { reply };
  }

  @Get('simulator/history')
  async getHistory(@Query('from') from: string, @Query('skillId') skillId?: string) {
    return this.whatsappService.getHistory(from, skillId);
  }

  @Post('simulator/clear')
  async clearSession(@Body() body: { from: string; skillId?: string }) {
    await this.whatsappService.clearSession(body.from, body.skillId);
    return { success: true, message: 'Session cleared.' };
  }

  @Get('notifications')
  async getNotifications() {
    return this.schedulerService.notificationsLog;
  }

  @Post('simulator/trigger-cron/:type')
  async triggerCron(@Param('type') type: string) {
    if (type === 'morning') {
      const message = await this.schedulerService.generateMorningSummary();
      return { success: true, message };
    } else if (type === 'evening') {
      const message = await this.schedulerService.generateEveningSummary();
      return { success: true, message };
    } else if (type === 'low-stock') {
      const message = await this.schedulerService.checkLowStock();
      return { success: true, message: message || 'Stok aman, tidak ada alert.' };
    }
    throw new BadRequestException('Invalid cron type. Use morning, evening, or low-stock');
  }
}

