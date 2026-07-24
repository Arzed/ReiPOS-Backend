import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiService } from './src/ai/ai.service';
import { PrismaService } from './src/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);
  const prisma = app.get(PrismaService);

  const activeStore = await prisma.store.findFirst();
  const storeId = activeStore?.id || 'fallback-id';
  
  const query = 'Bagaimana rekap KPI dan performa penjualan masing-masing pegawai kasir bulan ini? Berikan analisis dan peringkatnya.';
  const skillId = 'hr_coach';
  const userRole = 'owner';
  
  console.log('====================================================');
  console.log('       DEBUG AI ASISTEN - KPI & PERFORMA PEGAWAI     ');
  console.log('====================================================');
  console.log(`Toko Active : ${activeStore?.name || 'Unknown'} (ID: ${storeId})`);
  console.log(`Skill ID    : ${skillId}`);
  console.log(`Role User   : ${userRole}`);
  console.log(`Query       : "${query}"\n`);
  
  const response = await aiService.processMessage(storeId, query, [], skillId, userRole);
  
  console.log('=================== RESPON AI ======================');
  console.log(response);
  console.log('====================================================');

  await app.close();
}

main().catch(console.error);
