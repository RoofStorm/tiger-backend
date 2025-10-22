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
    const { rewardId, receiverName, receiverPhone, receiverAddress } =
      createRedeemDto;

    // Get user current points
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the reward
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    if (!reward.isActive) {
      throw new BadRequestException('Reward is not available');
    }

    // Check per-user limits
    if (reward.maxPerUser) {
      await this.checkUserRedeemLimits(userId, rewardId, reward.maxPerUser);
    }

    // Calculate cost based on reward requirements
    const costPoints = reward.pointsRequired;
    const costLife = reward.lifeRequired;

    // Check if user has enough points/life
    if (costPoints > 0 && user.points < costPoints) {
      throw new BadRequestException(
        `Insufficient points. You need ${costPoints} points but have ${user.points}`,
      );
    }

    if (costLife && costLife > 0) {
      const userLife = Math.floor(user.points / 1000);
      if (userLife < costLife) {
        throw new BadRequestException(
          `Insufficient life points. You need ${costLife} life points but have ${userLife}`,
        );
      }
    }

    // Create redeem request
    const redeemRequest = await this.prisma.redeemRequest.create({
      data: {
        userId,
        rewardId,
        receiverName,
        receiverPhone,
        receiverAddress,
        pointsUsed: costPoints,
        status: RedeemStatus.PENDING,
      },
    });

    // Deduct points
    if (costPoints > 0) {
      await this.pointsService.awardPoints(
        userId,
        -costPoints,
        `Redeem ${reward.name}`,
      );
    }

    return redeemRequest;
  }

  async getUserRedeems(userId: string, page = 1, limit = 20) {
    try {
      console.log('🔍 RedeemService.getUserRedeems called');
      console.log('🔍 User ID:', userId);
      console.log('🔍 Page:', page, 'Limit:', limit);

      const skip = (page - 1) * limit;

      console.log('🔍 Querying redeem requests...');
      const [redeems, total] = await Promise.all([
        this.prisma.redeemRequest.findMany({
          where: { userId },
          include: {
            reward: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.redeemRequest.count({
          where: { userId },
        }),
      ]);

      console.log('🔍 Found redeems:', redeems.length);
      console.log('🔍 Total count:', total);

      return {
        redeems,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('❌ Error in RedeemService.getUserRedeems:', error);
      throw error;
    }
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

    const redeem = await this.prisma.redeemRequest.findUnique({
      where: { id: redeemId },
    });

    if (!redeem) {
      throw new NotFoundException('Redeem not found');
    }

    return this.prisma.redeemRequest.update({
      where: { id: redeemId },
      data: { status },
    });
  }

  async getAllRedeems(
    page = 1,
    limit = 20,
    status?: RedeemStatus,
    adminId?: string,
  ) {
    try {
      // Check admin role if adminId provided
      if (adminId) {
        const admin = await this.prisma.user.findUnique({
          where: { id: adminId },
        });

        if (!admin || admin.role !== 'ADMIN') {
          throw new ForbiddenException('Only admins can view all redeems');
        }
      }

      // Convert string parameters to numbers
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

      const skip = (pageNum - 1) * limitNum;
      const where = status ? { status } : {};

      const [redeems, total] = await Promise.all([
        this.prisma.redeemRequest.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            reward: {
              select: {
                id: true,
                name: true,
                description: true,
                pointsRequired: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.prisma.redeemRequest.count({ where }),
      ]);

      return {
        redeems,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('getAllRedeems error:', error);
      throw error;
    }
  }

  private async checkUserRedeemLimits(
    userId: string,
    rewardId: string,
    maxPerUser: number,
  ) {
    const userRedeems = await this.prisma.redeemRequest.count({
      where: {
        userId,
        rewardId,
        status: {
          in: [
            RedeemStatus.PENDING,
            RedeemStatus.APPROVED,
            RedeemStatus.DELIVERED,
          ],
        },
      },
    });

    if (userRedeems >= maxPerUser) {
      throw new BadRequestException(
        `You have reached the maximum limit for this reward`,
      );
    }
  }
}
