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
    const { postId, type } = createActionDto;

    // Check if post exists
    const post = await this.postsService.findOne(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if action already exists for LIKE (enforce uniqueness)
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
        throw new ConflictException('Post already liked');
      }
    }

    // Create action
    const action = await this.prisma.userPostAction.create({
      data: {
        userId,
        postId,
        type,
      },
    });

    // Update post counters
    if (type === ActionType.LIKE) {
      await this.postsService.updateLikeCount(postId, true);
    } else if (type === ActionType.SHARE) {
      await this.postsService.updateShareCount(postId);
      
      // Award points for sharing (business rule)
      await this.pointsService.awardPoints(userId, 10, 'Share post');
    }

    return action;
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

