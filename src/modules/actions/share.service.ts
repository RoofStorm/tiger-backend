import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserLimitService } from '../limits/user-limit.service';
import { SHARE_LIMITS } from '../../constants/points';
import { LimitType } from '@prisma/client';

@Injectable()
export class ShareService {
  constructor(
    private prisma: PrismaService,
    private userLimitService: UserLimitService,
  ) {}

  // Check if user can receive share bonus today
  async canReceiveShareBonus(userId: string): Promise<boolean> {
    return this.userLimitService.canReceiveBonus(userId, LimitType.SHARE_DAILY);
  }

  // Award points for sharing a post (first share per day for a unique post)
  // Chỉ cộng điểm nếu:
  // 1. Chưa đạt daily limit
  // 2. Post này chưa được share và cộng điểm trong ngày hiện tại
  async awardShareBonus(userId: string, postId: string): Promise<boolean> {
    // Kiểm tra xem post này đã được share và cộng điểm chưa trong ngày hiện tại
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingPointLog = await this.prisma.pointLog.findFirst({
      where: {
        userId,
        reason: 'Post share bonus',
        note: `Shared post: ${postId}`,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Nếu post này đã được share và cộng điểm trong ngày hôm nay, không cộng điểm nữa
    if (existingPointLog) {
      console.log(
        `🎁 Post ${postId} already shared and bonus awarded today for user: ${userId}`,
      );
      return false;
    }

    // Kiểm tra daily limit và award bonus
    return this.userLimitService.awardBonus(
      userId,
      LimitType.SHARE_DAILY,
      'Post share bonus',
      `Shared post: ${postId}`,
    );
  }

  // Get share stats for user
  async getShareStats(userId: string) {
    return this.userLimitService.getLimitStats(userId, LimitType.SHARE_DAILY);
  }
}
