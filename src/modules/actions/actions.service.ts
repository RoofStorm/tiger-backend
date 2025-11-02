import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { PointsService } from '../points/points.service';
import { CreateActionDto } from './dto/create-action.dto';
import { ActionType } from '@prisma/client';

@Injectable()
export class ActionsService {
  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private pointsService: PointsService,
  ) {}

  async createAction(createActionDto: CreateActionDto, userId: string) {
    try {
      const { postId, type } = createActionDto;

      // Check if post exists
      const post = await this.postsService.findOne(postId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Handle LIKE as toggle (like/unlike)
      if (type === ActionType.LIKE) {
        const existingAction = await this.prisma.userPostAction.findUnique({
          where: {
            userId_postId_type: {
              userId,
              postId,
              type: ActionType.LIKE,
            },
          },
        });

        if (existingAction) {
          // Unlike: Remove action and recalculate count
          await this.prisma.userPostAction.delete({
            where: {
              userId_postId_type: {
                userId,
                postId,
                type: ActionType.LIKE,
              },
            },
          });
          // Update global counts after unlike
          await this.postsService.recalculateAllCounts(postId);

          // Points for like/unlike are disabled

          return { action: 'unliked', liked: false };
        } else {
          // Like: Create action and update global counts
          await this.prisma.userPostAction.create({
            data: {
              userId,
              postId,
              type: ActionType.LIKE,
            },
          });
          // Update global counts after like
          await this.postsService.recalculateAllCounts(postId);

          // Points for like/unlike are disabled

          return { action: 'liked', liked: true };
        }
      }

      // Handle other actions (SHARE) normally
      // For SHARE, use upsert to allow sharing multiple times
      if (type === ActionType.SHARE) {
        const action = await this.prisma.userPostAction.upsert({
          where: {
            userId_postId_type: {
              userId,
              postId,
              type: ActionType.SHARE,
            },
          },
          update: {
            // Update timestamp when sharing again
            createdAt: new Date(),
          },
          create: {
            userId,
            postId,
            type: ActionType.SHARE,
          },
        });

        // Update global counts for sharing
        // Points are awarded separately via shareService.awardShareBonus in controller
        await this.postsService.recalculateAllCounts(postId);

        return action;
      }

      const action = await this.prisma.userPostAction.create({
        data: {
          userId,
          postId,
          type,
        },
      });

      return action;
    } catch (error) {
      console.error('Error in createAction:', error);
      throw error;
    }
  }

  async removeAction(postId: string, type: ActionType, userId: string) {
    const action = await this.prisma.userPostAction.findUnique({
      where: {
        userId_postId_type: {
          userId,
          postId,
          type,
        },
      },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    // Delete action
    await this.prisma.userPostAction.delete({
      where: {
        userId_postId_type: {
          userId,
          postId,
          type,
        },
      },
    });

    // Update post counters
    if (type === ActionType.LIKE) {
      await this.postsService.updateLikeCount(postId, false);
    }

    return { message: 'Action removed successfully' };
  }

  async getUserActions(userId: string, postId?: string) {
    const where: any = { userId };
    if (postId) where.postId = postId;

    return this.prisma.userPostAction.findMany({
      where,
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
