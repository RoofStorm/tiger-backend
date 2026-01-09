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

  // Check if user can receive Facebook share bonus (lifetime)
  async canReceiveShareBonus(userId: string): Promise<boolean> {
    return this.userLimitService.canReceiveBonus(userId, LimitType.SHARE_FACEBOOK);
  }

  // Award points for sharing a post, wish, or mood card to Facebook (first share lifetime)
  // Chỉ cộng điểm nếu:
  // 1. Share lên Facebook (platform === 'facebook')
  // 2. Chưa đạt lifetime limit (cả post, wish và mood-card dùng chung limit - chỉ cộng 1 lần trong suốt chương trình)
  async awardShareBonus(
    userId: string,
    contentId: string,
    contentType: 'post' | 'wish' | 'mood-card',
    platform?: string,
  ): Promise<boolean> {
    // Chỉ cộng điểm khi share lên Facebook
    if (platform !== 'facebook') {
      console.log(
        `ℹ️ Share to ${platform || 'unknown'} platform - no points awarded. Only Facebook shares earn points.`,
      );
      return false;
    }

    // Cả post, wish và mood-card đều dùng cùng SHARE_FACEBOOK limit type
    // Nên dù share post, wish hay mood-card, chỉ được cộng 50 điểm 1 lần trong suốt chương trình
    const reason = 'Facebook share bonus'; // Dùng chung reason cho cả post, wish và mood-card
    const note =
      contentType === 'post'
        ? `Shared post to Facebook: ${contentId}`
        : contentType === 'wish'
          ? `Shared wish to Facebook: ${contentId}`
          : `Shared mood card to Facebook: ${contentId}`;

    return this.userLimitService.awardBonus(
      userId,
      LimitType.SHARE_FACEBOOK,
      reason,
      note,
    );
  }

  // Get share stats for user
  async getShareStats(userId: string) {
    return this.userLimitService.getLimitStats(userId, LimitType.SHARE_FACEBOOK);
  }
}
