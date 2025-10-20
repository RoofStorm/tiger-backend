import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserLimitService } from '../limits/user-limit.service';
import { WISH_LIMITS } from '../../constants/points';
import { LimitType } from '@prisma/client';

@Injectable()
export class WishService {
  constructor(
    private prisma: PrismaService,
    private userLimitService: UserLimitService,
  ) {}

  // Check if user can receive wish bonus this week
  async canReceiveWishBonus(userId: string): Promise<boolean> {
    return this.userLimitService.canReceiveBonus(userId, LimitType.WISH_WEEKLY);
  }

  // Award points for wish creation (first wish per week)
  async awardWishCreationBonus(
    userId: string,
    wishId: string,
  ): Promise<boolean> {
    return this.userLimitService.awardBonus(
      userId,
      LimitType.WISH_WEEKLY,
      'Wish creation bonus',
      `First wish this week: ${wishId}`,
    );
  }

  // Get wish creation stats for user
  async getWishCreationStats(userId: string) {
    return this.userLimitService.getLimitStats(userId, LimitType.WISH_WEEKLY);
  }
}
