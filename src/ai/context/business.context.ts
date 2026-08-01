import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class BusinessContextService {
  constructor(private prisma: PrismaService) {}

  async getBusinessContext(ownerId: string, storeId?: string) {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      select: { id: true, name: true, location: true },
    });

    const activeStore = storeId
      ? stores.find((s) => s.id === storeId) || stores[0]
      : stores[0];

    return {
      ownerId,
      totalStores: stores.length,
      stores,
      activeStoreName: activeStore ? activeStore.name : 'Unknown Store',
      activeStoreId: activeStore ? activeStore.id : storeId,
      currentTime: new Date().toISOString(),
    };
  }
}
