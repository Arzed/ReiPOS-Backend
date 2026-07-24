import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class WhatsappService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async handleIncomingMessage(from: string, body: string, sessionStoreId?: string, skillId?: string): Promise<string> {
    // 1. Find owner associated with the sender's whatsapp number
    let owner = await this.prisma.owner.findUnique({
      where: { whatsappNum: from },
      include: { stores: true },
    });

    let storeId: string;

    if (sessionStoreId && sessionStoreId !== 'all') {
      storeId = sessionStoreId;
    } else if (owner && owner.stores.length > 0) {
      // Use the first outlet by default for the session
      storeId = owner.stores[0].id;
    } else {
      // Fallback: If no owner/store exists, use the first available store in the DB
      const fallbackStore = await this.prisma.store.findFirst();
      if (!fallbackStore) {
        return 'Maaf, sistem tidak menemukan toko aktif terdaftar. Silakan lakukan setup database terlebih dahulu.';
      }
      storeId = fallbackStore.id;
    }

    // 2. Retrieve session history from DB (last 20 most recent messages)
    const dbMessagesDesc = await (this.prisma as any).chatMessage.findMany({
      where: { phone: from, skillId: skillId || null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const dbMessages = dbMessagesDesc.reverse();

    const history = dbMessages.map((m: any) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // 3. Process the message via AI Service
    const userRole = owner ? owner.role : 'owner';
    const reply = await this.aiService.processMessage(storeId, body, history, skillId, userRole);

    // 4. Save history to DB
    await (this.prisma as any).chatMessage.create({
      data: { phone: from, skillId: skillId || null, role: 'user', content: body }
    });
    await (this.prisma as any).chatMessage.create({
      data: { phone: from, skillId: skillId || null, role: 'assistant', content: reply }
    });

    return reply;
  }

  // Get chat history
  async getHistory(from: string, skillId?: string) {
    const dbMessages = await (this.prisma as any).chatMessage.findMany({
      where: { phone: from, skillId: skillId || null },
      orderBy: { createdAt: 'asc' },
    });
    return dbMessages.map((m: any) => ({
      text: m.content,
      isMe: m.role === 'user',
      time: m.createdAt,
    }));
  }

  // Clear chat history for testing
  async clearSession(from: string, skillId?: string) {
    await (this.prisma as any).chatMessage.deleteMany({
      where: { phone: from, skillId: skillId || null }
    });
  }
}
