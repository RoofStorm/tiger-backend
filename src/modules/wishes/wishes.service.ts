import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWishDto } from './dto/create-wish.dto';

@Injectable()
export class WishesService {
  constructor(private prisma: PrismaService) {}

  async createWish(createWishDto: CreateWishDto, userId: string) {
    return this.prisma.wish.create({
      data: {
        ...createWishDto,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getAllWishes(page = 1, limit = 20, isHighlighted?: boolean) {
    const skip = (page - 1) * limit;
    const where = isHighlighted !== undefined ? { isHighlighted } : {};

    const [wishes, total] = await Promise.all([
      this.prisma.wish.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wish.count({ where }),
    ]);

    return {
      data: wishes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getHighlightedWishes() {
    return this.prisma.wish.findMany({
      where: { isHighlighted: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserWishes(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [wishes, total] = await Promise.all([
      this.prisma.wish.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wish.count({
        where: { userId },
      }),
    ]);

    return {
      data: wishes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async toggleHighlight(wishId: string, adminId: string) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can highlight wishes');
    }

    // Check if wish exists
    const wish = await this.prisma.wish.findUnique({
      where: { id: wishId },
    });

    if (!wish) {
      throw new NotFoundException('Wish not found');
    }

    // Toggle highlight status
    return this.prisma.wish.update({
      where: { id: wishId },
      data: { isHighlighted: !wish.isHighlighted },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteWish(wishId: string, userId: string) {
    const wish = await this.prisma.wish.findUnique({
      where: { id: wishId },
    });

    if (!wish) {
      throw new NotFoundException('Wish not found');
    }

    // Check if user owns the wish or is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (wish.userId !== userId && (!user || user.role !== 'ADMIN')) {
      throw new ForbiddenException('You can only delete your own wishes');
    }

    return this.prisma.wish.delete({
      where: { id: wishId },
    });
  }
}
