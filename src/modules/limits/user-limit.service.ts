import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { LimitType } from '@prisma/client';
import {
  POINTS,
  // REFERRAL_LIMITS, // Disabled - no points for referrals
  POST_LIMITS,
  WISH_LIMITS,
  SHARE_LIMITS,
} from '../../constants/points';

@Injectable()
export class UserLimitService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  // Helper to get the start of the current week (Monday)
  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Helper to get today's date (YYYY-MM-DD)
  private getTodayDate(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Get period based on limit type
  private getPeriod(limitType: LimitType): Date {
    switch (limitType) {
      case LimitType.POST_WEEKLY:
      case LimitType.WISH_WEEKLY:
      case LimitType.SHARE_WEEKLY:
        return this.getWeekStart();
      default:
        throw new Error(`Unknown limit type: ${limitType}`);
    }
  }

  // Check if user can receive bonus for a specific limit type
  async canReceiveBonus(
    userId: string,
    limitType: LimitType,
  ): Promise<boolean> {
    const period = this.getPeriod(limitType);

    const currentLimit = await this.prisma.userLimit.findUnique({
      where: {
        userId_limitType_period: {
          userId,
          limitType,
          period,
        },
      },
    });

    const currentCount = currentLimit?.count || 0;

    // Get limit based on type
    let maxCount: number;
    switch (limitType) {
      case LimitType.POST_WEEKLY:
        maxCount = POST_LIMITS.WEEKLY_POST_POINTS_LIMIT;
        break;
      case LimitType.WISH_WEEKLY:
        maxCount = WISH_LIMITS.WEEKLY_WISH_POINTS_LIMIT;
        break;
      case LimitType.SHARE_WEEKLY:
        maxCount = SHARE_LIMITS.WEEKLY_SHARE_POINTS_LIMIT;
        break;
      default:
        throw new Error(`Unknown limit type: ${limitType}`);
    }

    return currentCount < maxCount;
  }

  // Award points for a specific limit type
  async awardBonus(
    userId: string,
    limitType: LimitType,
    reason: string,
    note?: string,
  ): Promise<boolean> {
    try {
      const canReceive = await this.canReceiveBonus(userId, limitType);

      if (!canReceive) {
        console.log(
          `🎁 ${limitType} bonus already awarded for user: ${userId}`,
        );
        return false;
      }

      // Get points based on type
      let points: number;
      switch (limitType) {
        case LimitType.POST_WEEKLY:
          points = POINTS.POST_CREATION;
          break;
        case LimitType.WISH_WEEKLY:
          points = POINTS.WISH_CREATION;
          break;
        case LimitType.SHARE_WEEKLY:
          points = POINTS.FACEBOOK_SHARE;
          break;
        default:
          throw new Error(`Unknown limit type: ${limitType}`);
      }

      // Award points
      await this.pointsService.awardPoints(userId, points, reason, note);

      // Update limit count
      await this.updateLimitCount(userId, limitType);

      console.log(
        `✅ ${limitType} bonus awarded: ${userId} (+${points} points)`,
      );

      return true;
    } catch (error) {
      console.error(`❌ Error awarding ${limitType} bonus:`, error);
      return false;
    }
  }

  // Update limit count for a specific type
  private async updateLimitCount(
    userId: string,
    limitType: LimitType,
  ): Promise<void> {
    const period = this.getPeriod(limitType);

    try {
      await this.prisma.userLimit.upsert({
        where: {
          userId_limitType_period: {
            userId,
            limitType,
            period,
          },
        },
        update: {
          count: {
            increment: 1,
          },
        },
        create: {
          userId,
          limitType,
          period,
          count: 1,
        },
      });
    } catch (error) {
      console.error(
        `❌ UserLimitService: Error updating ${limitType} count for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // Get stats for a specific limit type
  async getLimitStats(userId: string, limitType: LimitType) {
    const period = this.getPeriod(limitType);

    const currentLimit = await this.prisma.userLimit.findUnique({
      where: {
        userId_limitType_period: {
          userId,
          limitType,
          period,
        },
      },
    });

    const currentCount = currentLimit?.count || 0;

    // Get limit based on type
    let maxCount: number;
    let pointsPerAction: number;
    switch (limitType) {
      case LimitType.POST_WEEKLY:
        maxCount = POST_LIMITS.WEEKLY_POST_POINTS_LIMIT;
        pointsPerAction = POINTS.POST_CREATION;
        break;
      case LimitType.WISH_WEEKLY:
        maxCount = WISH_LIMITS.WEEKLY_WISH_POINTS_LIMIT;
        pointsPerAction = POINTS.WISH_CREATION;
        break;
      case LimitType.SHARE_WEEKLY:
        maxCount = SHARE_LIMITS.WEEKLY_SHARE_POINTS_LIMIT;
        pointsPerAction = POINTS.FACEBOOK_SHARE;
        break;
      default:
        throw new Error(`Unknown limit type: ${limitType}`);
    }

    const canEarnMorePoints = currentCount < maxCount;

    return {
      currentCount,
      maxCount,
      canEarnMorePoints,
      pointsPerAction,
      period: period.toISOString(),
      limitType,
    };
  }

  // Get all limits stats for a user
  async getAllLimitsStats(userId: string) {
    const stats = await Promise.all([
      this.getLimitStats(userId, LimitType.POST_WEEKLY),
      this.getLimitStats(userId, LimitType.WISH_WEEKLY),
      this.getLimitStats(userId, LimitType.SHARE_WEEKLY),
    ]);

    return {
      post: stats[0],
      wish: stats[1],
      share: stats[2],
    };
  }
}
