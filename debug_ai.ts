import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiService } from './src/ai/ai.service';
import { PrismaService } from './src/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);
  const prisma = app.get(PrismaService);

  const activeStore = await prisma.store.findFirst({ where: { name: { contains: "Bandung" } } });
  const storeId = activeStore?.id || "fallback-id";
  const query = "tampilkan semua produk di toko bandung";
  
  console.log(`Sending query to AI: "${query}"`);
  const response = await aiService.processMessage(storeId, query, []);
  console.log("AI Response:");
  console.log(response);

  await app.close();
}

main().catch(console.error);
