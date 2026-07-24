import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as QRCode from 'qrcode';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  async getProductByBarcode(barcode: string, storeId?: string) {
    const product = await this.prisma.product.findFirst({
      where: storeId ? { storeId, barcode } : { barcode },
    });
    if (!product) {
      throw new NotFoundException(`Produk dengan barcode ${barcode} tidak ditemukan`);
    }
    return product;
  }

  async getAllProducts(storeId?: string) {
    return this.prisma.product.findMany({
      where: storeId ? { storeId } : undefined,
    });
  }

  async createOrder(
    storeId: string,
    items: { productId: string; quantity: number }[],
    paymentMethod = 'QRIS',
    cashierId?: string,
    cashierName?: string,
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Resolve store
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${storeId} not found`);
    }

    let totalAmount = 0;
    let totalProfit = 0;
    const orderItemsData = [];

    // Calculate totals
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ID ${item.productId} not found`);
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }

      totalAmount += product.price * item.quantity;
      totalProfit += (product.price - product.costPrice) * item.quantity;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    // Save order in database with PENDING status
    const order = await this.prisma.order.create({
      data: {
        storeId,
        totalAmount,
        totalProfit,
        paymentStatus: 'PENDING',
        paymentMethod: paymentMethod,
        cashierId: cashierId || null,
        cashierName: cashierName || null,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Generate simulated QRIS data URI
    // The QR data encodes transaction info: orderId and amount
    const qrisRawData = `qris://ai-commerce/pay?orderId=${order.id}&amount=${totalAmount}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrisRawData);
    } catch (err) {
      console.error('Failed to generate QR Code', err);
    }

    return {
      order,
      qrisRawData,
      qrDataUrl, // Base64 data URL
    };
  }

  async confirmPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ID ${orderId} not found`);
    }

    if (order.paymentStatus === 'PAID') {
      return order;
    }

    // Start transaction to update status & deduct stocks
    return this.prisma.$transaction(async (tx) => {
      // Deduct stocks
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Product ID ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(`Stock depleted for ${product.name} during payment processing.`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: product.stock - item.quantity,
          },
        });
      }

      // Update status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return updatedOrder;
    });
  }

  async getOrders(storeId?: string, ownerId?: string) {
    let whereClause: any = {};

    if (storeId && storeId !== 'all') {
      whereClause.storeId = storeId;
    } else if (ownerId) {
      whereClause.store = { ownerId };
    }

    return this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async tambahStok(
    storeId: string,
    barcode: string,
    additionalStock?: number,
    price?: number,
    costPrice?: number,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { storeId, barcode },
    });

    if (!product) {
      throw new NotFoundException(`Product with barcode ${barcode} not found in this store`);
    }

    const dataToUpdate: any = {};
    if (price !== undefined && price !== null) dataToUpdate.price = price;
    if (costPrice !== undefined && costPrice !== null) dataToUpdate.costPrice = costPrice;
    if (additionalStock !== undefined && additionalStock !== null && additionalStock > 0) {
      dataToUpdate.stock = product.stock + additionalStock;
    }

    return this.prisma.product.update({
      where: { id: product.id },
      data: dataToUpdate,
    });
  }

  async createProduct(data: {
    storeId: string;
    name: string;
    barcode?: string | null;
    price: number;
    costPrice?: number;
    discount?: number;
    stock: number;
  }) {
    // Normalize empty barcode to null
    const barcode =
      data.barcode && data.barcode.trim() !== '' ? data.barcode.trim() : null;

    // Verify the store exists (storeId may be stale after a DB reset / re-login)
    const storeExists = await this.prisma.store.findUnique({
      where: { id: data.storeId },
    });
    if (!storeExists) {
      throw new NotFoundException(
        `Toko dengan ID "${data.storeId}" tidak ditemukan. Silakan logout dan login ulang.`,
      );
    }

    // Check for duplicate barcode within the same store (only if barcode provided)
    if (barcode) {
      const existing = await this.prisma.product.findFirst({
        where: { storeId: data.storeId, barcode },
      });
      if (existing) {
        throw new BadRequestException(
          `Produk dengan barcode "${barcode}" sudah ada di toko ini`,
        );
      }
    }


    return this.prisma.product.create({
      data: {
        storeId: data.storeId,
        name: data.name,
        barcode,          // null is fine — @@unique([storeId, barcode]) allows multiple nulls
        price: data.price,
        costPrice: data.costPrice ?? Math.round(data.price * 0.7),
        discount: data.discount ?? 0,
        stock: data.stock,
      },
    });
  }

  async getStoreTax(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { taxActive: true, taxRate: true },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return store;
  }

  async updateStoreTax(id: string, taxActive: boolean, taxRate: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return this.prisma.store.update({
      where: { id },
      data: { taxActive, taxRate },
      select: { id: true, taxActive: true, taxRate: true },
    });
  }

  async getStores(ownerId: string) {
    return this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { name: 'asc' },
    });
  }

  async updateStoreTarget(id: string, target: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return this.prisma.store.update({
      where: { id },
      data: { target },
    });
  }

  async setStartingCash(data: {
    storeId: string;
    amount: number;
    date: string;
    createdById: string;
    createdByName: string;
  }) {
    const user = await this.prisma.owner.findUnique({
      where: { id: data.createdById },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${data.createdById} not found`);
    }

    if (user.role !== 'owner' && user.role !== 'leader') {
      throw new BadRequestException('Only owner and leader can set starting cash');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: data.storeId },
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${data.storeId} not found`);
    }

    return this.prisma.startingCash.upsert({
      where: {
        storeId_date: {
          storeId: data.storeId,
          date: data.date,
        },
      },
      update: {
        amount: data.amount,
        createdById: data.createdById,
        createdByName: data.createdByName,
      },
      create: {
        storeId: data.storeId,
        amount: data.amount,
        date: data.date,
        createdById: data.createdById,
        createdByName: data.createdByName,
      },
    });
  }

  async getStartingCash(storeId: string, date: string) {
    return this.prisma.startingCash.findUnique({
      where: {
        storeId_date: {
          storeId,
          date,
        },
      },
    });
  }

  async getEmployeeKPI(storeId?: string, period: string = 'monthly', ownerId?: string) {
    let targetStoreIds: string[] = [];

    if (storeId && storeId !== 'all') {
      targetStoreIds = [storeId];
    } else if (ownerId) {
      const stores = await this.prisma.store.findMany({ where: { ownerId } });
      targetStoreIds = stores.map((s) => s.id);
    } else {
      const stores = await this.prisma.store.findMany({ take: 10 });
      targetStoreIds = stores.map((s) => s.id);
    }

    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else {
      // monthly (default)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orders = await this.prisma.order.findMany({
      where: {
        storeId: { in: targetStoreIds },
        paymentStatus: 'PAID',
        createdAt: { gte: startDate },
      },
    });

    const storeTotalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    const statsMap: Record<
      string,
      {
        cashierId: string | null;
        cashierName: string;
        totalTransactions: number;
        totalRevenue: number;
        totalProfit: number;
      }
    > = {};

    for (const o of orders) {
      const name = o.cashierName || 'Owner/Kasir';
      if (!statsMap[name]) {
        statsMap[name] = {
          cashierId: o.cashierId || null,
          cashierName: name,
          totalTransactions: 0,
          totalRevenue: 0,
          totalProfit: 0,
        };
      }
      statsMap[name].totalTransactions += 1;
      statsMap[name].totalRevenue += o.totalAmount;
      statsMap[name].totalProfit += o.totalProfit;
    }

    const result = Object.values(statsMap).map((item) => {
      const percentage = storeTotalRevenue > 0 ? (item.totalRevenue / storeTotalRevenue) * 100 : 0;
      const avgValue = item.totalTransactions > 0 ? item.totalRevenue / item.totalTransactions : 0;
      return {
        ...item,
        avgTransactionValue: Math.round(avgValue),
        percentage: parseFloat(percentage.toFixed(1)),
      };
    });

    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      period,
      totalStoreRevenue: storeTotalRevenue,
      totalOrders: orders.length,
      cashierKpis: result,
    };
  }
}
