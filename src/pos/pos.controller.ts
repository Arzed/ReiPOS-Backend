import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PosService } from './pos.service';

@Controller('pos')
export class PosController {
  constructor(private posService: PosService) {}

  @Get('products/barcode/:barcode')
  async getProductByBarcode(@Param('barcode') barcode: string) {
    return this.posService.getProductByBarcode(barcode);
  }

  @Get('products')
  async getAllProducts(@Query('storeId') storeId?: string) {
    return this.posService.getAllProducts(storeId);
  }

  @Post('orders')
  async createOrder(
    @Body() body: {
      storeId: string;
      items: { productId: string; quantity: number }[];
      paymentMethod?: string;
      cashierId?: string;
      cashierName?: string;
    },
  ) {
    return this.posService.createOrder(
      body.storeId,
      body.items,
      body.paymentMethod,
      body.cashierId,
      body.cashierName,
    );
  }

  @Get('orders')
  async getOrders(
    @Query('storeId') storeId?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.posService.getOrders(storeId, ownerId);
  }

  @Post('orders/:id/confirm-payment')
  async confirmPayment(@Param('id') id: string) {
    return this.posService.confirmPayment(id);
  }

  @Post('products/tambah-stok')
  async tambahStok(
    @Body() body: {
      storeId: string;
      barcode: string;
      additionalStock?: number;
      price?: number;
      costPrice?: number;
    },
  ) {
    return this.posService.tambahStok(
      body.storeId,
      body.barcode,
      body.additionalStock,
      body.price,
      body.costPrice,
    );
  }

  @Post('products')
  async createProduct(
    @Body() body: {
      storeId: string;
      name: string;
      barcode?: string | null;
      price: number;
      costPrice?: number;
      discount?: number;
      stock: number;
    },
  ) {
    return this.posService.createProduct(body);
  }

  @Get('stores/:id/tax')
  async getStoreTax(@Param('id') id: string) {
    return this.posService.getStoreTax(id);
  }

  @Post('stores/:id/tax')
  async updateStoreTax(
    @Param('id') id: string,
    @Body() body: { taxActive: boolean; taxRate: number },
  ) {
    return this.posService.updateStoreTax(id, body.taxActive, body.taxRate);
  }

  @Get('stores')
  async getStores(@Query('ownerId') ownerId: string) {
    return this.posService.getStores(ownerId);
  }

  @Post('stores/:id/target')
  async updateStoreTarget(
    @Param('id') id: string,
    @Body() body: { target: number },
  ) {
    return this.posService.updateStoreTarget(id, body.target);
  }

  @Post('starting-cash')
  async setStartingCash(
    @Body() body: {
      storeId: string;
      amount: number;
      date: string;
      createdById: string;
      createdByName: string;
    },
  ) {
    return this.posService.setStartingCash(body);
  }

  @Get('starting-cash')
  async getStartingCash(
    @Query('storeId') storeId: string,
    @Query('date') date: string,
  ) {
    return this.posService.getStartingCash(storeId, date);
  }

  @Get('employee-kpi')
  async getEmployeeKPI(
    @Query('storeId') storeId?: string,
    @Query('period') period?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.posService.getEmployeeKPI(storeId, period, ownerId);
  }
}
