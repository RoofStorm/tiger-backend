import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private prisma: PrismaService) {}

  async getAllRewards(
    page = 1,
    limit = 20,
    isActive?: boolean,
    userId?: string,
  ) {
    // Convert string parameters to numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const skip = (pageNum - 1) * limitNum;

    const where = isActive !== undefined ? { isActive } : {};

    const [rewards, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reward.count({ where }),
    ]);

    // Enhanced rewards with canRedeem status if userId is provided
    let enhancedRewards = rewards.map(r => ({ ...r, canRedeem: false }));

    // Get user data if userId is provided
    let userData = null;
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            points: true,
            redeemRequests: {
              include: {
                reward: true
              }
            },
            monthlyRankings: true,
          },
        });

        if (user) {
          userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            points: user.points,
            lifePoints: Math.floor(user.points / 1000),
            redeemRequests: user.redeemRequests.map(rr => ({
              id: rr.id,
              rewardId: rr.rewardId,
              status: rr.status
            })),
          };

          // Calculate canRedeem for each reward
          const hasClaimedMonthlyRank = user.redeemRequests.some(
            rr => rr.reward.rewardCategory === 'MONTHLY_RANK'
          );

          enhancedRewards = rewards.map(reward => {
            let canRedeem = false;

            // SPECIAL CASE: Monthly Rank Winners for fixed vouchers
            if (reward.id === 'voucher-1000k') {
              const isRank1Winner = user.monthlyRankings.some(mr => mr.rank === 1);
              const hasAlreadyRedeemedAsWinner = user.redeemRequests.some(
                rr => rr.rewardId === 'voucher-1000k' && rr.pointsUsed === 0 && rr.status !== 'REJECTED'
              );
              
              if (isRank1Winner && !hasAlreadyRedeemedAsWinner) {
                canRedeem = true;
              }
            } else if (reward.id === 'voucher-500k') {
              const isRank2Winner = user.monthlyRankings.some(mr => mr.rank === 2);
              const hasAlreadyRedeemedAsWinner = user.redeemRequests.some(
                rr => rr.rewardId === 'voucher-500k' && rr.pointsUsed === 0 && rr.status !== 'REJECTED'
              );
              
              if (isRank2Winner && !hasAlreadyRedeemedAsWinner) {
                canRedeem = true;
              }
            }

            // If not already set by winner logic, use standard logic
            if (!canRedeem) {
              if (reward.rewardCategory === 'MONTHLY_RANK') {
                // Rule for Monthly Rank:
                // 1. Must be in MonthlyPostRanking for this month and rank
                // 2. Must not have claimed any monthly rank reward before
                const isWinner = user.monthlyRankings.some(
                  mr => mr.month.getTime() === reward.month?.getTime() && mr.rank === reward.rank
                );
                canRedeem = isWinner && !hasClaimedMonthlyRank && reward.isActive;
              } else {
                // Rule for Point rewards:
                // 1. Enough points
                // 2. Within per-user limit
                const userRedeemsCount = user.redeemRequests.filter(
                  rr => rr.rewardId === reward.id && rr.status !== 'REJECTED'
                ).length;
                
                const enoughPoints = user.points >= reward.pointsRequired;
                const withinLimit = reward.maxPerUser ? userRedeemsCount < reward.maxPerUser : true;
                
                canRedeem = enoughPoints && withinLimit && reward.isActive;
              }
            }

            return { ...reward, canRedeem };
          });
        }
      } catch (error) {
        this.logger.error('Error fetching user data:', error);
      }
    }

    // If no user data, provide default values
    if (!userData) {
      userData = {
        id: null,
        name: null,
        email: null,
        points: 0,
        lifePoints: 0,
        redeemRequests: [],
      };
    }

    return {
      data: enhancedRewards,
      user: userData,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async getRewardById(id: string) {
    try {
      this.logger.debug('Getting reward by ID:', id);

      const reward = await this.prisma.reward.findUnique({
        where: { id },
      });

      this.logger.debug('Reward found:', reward);

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      return reward;
    } catch (error) {
      this.logger.error('Error in getRewardById:', error);
      throw error;
    }
  }

  async createReward(createRewardDto: any, userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create rewards');
    }

    return this.prisma.reward.create({
      data: createRewardDto,
    });
  }

  async updateReward(id: string, updateRewardDto: any, userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update rewards');
    }

    // Check if reward exists
    const reward = await this.prisma.reward.findUnique({
      where: { id },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    return this.prisma.reward.update({
      where: { id },
      data: updateRewardDto,
    });
  }

  async deleteReward(id: string, userId: string) {
    try {
      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== 'ADMIN') {
        throw new ForbiddenException('Only admins can delete rewards');
      }

      // Check if reward exists
      const reward = await this.prisma.reward.findUnique({
        where: { id },
      });

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      // Check if reward is already inactive
      if (!reward.isActive) {
        throw new BadRequestException('Reward is already inactive');
      }

      // Soft delete: mark as inactive instead of deleting
      const result = await this.prisma.reward.update({
        where: { id },
        data: { isActive: false },
      });

      return result;
    } catch (error) {
      this.logger.error('SoftDeleteReward - Error:', error);
      throw error;
    }
  }
}
