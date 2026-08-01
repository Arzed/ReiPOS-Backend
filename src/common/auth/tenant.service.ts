import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface UserTokenPayload {
  ownerId: string;
  storeId?: string;
  email: string;
}

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifies if a given storeId belongs to the authenticated owner (or employee's store).
   */
  async assertStoreAccess(user: UserTokenPayload, storeId: string): Promise<string> {
    if (!storeId) {
      throw new ForbiddenException('Store ID is required.');
    }

    // Check owner role / store relation
    const owner = await this.prisma.owner.findUnique({
      where: { id: user.ownerId },
      include: { stores: true },
    });

    if (!owner) {
      throw new ForbiddenException('User account not found.');
    }

    if (owner.role === 'employee') {
      if (owner.storeId !== storeId) {
        throw new ForbiddenException('Employee is not authorized to access this store.');
      }
      return storeId;
    }

    // Owner role check: ensure storeId belongs to owner
    const isOwned = owner.stores.some((s) => s.id === storeId);
    if (!isOwned) {
      throw new ForbiddenException('Store does not belong to this owner.');
    }

    return storeId;
  }

  /**
   * Resolves authorized store IDs for an owner/employee.
   */
  async getAuthorizedStoreIds(user: UserTokenPayload, requestedStoreId?: string): Promise<string[]> {
    const owner = await this.prisma.owner.findUnique({
      where: { id: user.ownerId },
      include: { stores: true },
    });

    if (!owner) {
      throw new ForbiddenException('User account not found.');
    }

    if (owner.role === 'employee') {
      return owner.storeId ? [owner.storeId] : [];
    }

    const allOwnedStoreIds = owner.stores.map((s) => s.id);

    if (requestedStoreId && requestedStoreId !== 'all') {
      if (!allOwnedStoreIds.includes(requestedStoreId)) {
        throw new ForbiddenException('Requested store does not belong to this owner.');
      }
      return [requestedStoreId];
    }

    return allOwnedStoreIds;
  }
}
