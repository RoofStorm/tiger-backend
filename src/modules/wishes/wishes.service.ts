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
        isHighlighted: true,
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  async getHighlightedWishes(limit = 20, cursor?: string) {
    const decodedCursor = this.decodeCursor(cursor);
    const where: any = { isHighlighted: true };

    if (decodedCursor) {
      const { createdAt, id } = decodedCursor;
      // Fetch older wishes: (createdAt < current) OR (createdAt == current AND id < currentId)
      where.OR = [
        { createdAt: { lt: createdAt } },
        {
          AND: [{ createdAt: { equals: createdAt } }, { id: { lt: id } }],
        },
      ];
    }

    const wishes = await this.prisma.wish.findMany({
      where,
      take: limit + 1,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = wishes.length > limit;
    const data = hasMore ? wishes.slice(0, limit) : wishes;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
    }

    return {
      success: true,
      data,
      nextCursor,
    };
  }

  private encodeCursor(createdAt: Date, id: string): string {
    const cursorPayload = { createdAt: createdAt.toISOString(), id };
    return Buffer.from(JSON.stringify(cursorPayload)).toString('base64');
  }

  private decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const payload = JSON.parse(decoded);
      if (!payload.createdAt || !payload.id) return null;
      return { createdAt: new Date(payload.createdAt), id: payload.id };
    } catch (e) {
      return null;
    }
  }

  async getUserWishes(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [wishes, total] = await Promise.all([
      this.prisma.wish.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  async getWishById(wishId: string) {
    return this.prisma.wish.findUnique({
      where: { id: wishId },
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
