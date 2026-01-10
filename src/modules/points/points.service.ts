import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GrantPointsDto } from './dto/grant-points.dto';
import { Prisma, LimitType } from '@prisma/client';
import { POINTS, PRODUCT_CARD_LIMITS } from '../../constants/points';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    referralUrl?: string,
  ) {
    // Use transaction to prevent race conditions
    // This ensures that checkDailyLimits and pointLog creation are atomic
    // If two requests try to award the same daily bonus simultaneously,
    // only one will succeed, the other will fail with BadRequestException
    return await this.prisma.$transaction(
      async (tx) => {
        // Check daily limits based on reason (within transaction)
        await this.checkDailyLimitsInTransaction(tx, userId, reason);

        // Create point log
        const pointLog = await tx.pointLog.create({
          data: {
            userId,
            points,
            reason,
            referralUrl,
          },
        });

        // Update user points
        await tx.user.update({
          where: { id: userId },
          data: {
            points: {
              increment: points,
            },
          },
        });

        return pointLog;
      },
    );
  }

  async grantPoints(grantPointsDto: GrantPointsDto, adminId: string) {
    const { userId, points, reason, note } = grantPointsDto;

    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can grant points');
    }

    return this.awardPoints(userId, points, reason, undefined);
  }

  async getPointsHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointLog.count({
        where: { userId },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPointsHistoryForAdmin(
    adminId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.getPointsHistory(userId, page, limit);
  }

  async getUserPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        _count: {
          select: {
            pointLogs: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      currentPoints: user.points,
      totalEarned: await this.getTotalEarnedPoints(userId),
      totalSpent: await this.getTotalSpentPoints(userId),
      totalActions: user._count.pointLogs,
    };
  }

  private async checkDailyLimits(userId: string, reason: string) {
    return this.checkDailyLimitsInTransaction(
      this.prisma,
      userId,
      reason,
    );
  }

  private async checkDailyLimitsInTransaction(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    reason: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLogs = await tx.pointLog.findMany({
      where: {
        userId,
        reason,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Business rules for daily limits
    const limits = {
      'Daily login bonus': 1,
      // 'Share post': 1, // Removed - share is now weekly limit only
      'Like post': 10, // Allow up to 10 likes per day
      'Unlike post': 10, // Allow up to 10 unlikes per day
      'Create post': 5, // Allow up to 5 posts per day
      'Challenge keep rhythm': 1, // Weekly limit handled separately
      'Challenge confession': 1, // Weekly limit handled separately
      'Invite friend': 2, // Weekly limit handled separately
    };

    const limit = limits[reason];
    if (limit && todayLogs.length >= limit) {
      throw new BadRequestException(`Daily limit reached for ${reason}`);
    }

    // Check weekly limits
    if (reason.includes('Challenge') || reason === 'Invite friend') {
      await this.checkWeeklyLimitsInTransaction(tx, userId, reason);
    }
  }

  private async checkWeeklyLimits(userId: string, reason: string) {
    return this.checkWeeklyLimitsInTransaction(
      this.prisma,
      userId,
      reason,
    );
  }

  private async checkWeeklyLimitsInTransaction(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    reason: string,
  ) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekLogs = await tx.pointLog.findMany({
      where: {
        userId,
        reason,
        createdAt: {
          gte: weekAgo,
        },
      },
    });

    const weeklyLimits = {
      'Challenge keep rhythm': 1,
      'Challenge confession': 1,
      'Invite friend': 2,
    };

    const limit = weeklyLimits[reason];
    if (limit && weekLogs.length >= limit) {
      throw new BadRequestException(`Weekly limit reached for ${reason}`);
    }
  }

  private async getTotalEarnedPoints(userId: string): Promise<number> {
    const result = await this.prisma.pointLog.aggregate({
      where: {
        userId,
        points: {
          gt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    return result._sum.points || 0;
  }

  private async getTotalSpentPoints(userId: string): Promise<number> {
    const result = await this.prisma.pointLog.aggregate({
      where: {
        userId,
        points: {
          lt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    return Math.abs(result._sum.points || 0);
  }

  /**
   * Process product card clicks and award points
   * @param userId User ID
   * @param clickCount Number of clicks to process
   * @returns Result with awarded clicks, points, and remaining clicks
   */
  async processProductCardClicks(
    userId: string,
    clickCount: number,
  ): Promise<{
    awardedClicks: number;
    totalPoints: number;
    remainingClicks: number;
    currentTotalClicks: number;
    maxClicks: number;
  }> {
    const LIFETIME_PERIOD = new Date('1970-01-01T00:00:00.000Z');
    const MAX_CLICKS = PRODUCT_CARD_LIMITS.LIFETIME_CLICK_LIMIT;
    const POINTS_PER_CLICK = POINTS.PRODUCT_CARD_CLICK;
    const REASON = 'Product card click';

    return await this.prisma.$transaction(async (tx) => {
      // Get current click count
      const currentLimit = await tx.userLimit.findUnique({
        where: {
          userId_limitType_period: {
            userId,
            limitType: LimitType.PRODUCT_CARD_CLICK,
            period: LIFETIME_PERIOD,
          },
        },
      });

      const currentClicks = currentLimit?.count || 0;
      const remainingClicks = Math.max(0, MAX_CLICKS - currentClicks);

      // Calculate how many clicks can be awarded
      const awardedClicks = Math.min(clickCount, remainingClicks);

      if (awardedClicks === 0) {
        return {
          awardedClicks: 0,
          totalPoints: 0,
          remainingClicks: 0,
          currentTotalClicks: currentClicks,
          maxClicks: MAX_CLICKS,
        };
      }

      const totalPoints = awardedClicks * POINTS_PER_CLICK;

      // Create point logs for each click
      const pointLogs = [];
      for (let i = 0; i < awardedClicks; i++) {
        const pointLog = await tx.pointLog.create({
          data: {
            userId,
            points: POINTS_PER_CLICK,
            reason: REASON,
          },
        });
        pointLogs.push(pointLog);
      }

      // Update user points
      await tx.user.update({
        where: { id: userId },
        data: {
          points: {
            increment: totalPoints,
          },
        },
      });

      // Update or create user limit
      await tx.userLimit.upsert({
        where: {
          userId_limitType_period: {
            userId,
            limitType: LimitType.PRODUCT_CARD_CLICK,
            period: LIFETIME_PERIOD,
          },
        },
        update: {
          count: {
            increment: awardedClicks,
          },
        },
        create: {
          userId,
          limitType: LimitType.PRODUCT_CARD_CLICK,
          period: LIFETIME_PERIOD,
          count: awardedClicks,
        },
      });

      const newCurrentClicks = currentClicks + awardedClicks;
      const newRemainingClicks = Math.max(0, MAX_CLICKS - newCurrentClicks);

      return {
        awardedClicks,
        totalPoints,
        remainingClicks: newRemainingClicks,
        currentTotalClicks: newCurrentClicks,
        maxClicks: MAX_CLICKS,
      };
    });
  }
}
