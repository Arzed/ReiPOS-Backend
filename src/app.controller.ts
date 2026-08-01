import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

// In-memory app version state (fallback configuration)
let appVersionState = {
  latestVersion: '1.0.2',
  minRequiredVersion: '1.0.2',
  updateUrl: 'https://reipos-backend-production.up.railway.app/download/app-release.apk',
  releaseNotes: 'Fitur baru laporan performa kasir dan peningkatan performa sistem.',
  forceUpdate: false,
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('app/version')
  getAppVersion() {
    return appVersionState;
  }

  @UseGuards(JwtAuthGuard)
  @Post('app/version')
  updateAppVersion(@Body() body: Partial<typeof appVersionState>) {
    appVersionState = {
      ...appVersionState,
      ...body,
    };
    return {
      message: 'Versi aplikasi Android berhasil diperbarui di backend.',
      data: appVersionState,
    };
  }
}
