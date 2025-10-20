import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserLimitService } from '../limits/user-limit.service';
import { POST_LIMITS } from '../../constants/points';
import { LimitType } from '@prisma/client';

@Injectable()
export class PostService {
  constructor(
    private prisma: PrismaService,
    private userLimitService: UserLimitService,
  ) {}

  // Check if user can receive post bonus this week
  async canReceivePostBonus(userId: string): Promise<boolean> {
    return this.userLimitService.canReceiveBonus(userId, LimitType.POST_WEEKLY);
  }

  // Award points for post creation (first post per week)
  async awardPostCreationBonus(
    userId: string,
    postId: string,
  ): Promise<boolean> {
    return this.userLimitService.awardBonus(
      userId,
      LimitType.POST_WEEKLY,
      'Post creation bonus',
      `First post this week: ${postId}`,
    );
  }

  // Get post creation stats for user
  async getPostCreationStats(userId: string) {
    return this.userLimitService.getLimitStats(userId, LimitType.POST_WEEKLY);
  }
}
