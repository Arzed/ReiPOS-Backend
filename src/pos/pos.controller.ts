import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantService } from '../common/auth/tenant.service';
import type { UserTokenPayload } from '../common/auth/tenant.service';
import {
  CreateOrderDto,
  TambahStokDto,
  CreateProductDto,
  UpdateTaxDto,
  UpdateTargetDto,
  StartingCashDto,
  CreateEmployeeDto,
} from './dto/pos.dto';

@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(
    private posService: PosService,
    private tenantService: TenantService,
  ) {}

  @Get('products/lookup-barcode/:barcode')
  async lookupBarcode(
    @Param('barcode') barcode: string,
  ) {
    return this.posService.lookupBarcode(barcode);
  }

  @Get('products/barcode/:barcode')
  async getProductByBarcode(
    @CurrentUser() user: UserTokenPayload,
    @Param('barcode') barcode: string,
    @Query('storeId') storeId?: string,
  ) {
    if (storeId) {
      await this.tenantService.assertStoreAccess(user, storeId);
    }
    return this.posService.getProductByBarcode(barcode, storeId);
  }

  @Get('products')
  async getAllProducts(
    @CurrentUser() user: UserTokenPayload,
    @Query('storeId') storeId?: string,
  ) {
    const targetStoreIds = await this.tenantService.getAuthorizedStoreIds(user, storeId);
    return this.posService.getAllProducts(targetStoreIds);
  }

  @Post('orders')
  async createOrder(
    @CurrentUser() user: UserTokenPayload,
    @Body() dto: CreateOrderDto,
  ) {
    await this.tenantService.assertStoreAccess(user, dto.storeId);
    return this.posService.createOrder(
      dto.storeId,
      dto.items,
      dto.paymentMethod,
      dto.cashierId || user.ownerId,
      dto.cashierName,
    );
  }

  @Get('orders')
  async getOrders(
    @CurrentUser() user: UserTokenPayload,
    @Query('storeId') storeId?: string,
  ) {
    if (storeId) {
      await this.tenantService.assertStoreAccess(user, storeId);
      return this.posService.getOrders(storeId, user.ownerId);
    }
    return this.posService.getOrders(undefined, user.ownerId);
  }

  @Post('orders/:id/confirm-payment')
  async confirmPayment(
    @CurrentUser() user: UserTokenPayload,
    @Param('id') id: string,
  ) {
    const order = await this.posService.getOrderById(id);
    if (!order) {
      throw new NotFoundException('Order tidak ditemukan');
    }
    await this.tenantService.assertStoreAccess(user, order.storeId);
    return this.posService.confirmPayment(id);
  }

  @Post('products/tambah-stok')
  async tambahStok(
    @CurrentUser() user: UserTokenPayload,
    @Body() dto: TambahStokDto,
  ) {
    await this.tenantService.assertStoreAccess(user, dto.storeId);
    return this.posService.tambahStok(
      dto.storeId,
      dto.barcode,
      dto.additionalStock,
      dto.price,
      dto.costPrice,
      dto.discount,
    );
  }

  @Post('products')
  async createProduct(
    @CurrentUser() user: UserTokenPayload,
    @Body() dto: CreateProductDto,
  ) {
    await this.tenantService.assertStoreAccess(user, dto.storeId);
    return this.posService.createProduct(dto);
  }

  @Get('stores/:id/tax')
  async getStoreTax(
    @CurrentUser() user: UserTokenPayload,
    @Param('id') id: string,
  ) {
    await this.tenantService.assertStoreAccess(user, id);
    return this.posService.getStoreTax(id);
  }

  @Post('stores/:id/tax')
  async updateStoreTax(
    @CurrentUser() user: UserTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaxDto,
  ) {
    await this.tenantService.assertStoreAccess(user, id);
    return this.posService.updateStoreTax(id, dto.taxActive, dto.taxRate);
  }

  @Get('stores')
  async getStores(@CurrentUser() user: UserTokenPayload) {
    return this.posService.getStores(user.ownerId);
  }

  @Post('stores/:id/target')
  async updateStoreTarget(
    @CurrentUser() user: UserTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
  ) {
    await this.tenantService.assertStoreAccess(user, id);
    return this.posService.updateStoreTarget(id, dto.target);
  }

  @Post('starting-cash')
  async setStartingCash(
    @CurrentUser() user: UserTokenPayload,
    @Body() dto: StartingCashDto,
  ) {
    await this.tenantService.assertStoreAccess(user, dto.storeId);
    return this.posService.setStartingCash({
      ...dto,
      createdById: dto.createdById || user.ownerId,
      createdByName: dto.createdByName || user.email,
    });
  }

  @Get('starting-cash')
  async getStartingCash(
    @CurrentUser() user: UserTokenPayload,
    @Query('storeId') storeId: string,
    @Query('date') date: string,
  ) {
    await this.tenantService.assertStoreAccess(user, storeId);
    return this.posService.getStartingCash(storeId, date);
  }

  @Get('employee-kpi')
  async getEmployeeKPI(
    @CurrentUser() user: UserTokenPayload,
    @Query('storeId') storeId?: string,
    @Query('period') period?: string,
  ) {
    if (storeId) {
      await this.tenantService.assertStoreAccess(user, storeId);
    }
    return this.posService.getEmployeeKPI(storeId, period, user.ownerId);
  }

  @Post('employees')
  async createEmployee(
    @CurrentUser() user: UserTokenPayload,
    @Body() dto: CreateEmployeeDto,
  ) {
    await this.tenantService.assertStoreAccess(user, dto.storeId);
    return this.posService.createEmployee({
      ...dto,
      ownerId: user.ownerId,
    });
  }

  @Get('employees')
  async getEmployees(
    @CurrentUser() user: UserTokenPayload,
    @Query('storeId') storeId?: string,
  ) {
    if (storeId) {
      await this.tenantService.assertStoreAccess(user, storeId);
    }
    return this.posService.getEmployees(user.ownerId, storeId);
  }

  @Delete('employees/:id')
  async deleteEmployee(
    @CurrentUser() user: UserTokenPayload,
    @Param('id') id: string,
  ) {
    return this.posService.deleteEmployee(id, user.ownerId);
  }
}
