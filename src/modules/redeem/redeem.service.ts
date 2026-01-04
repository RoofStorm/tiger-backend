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
    const { rewardId, receiverPhone, receiverEmail } = createRedeemDto;

    // Get user current points
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the reward
    console.log('🔍 Looking for reward with ID:', rewardId);
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });

    console.log('🔍 Reward found:', reward ? { id: reward.id, name: reward.name, isActive: reward.isActive } : 'null');

    if (!reward) {
      // List available rewards for debugging
      const availableRewards = await this.prisma.reward.findMany({
        select: { id: true, name: true, isActive: true },
        take: 10,
      });
      console.log('📋 Available rewards:', availableRewards);
      throw new NotFoundException(
        `Reward not found with ID: ${rewardId}. Available rewards: ${availableRewards.map((r) => r.id).join(', ')}`,
      );
    }

    if (!reward.isActive) {
      throw new BadRequestException('Reward is not available');
    }

    // SPECIAL CASE: Monthly Rank Winners for fixed vouchers
    if (rewardId === 'voucher-1000k' || rewardId === 'voucher-500k') {
      const requiredRank = rewardId === 'voucher-1000k' ? 1 : 2;
      
      const winnerRecord = await this.prisma.monthlyPostRanking.findFirst({
        where: { userId, rank: requiredRank },
      });

      if (winnerRecord) {
        // Check if already redeemed as winner (pointsUsed = 0)
        const alreadyRedeemedAsWinner = await this.prisma.redeemRequest.findFirst({
          where: {
            userId,
            rewardId,
            pointsUsed: 0,
            status: { not: RedeemStatus.REJECTED },
          },
        });

        if (!alreadyRedeemedAsWinner) {
          // Allow redemption for 0 points
          return await this.prisma.redeemRequest.create({
            data: {
              userId,
              rewardId,
              receiverPhone,
              receiverEmail,
              pointsUsed: 0,
              status: RedeemStatus.PENDING,
            },
          });
        }
      }
    }

    // Logic for Monthly Rank rewards (legacy/dynamic rewards)
    if (reward.rewardCategory === 'MONTHLY_RANK') {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Check if user is the winner of this specific reward
        const isWinner = await tx.monthlyPostRanking.findFirst({
          where: {
            userId,
            month: reward.month,
            rank: reward.rank,
          },
        });

        if (!isWinner) {
          throw new ForbiddenException(
            'You are not eligible for this monthly rank reward',
          );
        }

        // 2. Check if user has claimed ANY monthly rank reward before
        // This check inside transaction prevents race conditions
        const hasClaimedBefore = await tx.redeemRequest.findFirst({
          where: {
            userId,
            reward: {
              rewardCategory: 'MONTHLY_RANK',
            },
          },
        });

        if (hasClaimedBefore) {
          throw new BadRequestException(
            'You have already claimed a monthly rank reward. Each user can only claim once.',
          );
        }

        // Create redeem request for monthly rank (0 points)
        const redeemRequest = await tx.redeemRequest.create({
          data: {
            userId,
            rewardId,
            receiverPhone,
            receiverEmail,
            pointsUsed: 0,
            status: RedeemStatus.PENDING,
          },
        });

        return redeemRequest;
      });
    }

    // Check per-user limits for point rewards
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
        receiverPhone,
        receiverEmail,
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
    rejectionReason?: string,
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
      include: {
        user: true,
        reward: true,
      },
    });

    if (!redeem) {
      throw new NotFoundException('Redeem not found');
    }

    // If rejecting, require rejection reason
    if (status === 'REJECTED' && !rejectionReason) {
      throw new BadRequestException(
        'Rejection reason is required when rejecting a redeem request',
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      // Update redeem status
      const updatedRedeem = await prisma.redeemRequest.update({
        where: { id: redeemId },
        data: {
          status,
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        },
      });

      // If rejecting, refund points and limits
      if (status === 'REJECTED') {
        // Refund points to user
        await prisma.user.update({
          where: { id: redeem.userId },
          data: {
            points: {
              increment: redeem.pointsUsed,
            },
          },
        });

        // Create refund log
        await prisma.pointLog.create({
          data: {
            userId: redeem.userId,
            points: redeem.pointsUsed,
            reason: `Refund for rejected redeem: ${redeem.reward.name} - ${rejectionReason}`,
          },
        });

        // Refund life points if applicable
        if (redeem.reward.lifeRequired && redeem.reward.lifeRequired > 0) {
          // For life points, we need to increment the user's life points
          // Since we don't have a life points field, we'll create a special log entry
          await prisma.pointLog.create({
            data: {
              userId: redeem.userId,
              points: redeem.reward.lifeRequired * 1000, // Convert life points to energy points for refund
              reason: `Refund life points for rejected redeem: ${redeem.reward.name} - ${rejectionReason}`,
            },
          });
        }

        // Refund user limits (increment maxPerUser count)
        // Note: Since we don't have a specific REDEEM limit type, we'll skip this for now
        // In a real implementation, you might want to add a REDEEM limit type to track per-reward limits
      }

      return updatedRedeem;
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
