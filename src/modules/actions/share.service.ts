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

  // Check if user can receive Facebook share bonus this week
  async canReceiveShareBonus(userId: string): Promise<boolean> {
    return this.userLimitService.canReceiveBonus(userId, LimitType.SHARE_WEEKLY);
  }

  // Award points for sharing a post or wish to Facebook (first share per week)
  // Chỉ cộng điểm nếu:
  // 1. Share lên Facebook (platform === 'facebook')
  // 2. Chưa đạt weekly limit (cả post và wish dùng chung limit - chỉ cộng 1 lần/tuần)
  async awardShareBonus(
    userId: string,
    contentId: string,
    contentType: 'post' | 'wish',
    platform?: string,
  ): Promise<boolean> {
    // Chỉ cộng điểm khi share lên Facebook
    if (platform !== 'facebook') {
      console.log(
        `ℹ️ Share to ${platform || 'unknown'} platform - no points awarded. Only Facebook shares earn points.`,
      );
      return false;
    }

    // Cả post và wish đều dùng cùng SHARE_WEEKLY limit type
    // Nên dù share post hay wish, chỉ được cộng 50 điểm 1 lần/tuần
    const reason = 'Facebook share bonus'; // Dùng chung reason cho cả post và wish
    const note =
      contentType === 'post'
        ? `Shared post to Facebook: ${contentId}`
        : `Shared wish to Facebook: ${contentId}`;

    return this.userLimitService.awardBonus(
      userId,
      LimitType.SHARE_WEEKLY,
      reason,
      note,
    );
  }

  // Get share stats for user
  async getShareStats(userId: string) {
    return this.userLimitService.getLimitStats(userId, LimitType.SHARE_WEEKLY);
  }
}
