import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostType } from '@prisma/client';

@Injectable()
export class MoodCardsService {
  constructor(private prisma: PrismaService) {}

  async getAllMoodCards(page = 1, limit = 20, userId?: string) {
    const skip = (page - 1) * limit;

    const where = userId
      ? { userId, type: PostType.EMOJI_CARD }
      : { type: PostType.EMOJI_CARD };

    const [moodCards, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: moodCards,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMoodCardById(id: string) {
    const moodCard = await this.prisma.post.findFirst({
      where: {
        id,
        type: PostType.EMOJI_CARD,
      },
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
    });

    if (!moodCard) {
      throw new NotFoundException('Mood card not found');
    }

    return moodCard;
  }

  async createMoodCard(createMoodCardDto: any, userId: string) {
    return this.prisma.post.create({
      data: {
        ...createMoodCardDto,
        userId,
        type: PostType.EMOJI_CARD,
      },
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
    });
  }

  async shareMoodCard(id: string, shareData: any, userId: string) {
    // For now, just return the mood card with share data
    // In a real implementation, you might want to create a share record
    const moodCard = await this.getMoodCardById(id);

    return {
      ...moodCard,
      shareData,
      sharedAt: new Date(),
    };
  }
}
