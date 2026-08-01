import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('app/version')
  getAppVersion() {
    return {
      latestVersion: '1.1.0',
      minRequiredVersion: '1.0.0',
      updateUrl: 'https://reipos.id/download/app-latest.apk',
      releaseNotes: 'Fitur baru laporan performa kasir dan stabilitas transaksi.',
      forceUpdate: false,
    };
  }
}
