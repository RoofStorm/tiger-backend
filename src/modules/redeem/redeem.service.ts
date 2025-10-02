import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CreateRedeemDto } from './dto/create-redeem.dto';
import { RedeemStatus } from '@prisma/client';

@Injectable()
export class RedeemService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async createRedeem(createRedeemDto: CreateRedeemDto, userId: string) {
    const { giftCode, receiverInfo, payWith } = createRedeemDto;

    // Get user current points
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Define gift codes and their costs
    const giftCodes = {
      'voucher50k': { points: 1000, life: 1, maxPerUser: 3 },
      'voucher100k': { points: 2000, life: 2, maxPerUser: 2 },
      'voucher200k': { points: 4000, life: 4, maxPerUser: 1 },
      'premium1month': { points: 5000, life: 5, maxPerUser: 1 },
    };

    const gift = giftCodes[giftCode];
    if (!gift) {
      throw new BadRequestException('Invalid gift code');
    }

    // Check per-user limits
    await this.checkUserRedeemLimits(userId, giftCode, gift.maxPerUser);

    // Calculate cost based on payment method
    const costPoints = payWith === 'points' ? gift.points : 0;
    const costLife = payWith === 'life' ? gift.life : null;

    // Check if user has enough points/life
    if (payWith === 'points' && user.points < costPoints) {
      throw new BadRequestException('Insufficient points');
    }

    if (payWith === 'life') {
      const userLife = Math.floor(user.points / 1000);
      if (userLife < costLife) {
        throw new BadRequestException('Insufficient life points');
      }
    }

    // Create redeem log
    const redeemLog = await this.prisma.redeemLog.create({
      data: {
        userId,
        giftCode,
        costPoints,
        costLife,
        status: RedeemStatus.PENDING,
        receiverInfo: receiverInfo as any,
      },
    });

    // Deduct points if paying with points
    if (payWith === 'points') {
      await this.pointsService.awardPoints(
        userId,
        -costPoints,
        `Redeem ${giftCode}`,
      );
    } else if (payWith === 'life') {
      // Convert life to points and deduct
      const lifePoints = costLife * 1000;
      await this.pointsService.awardPoints(
        userId,
        -lifePoints,
        `Redeem ${giftCode} (life)`,
      );
    }

    return redeemLog;
  }

  async getUserRedeems(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [redeems, total] = await Promise.all([
      this.prisma.redeemLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.redeemLog.count({
        where: { userId },
      }),
    ]);

    return {
      redeems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateRedeemStatus(
    redeemId: string,
    status: RedeemStatus,
    adminId: string,
  ) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update redeem status');
    }

    const redeem = await this.prisma.redeemLog.findUnique({
      where: { id: redeemId },
    });

    if (!redeem) {
      throw new NotFoundException('Redeem not found');
    }

    return this.prisma.redeemLog.update({
      where: { id: redeemId },
      data: { status },
    });
  }

  async getAllRedeems(page = 1, limit = 20, status?: RedeemStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [redeems, total] = await Promise.all([
      this.prisma.redeemLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.redeemLog.count({ where }),
    ]);

    return {
      redeems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async checkUserRedeemLimits(
    userId: string,
    giftCode: string,
    maxPerUser: number,
  ) {
    const userRedeems = await this.prisma.redeemLog.count({
      where: {
        userId,
        giftCode,
        status: {
          in: [RedeemStatus.PENDING, RedeemStatus.APPROVED, RedeemStatus.DELIVERED],
        },
      },
    });

    if (userRedeems >= maxPerUser) {
      throw new BadRequestException(
        `You have reached the maximum limit for ${giftCode}`,
      );
    }
  }
}

