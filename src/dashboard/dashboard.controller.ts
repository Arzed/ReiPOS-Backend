import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(
    @Query('ownerId') ownerId: string,
    @Query('period') period?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.dashboardService.getSummary(ownerId, period, storeId);
  }
}
