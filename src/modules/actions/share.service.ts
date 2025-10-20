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

  // Award points for sharing a post (first share per day)
  async awardShareBonus(userId: string, postId: string): Promise<boolean> {
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
