import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  
  // In-memory list of pro-active notifications sent to the user
  public notificationsLog: { timestamp: Date; type: string; message: string }[] = [];

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // 1. Morning Summary (Every day at 8:00 AM)
  @Cron('0 8 * * *')
  async handleMorningSummary() {
    this.logger.log('Running Morning Summary Cron Job...');
    await this.generateMorningSummary();
  }

  // 2. Evening Summary (Every day at 8:00 PM)
  @Cron('0 20 * * *')
  async handleEveningSummary() {
    this.logger.log('Running Evening Summary Cron Job...');
    await this.generateEveningSummary();
  }

  // 3. Low Stock Check (Every hour)
  @Cron(CronExpression.EVERY_HOUR)
  async handleLowStockCheck() {
    this.logger.log('Running Low Stock Check Cron Job...');
    await this.checkLowStock();
  }

  // Logic to generate Morning Summary
  async generateMorningSummary(): Promise<string> {
    const store = await this.prisma.store.findFirst();
    if (!store) return 'No store configured.';

    // Yesterday's revenue
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.setHours(0, 0, 0, 0));
    const end = new Date(yesterday.setHours(23, 59, 59, 999));

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: store.id,
        paymentStatus: 'PAID',
        createdAt: { gte: start, lte: end },
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const lowStockProducts = await this.aiService.getLowStockAnalysis([store.id]);
    const lowStockCount = lowStockProducts.length;

    const msg = `🌅 *Laporan Selamat Pagi* - ${store.name}\n\n` +
      `Omzet Kemarin: *Rp${totalRevenue.toLocaleString('id-ID')}*\n` +
      `Total Pesanan: *${orders.length}*\n` +
      `Produk Stok Menipis: *${lowStockCount} produk*\n\n` +
      `Semoga jualan hari ini lancar! 🚀`;

    this.notificationsLog.unshift({ timestamp: new Date(), type: 'MORNING_SUMMARY', message: msg });
    return msg;
  }

  // Logic to generate Evening Summary
  async generateEveningSummary(): Promise<string> {
    const store = await this.prisma.store.findFirst();
    if (!store) return 'No store configured.';

    // Today's revenue
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: store.id,
        paymentStatus: 'PAID',
        createdAt: { gte: start, lte: end },
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalProfit = orders.reduce((sum, o) => sum + o.totalProfit, 0);

    const msg = `🌃 *Laporan Penutupan Malam* - ${store.name}\n\n` +
      `Omzet Hari Ini: *Rp${totalRevenue.toLocaleString('id-ID')}*\n` +
      `Profit Bersih: *Rp${totalProfit.toLocaleString('id-ID')}*\n` +
      `Total Pesanan Sukses: *${orders.length}*\n\n` +
      `Terima kasih atas kerja keras hari ini! 💤`;

    this.notificationsLog.unshift({ timestamp: new Date(), type: 'EVENING_SUMMARY', message: msg });
    return msg;
  }

  // Logic to check Low Stock
  async checkLowStock(): Promise<string | null> {
    const store = await this.prisma.store.findFirst();
    if (!store) return null;

    const lowStockProducts = await this.aiService.getLowStockAnalysis([store.id]);

    if (lowStockProducts.length === 0) return null;

    const list = lowStockProducts.map(p => `- *${p.name}*: Sisa *${p.stock} pcs* (${p.reason})`).join('\n');
    const msg = `⚠️ *Pemberitahuan Stok Menipis!*\n\nProduk berikut memerlukan restock segera:\n${list}`;

    this.notificationsLog.unshift({ timestamp: new Date(), type: 'LOW_STOCK_ALERT', message: msg });
    return msg;
  }
}
