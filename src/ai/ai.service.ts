import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { AI_SKILLS } from './skills.config';

dotenv.config();

@Injectable()
export class AiService {
  private geminiClient: OpenAI | null = null;
  private deepseekClient: OpenAI | null = null;

  constructor(private prisma: PrismaService) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

    console.log('AiService Constructor -> Gemini Key:', geminiKey ? 'FOUND' : 'MISSING', 'DeepSeek Key:', deepseekKey ? 'FOUND' : 'MISSING');

    if (geminiKey) {
      this.geminiClient = new OpenAI({
        apiKey: geminiKey,
        baseURL: geminiBaseUrl,
      });
    }

    if (deepseekKey) {
      this.deepseekClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL: deepseekBaseUrl,
      });
    }
  }

  private getToolsDefinition(allowedTools?: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    const allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'getRevenue',
          description: 'Mengambil total omzet/pendapatan dalam rentang tanggal tertentu.',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Format ISO (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'Format ISO (YYYY-MM-DD)' },
              allStores: { type: 'boolean', description: 'Ambil omzet dari semua cabang toko milik Owner' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getOrders',
          description: 'Mengambil pesanan terbaru.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Jumlah pesanan maksimal yang diambil (default 5)' },
              allStores: { type: 'boolean', description: 'Ambil pesanan dari semua cabang toko milik Owner' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'createProduct',
          description: 'Menambahkan produk baru ke toko. Sebelum memanggil fungsi ini, jika pengguna belum memberikan barcode, tanyakan dulu apakah produk memiliki barcode dan pandu pengguna untuk menekan tombol scan di bawah kiri kolom chat.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nama produk' },
              price: { type: 'number', description: 'Harga jual produk' },
              costPrice: { type: 'number', description: 'Harga modal/beli produk' },
              stock: { type: 'number', description: 'Stok awal produk' },
              barcode: { type: 'string', description: 'Barcode atau SKU produk (kosongkan jika produk tidak memiliki barcode)' },
              storeName: { type: 'string', description: 'Nama cabang toko tempat produk akan ditambahkan (misal: Jakarta, Bandung)' },
            },
            required: ['name', 'price', 'costPrice', 'stock', 'storeName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'updateStock',
          description: 'Memperbarui stok produk yang sudah ada.',
          parameters: {
            type: 'object',
            properties: {
              barcodeOrId: { type: 'string', description: 'Barcode atau ID dari produk' },
              stock: { type: 'number', description: 'Jumlah stok baru' },
            },
            required: ['barcodeOrId', 'stock'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'deleteProduct',
          description: 'Menghapus produk dari toko.',
          parameters: {
            type: 'object',
            properties: {
              barcodeOrId: { type: 'string', description: 'Barcode atau ID produk yang ingin dihapus' },
            },
            required: ['barcodeOrId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'lowStock',
          description: 'Mengecek produk yang memiliki stok tipis (di bawah batas minimum threshold).',
          parameters: {
            type: 'object',
            properties: {
              allStores: { type: 'boolean', description: 'Cek stok tipis dari semua cabang toko milik Owner' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'salesReport',
          description: 'Menyusun laporan penjualan ringkas harian atau mingguan.',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['today', 'yesterday', 'weekly'], description: 'Periode laporan' },
              allStores: { type: 'boolean', description: 'Susun laporan dari semua cabang toko milik Owner' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'profitReport',
          description: 'Menyusun laporan keuntungan/profit bersih.',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['today', 'yesterday', 'weekly'], description: 'Periode laporan' },
              allStores: { type: 'boolean', description: 'Susun laporan dari semua cabang toko milik Owner' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getProduct',
          description: 'Mencari informasi produk atau menampilkan semua daftar produk dari cabang toko tertentu.',
          parameters: {
            type: 'object',
            properties: {
              nameQuery: { type: 'string', description: 'Nama produk yang dicari (opsional, jika kosong menampilkan seluruh produk)' },
              barcode: { type: 'string', description: 'Barcode produk (opsional)' },
              storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            },
          },
        },
      },
    ];

    // Add missing forecastSales tool
    allTools.push({
      type: 'function',
      function: {
        name: 'forecastSales',
        description: 'Memprediksi sisa hari stok produk akan habis berdasarkan rata-rata penjualan 7 hari terakhir.',
        parameters: {
          type: 'object',
          properties: {
            barcodeOrId: { type: 'string', description: 'Barcode atau ID produk yang ingin diprediksi' },
          },
          required: ['barcodeOrId'],
        },
      },
    });

    allTools.push({
      type: 'function',
      function: {
        name: 'checkMonthlyTarget',
        description: 'Mengecek status pencapaian target bulanan dan saran penjualan produk dengan profit/permintaan tinggi.',
        parameters: {
          type: 'object',
          properties: {
            storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
          },
        },
      },
    });

    allTools.push({
      type: 'function',
      function: {
        name: 'getEmployeeKPI',
        description: 'Menganalisis KPI dan performa penjualan masing-masing pegawai/kasir (omzet, jumlah transaksi, rata-rata nominal transaksi, dan kontribusi %).',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['today', 'weekly', 'monthly'], description: 'Periode analisis (default monthly)' },
            storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
            allStores: { type: 'boolean', description: 'Ambil KPI pegawai dari semua cabang toko milik Owner' },
          },
        },
      },
    });

    if (allowedTools) {
      return allTools.filter(t => allowedTools.includes((t as any).function?.name));
    }
    return allTools;
  }

  // Execution Logic for each function
  private async executeTool(name: string, args: any, storeId: string): Promise<any> {
    try {
      // Resolve target store IDs for owner overview
      const currentStore = await this.prisma.store.findUnique({ where: { id: storeId } });
      let targetStoreIds = [storeId];

      if (currentStore) {
        const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
        if (args.storeName) {
          const matched = ownerStores.find(s => s.name.toLowerCase().includes(args.storeName.toLowerCase()));
          if (matched) {
            targetStoreIds = [matched.id];
          }
        } else if (args.allStores === false) {
          targetStoreIds = [storeId];
        } else {
          targetStoreIds = ownerStores.map(s => s.id);
        }
      }

      switch (name) {
        case 'getRevenue': {
          const start = args.startDate ? new Date(args.startDate) : new Date();
          start.setHours(0, 0, 0, 0);

          const end = args.endDate ? new Date(args.endDate) : new Date();
          if (args.endDate) {
            end.setHours(23, 59, 59, 999);
          }

          const orders = await this.prisma.order.findMany({
            where: {
              storeId: { in: targetStoreIds },
              paymentStatus: 'PAID',
              createdAt: { gte: start, lte: end },
            },
            include: { store: true },
          });
          const total = orders.reduce((sum, o) => sum + o.totalAmount, 0);
          
          const breakdown: Record<string, number> = {};
          if (currentStore) {
            const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
            ownerStores.forEach(s => {
              if (targetStoreIds.includes(s.id)) {
                breakdown[s.name] = 0;
              }
            });
          }
          orders.forEach(o => {
            breakdown[o.store.name] = (breakdown[o.store.name] || 0) + o.totalAmount;
          });

          return { 
            totalRevenue: total, 
            count: orders.length, 
            period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
            breakdown 
          };
        }

        case 'getOrders': {
          const limit = args.limit || 5;
          const orders = await this.prisma.order.findMany({
            where: { storeId: { in: targetStoreIds } },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } }, store: true },
          });
          return orders.map(o => ({
            id: o.id,
            storeName: o.store.name,
            total: o.totalAmount,
            status: o.paymentStatus,
            date: o.createdAt,
            items: o.items.map(i => `${i.product.name} (x${i.quantity})`),
          }));
        }

        case 'createProduct': {
          let targetStoreId = storeId;
          if (args.storeName && currentStore) {
            const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
            const matched = ownerStores.find(s => s.name.toLowerCase().includes(args.storeName.toLowerCase()));
            if (matched) {
              targetStoreId = matched.id;
            }
          }

          const product = await this.prisma.product.create({
            data: {
              storeId: targetStoreId,
              name: args.name,
              price: args.price,
              costPrice: args.costPrice,
              stock: args.stock,
              barcode: args.barcode || null,
            },
          });
          return { success: true, product };
        }

        case 'updateStock': {
          const prod = await this.prisma.product.findFirst({
            where: {
              storeId,
              OR: [{ id: args.barcodeOrId }, { barcode: args.barcodeOrId }],
            },
          });
          if (!prod) return { error: 'Produk tidak ditemukan' };
          const updated = await this.prisma.product.update({
            where: { id: prod.id },
            data: { stock: args.stock },
          });
          return { success: true, name: updated.name, newStock: updated.stock };
        }

        case 'deleteProduct': {
          const prod = await this.prisma.product.findFirst({
            where: {
              storeId,
              OR: [{ id: args.barcodeOrId }, { barcode: args.barcodeOrId }],
            },
          });
          if (!prod) return { error: 'Produk tidak ditemukan' };
          await this.prisma.product.delete({ where: { id: prod.id } });
          return { success: true, message: `Produk ${prod.name} berhasil dihapus.` };
        }

        case 'lowStock': {
          return this.getLowStockAnalysis(targetStoreIds);
        }

        case 'getProduct': {
          const query = args.nameQuery ? args.nameQuery.trim() : '';
          const barcode = args.barcode ? args.barcode.trim() : '';

          let whereClause: any = {
            storeId: { in: targetStoreIds },
          };

          if (barcode) {
            whereClause.barcode = barcode;
            const products = await this.prisma.product.findMany({
              where: whereClause,
              include: { store: true },
            });
            return products.map(p => ({
              id: p.id,
              name: p.name,
              barcode: p.barcode,
              price: p.price,
              stock: p.stock,
              storeName: p.store.name,
            }));
          }

          if (query) {
            const allProducts = await this.prisma.product.findMany({
              where: { storeId: { in: targetStoreIds } },
              include: { store: true },
            });

            const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
            const scored = allProducts.map(p => {
              const nameLower = p.name.toLowerCase();
              let score = 0;
              
              keywords.forEach(kw => {
                if (nameLower.includes(kw)) {
                  score += 2;
                }
              });

              if (keywords.length > 0) {
                let lastIndex = -1;
                let orderedMatch = true;
                for (const kw of keywords) {
                  const idx = nameLower.indexOf(kw, lastIndex + 1);
                  if (idx !== -1) {
                    lastIndex = idx;
                  } else {
                    orderedMatch = false;
                    break;
                  }
                }
                if (orderedMatch) {
                  score += 3;
                }
              }

              return { product: p, score };
            }).filter(item => item.score > 0);

            scored.sort((a, b) => b.score - a.score);

            return scored.map(item => ({
              id: item.product.id,
              name: item.product.name,
              barcode: item.product.barcode,
              price: item.product.price,
              stock: item.product.stock,
              storeName: item.product.store.name,
              matchScore: item.score,
            }));
          }

          const allProducts = await this.prisma.product.findMany({
            where: { storeId: { in: targetStoreIds } },
            include: { store: true },
          });
          return allProducts.map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            price: p.price,
            stock: p.stock,
            storeName: p.store.name,
          }));
        }

        case 'salesReport': {
          const period = args.period || 'today';
          const start = new Date();
          if (period === 'yesterday') {
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
          } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
          } else {
            start.setHours(0, 0, 0, 0);
          }

          const orders = await this.prisma.order.findMany({
            where: { storeId: { in: targetStoreIds }, paymentStatus: 'PAID', createdAt: { gte: start } },
            include: { items: { include: { product: true } }, store: true },
          });

          const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
          const productCounts: Record<string, number> = {};
          orders.forEach(o => {
            o.items.forEach(i => {
              productCounts[i.product.name] = (productCounts[i.product.name] || 0) + i.quantity;
            });
          });

          const storeSalesBreakdown: Record<string, number> = {};
          orders.forEach(o => {
            storeSalesBreakdown[o.store.name] = (storeSalesBreakdown[o.store.name] || 0) + o.totalAmount;
          });

          return { period, totalSales, totalOrders: orders.length, itemsSold: productCounts, storeSalesBreakdown };
        }

        case 'profitReport': {
          const period = args.period || 'today';
          const start = new Date();
          if (period === 'yesterday') {
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
          } else if (period === 'weekly') {
            start.setDate(start.getDate() - 7);
          } else {
            start.setHours(0, 0, 0, 0);
          }

          const orders = await this.prisma.order.findMany({
            where: { storeId: { in: targetStoreIds }, paymentStatus: 'PAID', createdAt: { gte: start } },
            include: { store: true },
          });

          const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
          const totalProfit = orders.reduce((sum, o) => sum + o.totalProfit, 0);

          const storeProfitBreakdown: Record<string, { revenue: number; profit: number }> = {};
          orders.forEach(o => {
            if (!storeProfitBreakdown[o.store.name]) {
              storeProfitBreakdown[o.store.name] = { revenue: 0, profit: 0 };
            }
            storeProfitBreakdown[o.store.name].revenue += o.totalAmount;
            storeProfitBreakdown[o.store.name].profit += o.totalProfit;
          });

          return { 
            period, 
            totalRevenue, 
            totalProfit, 
            margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
            storeProfitBreakdown 
          };
        }

        case 'forecastSales': {
          const prod = await this.prisma.product.findFirst({
            where: {
              storeId,
              OR: args.barcodeOrId ? [{ id: args.barcodeOrId }, { barcode: args.barcodeOrId }] : undefined,
            },
          });

          if (!prod) return { error: 'Produk tidak ditemukan' };

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const orderItems = await this.prisma.orderItem.findMany({
            where: {
              productId: prod.id,
              order: {
                storeId,
                paymentStatus: 'PAID',
                createdAt: { gte: sevenDaysAgo },
              },
            },
          });

          const totalSoldInWeek = orderItems.reduce((sum, i) => sum + i.quantity, 0);
          const avgDailySales = totalSoldInWeek / 7;

          let daysRemaining = 'Tidak ada penjualan dalam 7 hari terakhir';
          if (avgDailySales > 0) {
            daysRemaining = `${Math.ceil(prod.stock / avgDailySales)} hari`;
          }

          return {
            productName: prod.name,
            currentStock: prod.stock,
            avgDailySales: avgDailySales.toFixed(2),
            daysStockWillLast: daysRemaining,
          };
        }

        case 'checkMonthlyTarget': {
          let targetStoreId = storeId;
          if (args.storeName && currentStore) {
            const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
            const matched = ownerStores.find(s => s.name.toLowerCase().includes(args.storeName.toLowerCase()));
            if (matched) {
              targetStoreId = matched.id;
            }
          }

          const store = await this.prisma.store.findUnique({
            where: { id: targetStoreId },
            include: { products: true }
          });

          if (!store) {
            return { error: `Store with ID ${targetStoreId} not found` };
          }

          // Target bulanan (default to 100jt jika 0)
          const target = store.target > 0 ? store.target : 100000000.0;

          // Total omzet bulan ini (PAID orders)
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

          const monthlyOrders = await this.prisma.order.findMany({
            where: {
              storeId: targetStoreId,
              paymentStatus: 'PAID',
              createdAt: { gte: startOfMonth, lte: endOfMonth }
            }
          });

          const currentRevenue = monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
          const achievementPercent = (currentRevenue / target) * 100;

          // Hitung sisa hari bulan ini
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const remainingDays = daysInMonth - now.getDate() + 1;
          const remainingTarget = target - currentRevenue;
          const requiredPerDay = remainingTarget > 0 ? (remainingTarget / remainingDays) : 0;

          // Temukan produk dengan margin tertinggi & stock > 0
          const sortedProducts = store.products
            .map(p => {
              const margin = p.price - p.costPrice;
              return { ...p, margin };
            })
            .sort((a, b) => b.margin - a.margin);

          const suggestions = sortedProducts.slice(0, 3).map(p => ({
            name: p.name,
            margin: p.margin
          }));

          return {
            storeName: store.name,
            monthlyTarget: target,
            currentRevenue,
            achievementPercent: parseFloat(achievementPercent.toFixed(2)),
            requiredPerDay: parseFloat(requiredPerDay.toFixed(2)),
            suggestions
          };
        }

        case 'getEmployeeKPI': {
          let targetStoreIds: string[] = [storeId];
          if (args.storeName && currentStore) {
            const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
            const matched = ownerStores.find(s => s.name.toLowerCase().includes(args.storeName.toLowerCase()));
            if (matched) {
              targetStoreIds = [matched.id];
            }
          } else if (args.allStores && currentStore) {
            const ownerStores = await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } });
            targetStoreIds = ownerStores.map(s => s.id);
          }

          const period = args.period || 'monthly';
          const now = new Date();
          let startDate = new Date();

          if (period === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          } else if (period === 'weekly') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          }

          const orders = await this.prisma.order.findMany({
            where: {
              storeId: { in: targetStoreIds },
              paymentStatus: 'PAID',
              createdAt: { gte: startDate }
            }
          });

          const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

          // Ambil nama seluruh toko milik Owner untuk breakdown per cabang
          const allOwnerStores = currentStore
            ? await this.prisma.store.findMany({ where: { ownerId: currentStore.ownerId } })
            : await this.prisma.store.findMany({ where: { id: { in: targetStoreIds } } });
          
          const storeNameMap = new Map(allOwnerStores.map(s => [s.id, s.name]));

          // Stat gabungan per kasir
          const statsMap: Record<string, { cashierName: string; totalTransactions: number; totalRevenue: number; totalProfit: number }> = {};
          
          // Stat breakdown terpisah per cabang toko
          const storeMap: Record<string, { storeId: string; storeName: string; totalRevenue: number; totalOrders: number; cashiers: Record<string, { cashierName: string; totalTransactions: number; totalRevenue: number; totalProfit: number }> }> = {};

          for (const sId of targetStoreIds) {
            storeMap[sId] = {
              storeId: sId,
              storeName: storeNameMap.get(sId) || 'Toko Cabang',
              totalRevenue: 0,
              totalOrders: 0,
              cashiers: {}
            };
          }

          for (const o of orders) {
            const name = o.cashierName || 'Owner/Kasir';
            const sId = o.storeId;

            // Total gabungan
            if (!statsMap[name]) {
              statsMap[name] = { cashierName: name, totalTransactions: 0, totalRevenue: 0, totalProfit: 0 };
            }
            statsMap[name].totalTransactions += 1;
            statsMap[name].totalRevenue += o.totalAmount;
            statsMap[name].totalProfit += o.totalProfit;

            // Breakdown per toko
            if (!storeMap[sId]) {
              storeMap[sId] = {
                storeId: sId,
                storeName: storeNameMap.get(sId) || 'Toko Cabang',
                totalRevenue: 0,
                totalOrders: 0,
                cashiers: {}
              };
            }
            storeMap[sId].totalRevenue += o.totalAmount;
            storeMap[sId].totalOrders += 1;

            if (!storeMap[sId].cashiers[name]) {
              storeMap[sId].cashiers[name] = { cashierName: name, totalTransactions: 0, totalRevenue: 0, totalProfit: 0 };
            }
            storeMap[sId].cashiers[name].totalTransactions += 1;
            storeMap[sId].cashiers[name].totalRevenue += o.totalAmount;
            storeMap[sId].cashiers[name].totalProfit += o.totalProfit;
          }

          const cashierKpis = Object.values(statsMap).map(item => {
            const percentage = totalRevenue > 0 ? (item.totalRevenue / totalRevenue) * 100 : 0;
            const avgValue = item.totalTransactions > 0 ? item.totalRevenue / item.totalTransactions : 0;
            return {
              ...item,
              avgTransactionValue: Math.round(avgValue),
              contributionPercentage: parseFloat(percentage.toFixed(1))
            };
          }).sort((a, b) => b.totalRevenue - a.totalRevenue);

          const storeBreakdown = Object.values(storeMap).map(s => {
            const sRev = s.totalRevenue;
            const cashierList = Object.values(s.cashiers).map(c => ({
              cashierName: c.cashierName,
              totalTransactions: c.totalTransactions,
              totalRevenue: c.totalRevenue,
              avgTransactionValue: c.totalTransactions > 0 ? Math.round(c.totalRevenue / c.totalTransactions) : 0,
              contributionInStore: sRev > 0 ? parseFloat(((c.totalRevenue / sRev) * 100).toFixed(1)) : 0
            })).sort((a, b) => b.totalRevenue - a.totalRevenue);

            return {
              storeId: s.storeId,
              storeName: s.storeName,
              totalRevenue: s.totalRevenue,
              totalOrders: s.totalOrders,
              cashierKpis: cashierList
            };
          });

          return {
            period,
            totalStoreRevenue: totalRevenue,
            totalOrdersProcessed: orders.length,
            overallCashierKpis: cashierKpis,
            storeBreakdown
          };
        }

        default:
          return { error: 'Tool tidak dikenali' };
      }
    } catch (e) {
      return { error: e.message };
    }
  }

  // Handle User Chat with Agent Loop
  async processMessage(storeId: string, userMessage: string, history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [], skillId?: string, userRole?: string): Promise<string> {
    if (!this.geminiClient && !this.deepseekClient) {
      // Mock Response Mode if no API Key provided
      return this.handleMockResponse(userMessage, skillId, userRole);
    }

    const todayFormatted = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const isEmployee = userRole === 'employee';
    let systemPrompt = '';
    let tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

    // Deskripsi Layout & Navigasi Aplikasi Mobile ReiPOS
    const mobileAppDescription = `[Informasi Layout Aplikasi Mobile ReiPOS]:
- Aplikasi menggunakan Bottom Navigation Bar dengan 4 tab utama (untuk Owner):
  1. Tab "Ringkasan" (Dashboard): Menampilkan grafik performa toko, warning stok menipis, persentase pencapaian target bulanan, omzet, dan laba bersih.
  2. Tab "Kasir" (POS): Tempat mencatat transaksi. Ada search bar produk, tombol scan barcode kamera (kanan kolom search), banner "Uang Modal Hari Ini" di bagian atas (hanya untuk Owner/Leader), dan grid produk. Di bagian bawah muncul floating bar "Lihat Keranjang" yang jika diketuk akan membuka sheet pembayaran (bisa pilih QRIS, Tunai, atau Transfer Bank).
  3. Tab "Inventaris": Menampilkan list katalog barang, status sisa stok, dan tombol tambah produk baru.
  4. Tab "Riwayat": Menampilkan list transaksi penjualan yang dikelompokkan per hari. Menampilkan ID transaksi, nama kasir/staf yang melayani, metode pembayaran, total transaksi, dan detail barang.
- Header Aplikasi (App Header) di bagian atas setiap halaman:
  - Sisi Kiri: Dropdown pilihan Cabang Outlet.
  - Sisi Kanan: Pilihan ikon "Tanya AI" (membuka halaman AiSelector untuk memilih spesialis asisten), ikon "Lonceng" (notifikasi), dan ikon "Gerigi" (Pengaturan).
- Halaman Chat AI (Tanya AI):
  - Di bagian bawah layar percakapan terdapat kolom input teks.
  - Di sudut bawah kiri kolom chat (sebelah kiri input teks), terdapat tombol **Scan Barcode** (ikon kamera/barcode). Jika ditap, kamera scanner barcode akan terbuka untuk memindai barcode fisik produk dan langsung memasukkannya ke dalam percakapan chat.
- Halaman Pengaturan (Settings):
  - Owner/Leader: Mengelola Langganan Premium, Outlet & Cabang (input target bulanan cabang), Pengguna & Role (karyawan), Printer POS Bluetooth, Threshold batas stok menipis, Kunci PIN keamanan, Pajak PPN, dan Keluar Akun.
  - Pegawai (Employee): Hanya menampilkan Pengaturan Printer POS, Bantuan CS WhatsApp, Tentang Platform, dan Keluar Akun.
- Hak Akses Role Pegawai (Employee):
  - Pegawai hanya bisa mengakses Tab "Kasir" dan "Inventaris" pada bottom nav bar (Tab "Ringkasan" dan "Riwayat" disembunyikan).
  - Pegawai tidak bisa mengakses tombol Chat AI jika role dibatasi (namun saat ini dibolehkan untuk panduan operasional saja).`;

    if (isEmployee) {
      systemPrompt = `Anda adalah AI Assistant Panduan Aplikasi Toko. Tugas Anda HANYA menjawab pertanyaan seputar panduan cara menggunakan aplikasi mobile Toko ReiPOS berdasarkan deskripsi layout berikut.

${mobileAppDescription}

Panduan operasional yang dapat Anda jelaskan:
1. Cara scan barang: Masuk ke tab "Kasir", ketuk ikon Scan/Kamera di bagian kanan kolom pencarian, lalu arahkan kamera ke barcode produk.
2. Cara tambah stok: Masuk ke tab "Inventaris", cari/pilih produk yang ingin disesuaikan stoknya, ketuk "Tambah Stok" atau "Edit", masukkan jumlah stok baru, lalu simpan.
3. Cara catat transaksi: Di tab "Kasir", pilih produk yang dibeli hingga masuk keranjang, ketuk floating bar "Lihat Keranjang" di bawah, pilih "Konfirmasi & Bayar", pilih metode pembayaran (QRIS, Tunai, atau Transfer), masukkan uang diterima jika tunai, dan ketuk "Proses/Simpan".

Aturan Kritis:
- JAWAB HANYA pertanyaan seputar panduan operasional penggunaan aplikasi berdasarkan layout di atas.
- JANGAN menjawab pertanyaan mengenai keuangan toko, laba, omzet, target penjualan, atau data rahasia toko lainnya. Jika ditanya hal tersebut, jawablah dengan sopan bahwa Anda hanya berwenang memberikan panduan penggunaan aplikasi untuk staff kasir.`;
      tools = [];
    } else {
      const skill = skillId ? AI_SKILLS.find(s => s.id === skillId) : undefined;
      const skillPrompt = skill ? `\n\n[Spesialisasi Kemampuan Anda]:\n${skill.systemPrompt}` : '';
      systemPrompt = `Anda adalah AI Business Assistant untuk Toko UMKM. Anda berkomunikasi melalui WhatsApp.
Tanggal hari ini adalah: ${todayFormatted}.${skillPrompt}

${mobileAppDescription}

Anda memiliki akses ke berbagai fungsi database untuk mengelola produk, mengecek penjualan, menganalisis stok, omzet, dan menyusun laporan.
Aturan penting:
1. Panggil fungsi/tool yang tepat jika user meminta data atau aksi tertentu.
2. Jika pengguna meminta tindakan seperti menambah produk atau merubah stok, tetapi informasi parameter penting belum ada (seperti nama, harga, stok, barcode/SKU, atau cabang toko tempat produk ditambahkan), lakukan slot-filling (tanyakan satu per satu secara ramah) sebelum memanggil fungsi tersebut.
3. Jawablah respon akhir dengan bahasa Indonesia yang santun, ramah, dan ringkas layaknya percakapan WhatsApp. Gunakan bullet point atau emoji untuk merapikan laporan. Jika pengguna bertanya cara menggunakan suatu fitur di aplikasi mobile, jelaskan navigasinya sesuai informasi layout di atas.
4. Pemilik/owner dapat memiliki beberapa cabang toko (outlet). Anda bisa mengambil data dari SEMUA cabang atau dari cabang tertentu saja dengan menyetel parameter 'allStores: true' or 'storeName' pada fungsi yang dipanggil. Tampilkan rincian (breakdown) per cabang jika pengguna meminta performa keseluruhan toko mereka.
5. Jika pengguna menanyakan omzet seluruh toko atau cabangnya, Anda wajib menampilkan rincian (breakdown) omzet masing-masing toko satu per satu (termasuk yang bernilai Rp 0) di respon akhir Anda secara transparan.
6. Jika pengguna mencari atau menanyakan stok suatu produk, dan nama produk di database (hasil pencarian/tool) mirip atau mendekati tetapi tidak sama persis (misal: pengguna mengetik "kopi abc kopi susu" sedangkan di database bernama "ABC Kopi Susu"), Anda WAJIB mengonfirmasi terlebih dahulu ke pengguna apakah benar "ABC Kopi Susu" yang mereka maksud sebelum membeberkan detail stoknya.
7. Jika pengguna menanyakan KPI, performa, atau rekapitulasi pegawai/kasir (terutama jika disetel 'allStores: true' atau ditanyakan per cabang), Anda WAJIB menyajikan data breakdown performa & omzet pegawai masing-masing cabang toko secara TERPISAH (per section/tabel tiap cabang), disusul dengan rangkuman/peringkat keseluruhan.
8. Prosedur Wajib Penambahan Produk Baru (createProduct):
   - Jika pengguna meminta untuk menambah produk baru (input produk baru), namun pengguna BELUM menyertakan barcode produk, Anda WAJIB menanyakan terlebih dahulu: "Apakah produk ini memiliki barcode fisik?"
   - Jika pengguna menjawab YA / memiliki barcode: Anda WAJIB memandu pengguna dengan pesan ramah: "Silakan pindai barcode produk Anda dengan menekan tombol **Scan Barcode** (ikon kamera/barcode) di **sudut bawah kiri kolom chat** ini." (JANGAN langsung memanggil fungsi createProduct sebelum barcode diberikan/di-scan).
   - Jika pengguna menjawab TIDAK / tidak punya barcode: Anda boleh langsung memanggil fungsi 'createProduct' tanpa memasukkan barcode (barcode diset kosong).
9. ATURAN INGATAN PARAMETER SLOT-FILLING (SANGAT KRITIS):
   - Saat mengumpulkan informasi bertahap (slot-filling) seperti penambahan produk baru ('createProduct') atau penyesuaian stok, Anda WAJIB selalu membaca ulang histori pesan pengguna sebelumnya untuk menggabungkan (mengakumulasikan) semua parameter yang telah diberikan (seperti nama produk, barcode, harga jual, harga modal/beli, stok awal, dan nama cabang toko).
   - JANGAN PERNAH menanyakan kembali parameter yang sudah pernah disebutkan pengguna di pesan-pesan sebelumnya.
   - Begitu seluruh parameter penting (nama, harga jual, harga modal/beli, stok awal, dan cabang toko) sudah lengkap terkumpul dari pesan-pesan sebelumnya, Anda WAJIB LANGSUNG memanggil fungsi 'createProduct' dengan menyertakan SELURUH parameter yang telah terkumpul tersebut!`;
      tools = this.getToolsDefinition(skill?.allowedTools);
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage },
    ];

    try {
      let run = true;
      let turns = 0;
      const maxTurns = 5;

      while (run && turns < maxTurns) {
        turns++;
        
        let response;
        let activeClient = this.geminiClient;
        const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
        let activeModel = geminiModel;

        if (!activeClient) {
          activeClient = this.deepseekClient;
          activeModel = deepseekModel;
        }

        try {
          if (!activeClient) {
            throw new Error('No active AI clients initialized.');
          }
          console.log(`Attempting AI call with model: ${activeModel}...`);
          response = await activeClient.chat.completions.create({
            model: activeModel,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
          });
        } catch (geminiError: any) {
          console.warn(`Primary AI client (${activeModel}) failed:`, geminiError.message || geminiError);
          
          if (activeClient === this.geminiClient && this.deepseekClient) {
            console.log(`Falling back to DeepSeek client (${deepseekModel})...`);
            activeClient = this.deepseekClient;
            activeModel = deepseekModel;
            
            try {
              response = await activeClient.chat.completions.create({
                model: activeModel,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
              });
            } catch (dsError: any) {
              const errMsg = dsError.message || '';
              // If deepseek-v4-flash is rejected by provider, try alternative model names
              if (errMsg.includes('supported API model names') || errMsg.includes('deepseek-chat')) {
                const altModel = errMsg.includes('deepseek-v4-pro') ? 'deepseek-v4-pro' : 'deepseek-chat';
                console.log(`Retrying DeepSeek call with alternative model: ${altModel}...`);
                response = await activeClient.chat.completions.create({
                  model: altModel,
                  messages,
                  tools: tools.length > 0 ? tools : undefined,
                  tool_choice: tools.length > 0 ? 'auto' : undefined,
                });
              } else {
                throw dsError;
              }
            }
          } else {
            throw geminiError;
          }
        }

        const choice = response.choices[0];
        const message = choice.message;

        messages.push(message); // Simpan respon model ke histori chat internal

        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const call = toolCall as any;
            if (call.type === 'function') {
              const name = call.function.name;
              const args = JSON.parse(call.function.arguments);

              console.log(`AI invoking tool: ${name} with args`, args);
              const toolResult = await this.executeTool(name, args, storeId);

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(toolResult),
              });
            }
          }
        } else {
          // AI tidak memanggil tool lagi, berarti sudah memberikan jawaban akhir
          run = false;
          return message.content || 'Maaf, saya tidak mengerti.';
        }
      }

      return 'Sesi percakapan AI melebihi batas pemrosesan.';
    } catch (error) {
      console.error('DeepSeek API Call Error:', error);
      return `Maaf, terjadi gangguan saat menghubungi asisten AI (DeepSeek Error: ${error.message}). Silakan periksa koneksi atau API Key Anda.`;
    }
  }

  // Simple Mock fallback for offline dev/no credentials
  private handleMockResponse(msg: string, skillId?: string, userRole?: string): string {
    const skill = skillId ? AI_SKILLS.find(s => s.id === skillId) : undefined;
    const skillPrefix = skill ? `${skill.emoji} *${skill.name} (MOCK)*\n\n` : '👋 *Halo dari AI Business Assistant (MOCK Mode)*\n\n';
    const text = msg.toLowerCase();
    
    if (userRole === 'employee') {
      if (text.includes('omzet') || text.includes('pendapatan') || text.includes('revenue') || text.includes('laba') || text.includes('target') || text.includes('untung')) {
        return `${skillPrefix}Maaf, asisten AI hanya berwenang memberikan panduan operasional penggunaan aplikasi (scan barang, tambah stok, catat transaksi) untuk staf kasir.`;
      }
      if (text.includes('scan') || text.includes('stok') || text.includes('transaksi') || text.includes('cara') || text.includes('panduan')) {
        return `${skillPrefix}Berikut panduan operasional penggunaan aplikasi:\n\n` +
          `1. *Scan Barang*: Masuk ke menu Kasir, tekan ikon Scan/Kamera di kanan kolom pencarian, arahkan ke barcode produk.\n` +
          `2. *Tambah Stok*: Buka menu Inventaris, pilih produk, lalu tekan tambah stok.\n` +
          `3. *Catat Transaksi*: Di menu Kasir, masukkan produk ke keranjang, tekan Bayar, pilih metode pembayaran (QRIS, Tunai, Transfer), lalu selesaikan pembayaran.`;
      }
      return `${skillPrefix}Halo! Saya di sini untuk memberikan panduan operasional penggunaan aplikasi (scan barang, tambah stok, catat transaksi). Ada yang bisa saya bantu?`;
    }

    if (text.includes('kpi') || text.includes('kinerja') || text.includes('pegawai') || text.includes('kasir')) {
      return `${skillPrefix}📊 *Rekap KPI & Performa Pegawai/Kasir Bulan Ini*:\n\n` +
        `1. 🥇 *Budi Santoso* (Kasir Jakarta)\n   • Total Omzet: *Rp 4.500.000* (65.2% kontribusi)\n   • Transaksi: *42 pesanan* (Rata-rata: Rp 107.142)\n\n` +
        `2. 🥈 *Siti Aminah* (Kasir Bandung)\n   • Total Omzet: *Rp 2.400.000* (34.8% kontribusi)\n   • Transaksi: *28 pesanan* (Rata-rata: Rp 85.714)\n\n` +
        `💡 *Rekomendasi HR*: Budi Santoso menunjukkan performa teratas bulan ini. Pertahankan pemberian insentif transaksi!`;
    }
    if (text.includes('target') || text.includes('capai') || text.includes('saran')) {
      return `${skillPrefix}Target bulan ini *Rp100 juta*.\n\nSaat ini baru tercapai *62%*.\n\nAnda membutuhkan rata-rata *Rp1,45 juta* per hari agar target tercapai.\n\nFokus menjual:\n- *Aqua*\n- *Indomie*\n- *Kopi ABC*\n\nKarena margin dan permintaannya tinggi.`;
    }
    if (text.includes('omzet') || text.includes('pendapatan') || text.includes('revenue')) {
      return `${skillPrefix}Total Omzet Hari Ini: *Rp132.000*\nJumlah Transaksi: *1*\n\n_(Catatan: AI berjalan dalam mode MOCK)_`;
    }
    if (text.includes('stok') && text.includes('tipis') || text.includes('habis') || text.includes('low')) {
      return `${skillPrefix}1. *Gula Pasir Kristal 1kg*: Sisa 4 pcs (Threshold: 10)\n2. *Minyak Goreng Sawit 2L*: Sisa 3 pcs (Threshold: 5)`;
    }
    if (text.includes('tambah') || text.includes('produk baru')) {
      return `${skillPrefix}Untuk menambah produk baru, silakan gunakan format:\n\`Nama: [Nama], Harga: [Harga], Stok: [Stok]\``;
    }
    return `${skillPrefix}Saya mendeteksi pesan Anda: "${msg}"\n\nUntuk mengaktifkan asisten pintar, mohon isikan *GEMINI_API_KEY* di file *.env* proyek backend Anda.`;
  }

  async getLowStockAnalysis(targetStoreIds: string[]) {
    // 1. Fetch all products in target stores
    const products = await this.prisma.product.findMany({
      where: { storeId: { in: targetStoreIds } },
      include: { store: true },
    });

    // 2. Fetch sales in last 7 days for these products
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        product: { storeId: { in: targetStoreIds } },
        order: {
          paymentStatus: 'PAID',
          createdAt: { gte: sevenDaysAgo },
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    // Map productId -> total quantity sold
    const salesMap = new Map<string, number>();
    for (const item of orderItems) {
      salesMap.set(item.productId, (salesMap.get(item.productId) || 0) + item.quantity);
    }

    const lowStockList = [];

    for (const p of products) {
      const salesInLast7Days = salesMap.get(p.id) || 0;
      
      let isLowStock = false;
      let reason = '';
      let daysRemaining = 9999;
      
      if (salesInLast7Days > 0) {
        const avgDailySales = salesInLast7Days / 7;
        daysRemaining = p.stock / avgDailySales;
        if (daysRemaining < 7) {
          isLowStock = true;
          reason = `Peminat tinggi: terjual ${salesInLast7Days} pcs dalam 7 hari terakhir (stok cukup untuk ~${Math.ceil(daysRemaining)} hari).`;
        }
      } else {
        // No sales in last 7 days
        if (p.stock === 0) {
          isLowStock = true;
          reason = 'Stok habis.';
        } else {
          // p.stock > 0, salesInLast7Days === 0
          // Sepi peminat, tidak dianggap low stock / menipis
        }
      }

      if (isLowStock) {
        lowStockList.push({
          id: p.id,
          storeId: p.storeId,
          storeName: p.store.name,
          name: p.name,
          barcode: p.barcode,
          stock: p.stock,
          salesInLast7Days,
          daysRemaining: daysRemaining === 9999 ? 'N/A' : Math.ceil(daysRemaining),
          reason,
        });
      }
    }

    return lowStockList;
  }
}
