import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(ownerId: string, period = 'Hari', storeId?: string) {
    // 1. Resolve stores (outlets) for this owner
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
    });

    const storeIds = stores.map(s => s.id);
    if (storeIds.length === 0) {
      return this.emptySummary();
    }

    // Determine target stores
    const targetStoreIds = storeId && storeId !== 'all' ? [storeId] : storeIds;

    // 2. Determine date ranges for current and previous period
    const { currentStart, currentEnd, prevStart, prevEnd, chartStart } = this.getDateRanges(period);

    // 3. Fetch orders for current period
    const currentOrders = await this.prisma.order.findMany({
      where: {
        storeId: { in: targetStoreIds },
        paymentStatus: 'PAID',
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    });

    // 4. Fetch orders for previous period
    const prevOrders = await this.prisma.order.findMany({
      where: {
        storeId: { in: targetStoreIds },
        paymentStatus: 'PAID',
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    });

    // 5. Calculate current metrics
    const currentRevenue = currentOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const currentProfit = currentOrders.reduce((sum, o) => sum + o.totalProfit, 0);
    const currentTransactions = currentOrders.length;

    // Calculate previous metrics
    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const prevProfit = prevOrders.reduce((sum, o) => sum + o.totalProfit, 0);
    const prevTransactions = prevOrders.length;

    // Calculate percentages
    const revenuePercentage = this.calculatePercentageChange(currentRevenue, prevRevenue);
    const transactionPercentage = this.calculatePercentageChange(currentTransactions, prevTransactions);
    const profitPercentage = this.calculatePercentageChange(currentProfit, prevProfit);

    // 6. Generate chart data
    // For 'Minggu': use chartStart (28 days back) for chart, but currentStart (this week) for metrics
    const effectiveChartStart = chartStart ?? currentStart;
    const chartSpots = await this.getChartSpots(targetStoreIds, period, effectiveChartStart, currentEnd);

    // 7. Get top products sold (uses metrics period = currentStart)
    const topProducts = await this.getTopProducts(targetStoreIds, currentStart, currentEnd);

    return {
      totalRevenue: `Rp ${currentRevenue.toLocaleString('id-ID')}`,
      revenueValue: currentRevenue,
      revenuePercentage: (revenuePercentage >= 0 ? '+' : '') + revenuePercentage.toFixed(1) + '%',
      totalTransactions: `${currentTransactions} Struk`,
      transactionValue: currentTransactions,
      transactionPercentage: (transactionPercentage >= 0 ? '+' : '') + transactionPercentage.toFixed(1) + '%',
      netProfit: `Rp ${currentProfit.toLocaleString('id-ID')}`,
      profitValue: currentProfit,
      profitPercentage: (profitPercentage >= 0 ? '+' : '') + profitPercentage.toFixed(1) + '%',
      chartSpots,
      topProducts,
    };
  }

  private emptySummary() {
    return {
      totalRevenue: 'Rp 0',
      revenueValue: 0,
      revenuePercentage: '+0.0%',
      totalTransactions: '0 Struk',
      transactionValue: 0,
      transactionPercentage: '+0.0%',
      netProfit: 'Rp 0',
      profitValue: 0,
      profitPercentage: '+0.0%',
      chartSpots: [],
      topProducts: [],
    };
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100.0 : 0.0;
    return ((current - previous) / previous) * 100;
  }

  private getDateRanges(period: string) {
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date = new Date(now);
    let prevStart: Date;
    let prevEnd: Date;
    let chartStart: Date | undefined; // Separate wider start for chart visualization

    if (period === 'Hari') {
      // Metrics: today only vs yesterday
      currentStart = new Date(now.setHours(0, 0, 0, 0));
      currentEnd = new Date(new Date(currentStart).setDate(currentStart.getDate() + 1));

      prevStart = new Date(new Date(currentStart).setDate(currentStart.getDate() - 1));
      prevEnd = new Date(currentStart);

      // Chart: entire current week (Mon-Sun) so all days are visible
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      chartStart = new Date();
      chartStart.setDate(new Date().getDate() - distanceToMonday);
      chartStart.setHours(0, 0, 0, 0);
    } else if (period === 'Minggu') {
      // Metrics: this week (Monday 00:00 to now) vs last week
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - distanceToMonday);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(currentStart.getDate() - 7);
      prevEnd = new Date(currentStart);

      // Chart: last 28 days (4 weeks) for weekly trend visualization
      chartStart = new Date(now);
      chartStart.setDate(now.getDate() - 27);
      chartStart.setHours(0, 0, 0, 0);
    } else if (period === 'Bulan') {
      // Metrics: this month only vs last month
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);

      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Chart: entire current year (Jan 1 to now) so all months with data are visible
      chartStart = new Date(now.getFullYear(), 0, 1);
    } else {
      // This Year vs Last Year
      currentStart = new Date(now.getFullYear(), 0, 1);

      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }

    return { currentStart, currentEnd, prevStart, prevEnd, chartStart };
  }

  private async getChartSpots(storeIds: string[], period: string, start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        storeId: { in: storeIds },
        paymentStatus: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const spots: { x: number; y: number; transactions: number }[] = [];

    if (period === 'Hari') {
      const dailyRevenue = Array(7).fill(0);
      const dailyCount  = Array(7).fill(0);
      orders.forEach(o => {
        let day = o.createdAt.getDay() - 1;
        if (day === -1) day = 6;
        dailyRevenue[day] += o.totalAmount;
        dailyCount[day]++;
      });
      for (let i = 0; i < 7; i++) {
        spots.push({ x: i, y: dailyRevenue[i] / 1000000, transactions: dailyCount[i] });
      }
    } else if (period === 'Minggu') {
      const weeklyRevenue = Array(4).fill(0);
      const weeklyCount  = Array(4).fill(0);
      orders.forEach(o => {
        const diffDays = Math.floor(
          (o.createdAt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const weekIndex = Math.min(Math.floor(diffDays / 7), 3);
        weeklyRevenue[weekIndex] += o.totalAmount;
        weeklyCount[weekIndex]++;
      });
      for (let i = 0; i < 4; i++) {
        spots.push({ x: i, y: weeklyRevenue[i] / 1000000, transactions: weeklyCount[i] });
      }
    } else if (period === 'Bulan') {
      const monthlyRevenue = Array(12).fill(0);
      const monthlyCount  = Array(12).fill(0);
      orders.forEach(o => {
        const month = o.createdAt.getMonth();
        monthlyRevenue[month] += o.totalAmount;
        monthlyCount[month]++;
      });
      for (let i = 0; i < 12; i++) {
        spots.push({ x: i, y: monthlyRevenue[i] / 1000000, transactions: monthlyCount[i] });
      }
    } else {
      const yearlyRevenue: Record<number, number> = { 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
      const yearlyCount:   Record<number, number> = { 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
      orders.forEach(o => {
        const year = o.createdAt.getFullYear();
        if (year in yearlyRevenue) {
          yearlyRevenue[year] += o.totalAmount;
          yearlyCount[year]++;
        }
      });
      const years = [2023, 2024, 2025, 2026];
      for (let i = 0; i < years.length; i++) {
        spots.push({ x: i, y: yearlyRevenue[years[i]] / 1000000, transactions: yearlyCount[years[i]] });
      }
    }

    return spots;
  }

  private async getTopProducts(storeIds: string[], start: Date, end: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          storeId: { in: storeIds },
          paymentStatus: 'PAID',
          createdAt: { gte: start, lte: end },
        },
      },
      include: {
        product: true,
      },
    });

    // Group and count quantities
    const grouped: Record<string, { name: string; sold: number; price: number }> = {};
    items.forEach(i => {
      if (!grouped[i.productId]) {
        grouped[i.productId] = {
          name: i.product.name,
          sold: 0,
          price: i.price,
        };
      }
      grouped[i.productId].sold += i.quantity;
    });

    // Convert to array and sort by sold quantity
    return Object.values(grouped)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 4)
      .map(item => ({
        name: item.name,
        sold: `${item.sold} terjual`,
        price: `Rp ${item.price.toLocaleString('id-ID')}`,
      }));
  }
}
