import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  async getAllRewards(page = 1, limit = 20, isActive?: boolean) {
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

    return {
      data: rewards,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async getRewardById(id: string) {
    try {
      console.log('Getting reward by ID:', id);

      const reward = await this.prisma.reward.findUnique({
        where: { id },
      });

      console.log('Reward found:', reward);

      if (!reward) {
        throw new NotFoundException('Reward not found');
      }

      return reward;
    } catch (error) {
      console.error('Error in getRewardById:', error);
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
      console.error('SoftDeleteReward - Error:', error);
      throw error;
    }
  }
}
