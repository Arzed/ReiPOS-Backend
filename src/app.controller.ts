import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

// In-memory app version state (fallback configuration)
let appVersionState = {
  latestVersion: '1.0.3',
  minRequiredVersion: '1.0.3',
  updateUrl: 'https://is3.cloudhost.id/zone-mart/app-release.apk',
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
