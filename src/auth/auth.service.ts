import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
    const { name, ownerName, email, password, pin, whatsappNum } = data;

    // Check if owner already exists by email or whatsapp
    const existingOwner = await this.prisma.owner.findFirst({
      where: {
        OR: [
          { email },
          { whatsappNum },
        ],
      },
    });

    if (existingOwner) {
      throw new ConflictException('Email atau Nomor WhatsApp sudah terdaftar.');
    }

    // Hash password & pin
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create owner & default store
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.owner.create({
        data: {
          name: ownerName,
          email,
          password: hashedPassword,
          pin: hashedPin,
          whatsappNum,
        },
      });

      const store = await tx.store.create({
        data: {
          ownerId: owner.id,
          name: name || 'Toko Utama',
        },
      });

      return {
        message: 'Registrasi toko berhasil.',
        storeId: store.id,
        ownerId: owner.id,
      };
    });
  }

  async login(data: any) {
    const { email, password } = data;

    const owner = await this.prisma.owner.findUnique({
      where: { email },
      include: { stores: true, store: true },
    });

    if (!owner) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const isPasswordValid = await bcrypt.compare(password, owner.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    // Generate JWT token containing storeId of the first store and ownerId
    const firstStoreId = owner.role === 'employee' ? owner.storeId : owner.stores[0]?.id;
    const payload = { ownerId: owner.id, storeId: firstStoreId, email: owner.email };
    const token = this.jwtService.sign(payload);

    const resultStores = owner.role === 'employee' && owner.store
      ? [owner.store]
      : owner.stores;

    return {
      message: 'Login berhasil.',
      token,
      ownerId: owner.id,
      ownerName: owner.name,
      whatsappNum: owner.whatsappNum,
      role: owner.role,
      stores: resultStores.map(s => ({
        id: s.id,
        name: s.name,
        location: s.location || '',
      })),
    };
  }

  async verifyPin(ownerId: string, pin: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new UnauthorizedException('Pemilik tidak ditemukan.');
    }

    const isPinValid = await bcrypt.compare(pin, owner.pin);
    if (!isPinValid) {
      throw new UnauthorizedException('PIN salah.');
    }

    return {
      success: true,
      message: 'PIN berhasil diverifikasi.',
    };
  }
}
