import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostType } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async findAll(
    filters: {
      type?: PostType;
      highlighted?: boolean;
      page?: number;
      limit?: number;
    },
    userId?: string,
  ) {
    try {
      const { type, highlighted, page = 1, limit = 20 } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (type) where.type = type;
      if (highlighted !== undefined) where.isHighlighted = highlighted;

      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);

      // Get user stats (isLiked, isShared) if userId is provided
      let userStatsMap: Record<string, { isLiked: boolean; isShared: boolean }> = {};
      if (userId) {
        const postIds = posts.map((post) => post.id);
        const userStats = await this.getBulkUserStats(postIds, userId);
        userStatsMap = userStats.reduce(
          (acc, stat) => {
            acc[stat.postId] = {
              isLiked: stat.isLiked,
              isShared: stat.isShared,
            };
            return acc;
          },
          {} as Record<string, { isLiked: boolean; isShared: boolean }>,
        );
      }

      // Return posts with global counts and user-specific data (if authenticated)
      const postsWithCounts = posts.map((post) => {
        const basePost = {
          ...post,
          imageUrl: post.url, // Map url to imageUrl for frontend compatibility
        };

        // Add user-specific data if userId is provided
        if (userId && userStatsMap[post.id]) {
          return {
            ...basePost,
            isLiked: userStatsMap[post.id].isLiked,
            isShared: userStatsMap[post.id].isShared,
          };
        }

        return basePost;
      });

      return {
        posts: postsWithCounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in findAll:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        actions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Map url to imageUrl for frontend compatibility
    return {
      ...post,
      imageUrl: post.url,
    };
  }

  async create(createPostDto: CreatePostDto, userId: string) {
    // Handle both imageUrl and url fields, prioritize imageUrl
    const url = createPostDto.imageUrl || createPostDto.url;

    const post = await this.prisma.post.create({
      data: {
        type: createPostDto.type || PostType.IMAGE, // Default to IMAGE
        caption: createPostDto.caption,
        url: url,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Points are now awarded in PostsController using PostService
    // to implement weekly limits (100 points for first post per week)

    // Map url to imageUrl for frontend compatibility
    return {
      ...post,
      imageUrl: post.url,
    };
  }

  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }

  async updateLikeCount(postId: string, increment: boolean) {
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        likeCount: {
          [increment ? 'increment' : 'decrement']: 1,
        },
      },
    });
  }

  async recalculateLikeCount(postId: string) {
    // Count actual likes from UserPostAction table
    const likeCount = await this.prisma.userPostAction.count({
      where: {
        postId: postId,
        type: 'LIKE',
      },
    });

    // Update post with accurate count
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        likeCount: likeCount,
      },
    });
  }

  async updateShareCount(postId: string) {
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        shareCount: {
          increment: 1,
        },
      },
    });
  }

  async recalculateShareCount(postId: string) {
    // Count actual shares from UserPostAction table
    const shareCount = await this.prisma.userPostAction.count({
      where: {
        postId: postId,
        type: 'SHARE',
      },
    });

    // Update post with accurate count
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        shareCount: shareCount,
      },
    });
  }

  async recalculateAllCounts(postId: string) {
    // First, let's check all actions for this post to debug
    const allActions = await this.prisma.userPostAction.findMany({
      where: {
        postId: postId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Count actual likes and shares from UserPostAction table
    const [likeCount, shareCount] = await Promise.all([
      this.prisma.userPostAction.count({
        where: {
          postId: postId,
          type: 'LIKE',
        },
      }),
      this.prisma.userPostAction.count({
        where: {
          postId: postId,
          type: 'SHARE',
        },
      }),
    ]);

    // Update post with accurate counts
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        likeCount: likeCount,
        shareCount: shareCount,
        // commentCount can be updated separately when comments are implemented
      },
    });
  }

  async getUserStats(postId: string, userId: string) {
    // Get user's actions for this post
    const userActions = await this.prisma.userPostAction.findMany({
      where: {
        postId: postId,
        userId: userId,
      },
    });

    // Count user's likes and shares for this post
    const userLikeCount = userActions.filter(
      (action) => action.type === 'LIKE',
    ).length;
    const userShareCount = userActions.filter(
      (action) => action.type === 'SHARE',
    ).length;
    const isLiked = userLikeCount > 0;
    const isShared = userShareCount > 0;

    return {
      postId,
      userId,
      likeCount: userLikeCount,
      shareCount: userShareCount,
      isLiked,
      isShared,
    };
  }

  async getBulkUserStats(postIds: string[], userId: string) {
    // Get user's actions for all posts in one query
    const userActions = await this.prisma.userPostAction.findMany({
      where: {
        postId: {
          in: postIds,
        },
        userId: userId,
      },
    });

    // Group actions by postId
    const actionsByPost = userActions.reduce(
      (acc, action) => {
        if (!acc[action.postId]) {
          acc[action.postId] = [];
        }
        acc[action.postId].push(action);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    // Calculate stats for each post
    const stats = postIds.map((postId) => {
      const postActions = actionsByPost[postId] || [];
      const userLikeCount = postActions.filter(
        (action) => action.type === 'LIKE',
      ).length;
      const userShareCount = postActions.filter(
        (action) => action.type === 'SHARE',
      ).length;

      return {
        postId,
        userId,
        likeCount: userLikeCount,
        shareCount: userShareCount,
        isLiked: userLikeCount > 0,
        isShared: userShareCount > 0,
      };
    });

    return stats;
  }
}
