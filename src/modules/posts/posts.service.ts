import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostType } from '@prisma/client';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

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
      let userStatsMap: Record<string, { isLiked: boolean; isShared: boolean }> =
        {};
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
      this.logger.error('Error in findAll:', error);
      throw error;
    }
  }

  private encodeCursor(params: { likeCount: number; createdAt: Date; id: string }): string {
    const { likeCount, createdAt, id } = params;
    return Buffer.from(
      `${likeCount}|${createdAt.toISOString()}|${id}`,
    ).toString('base64');
  }

  private decodeCursor(
    cursor: string,
  ): { likeCount?: number; createdAt?: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('ascii');
      const parts = decoded.split('|');
      // Current format: likeCount|createdAt|id
      if (parts.length === 3) {
        const [likeCountStr, dateStr, id] = parts;
        const likeCount = Number(likeCountStr);
        if (!Number.isFinite(likeCount) || !dateStr || !id) return null;
        return { likeCount, createdAt: new Date(dateStr), id };
      }
      // Legacy format: createdAt|id
      if (parts.length === 2) {
        const [dateStr, id] = parts;
        if (!dateStr || !id) return null;
        return { createdAt: new Date(dateStr), id };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  private async resolveFeedCursor(
    cursor?: string,
  ): Promise<{ likeCount: number; createdAt: Date; id: string } | null> {
    const decoded = this.decodeCursor(cursor);
    if (!decoded) return null;

    // New cursor already has everything we need
    if (decoded.likeCount !== undefined && decoded.createdAt && decoded.id) {
      return {
        likeCount: decoded.likeCount,
        createdAt: decoded.createdAt,
        id: decoded.id,
      };
    }

    // Legacy cursor: lookup likeCount (and createdAt for consistency)
    if (!decoded.id) return null;
    const post = await this.prisma.post.findUnique({
      where: { id: decoded.id },
      select: { id: true, createdAt: true, likeCount: true },
    });
    if (!post) return null;
    return { likeCount: post.likeCount ?? 0, createdAt: post.createdAt, id: post.id };
  }

  async getFeed(
    params: {
      limit?: number;
      cursor?: string;
      direction?: 'next' | 'prev';
      type?: PostType;
      highlighted?: boolean;
    },
    userId?: string,
  ) {
    const {
      limit = 20,
      cursor,
      direction = 'next',
      type,
      highlighted = true,
    } = params;
    const resolvedCursor = await this.resolveFeedCursor(cursor);

    const where: any = {};
    if (type) where.type = type;
    if (highlighted !== undefined) where.isHighlighted = highlighted;

    if (resolvedCursor) {
      const { likeCount, createdAt, id } = resolvedCursor;
      if (direction === 'next') {
        // Fetch "older" in (likeCount desc, createdAt desc, id desc) ordering:
        // (likeCount < cur) OR
        // (likeCount == cur AND createdAt < cur) OR
        // (likeCount == cur AND createdAt == cur AND id < cur)
        where.OR = [
          {
            likeCount: { lt: likeCount },
          },
          {
            AND: [{ likeCount: { equals: likeCount } }, { createdAt: { lt: createdAt } }],
          },
          {
            AND: [
              { likeCount: { equals: likeCount } },
              { createdAt: { equals: createdAt } },
              { id: { lt: id } },
            ],
          },
        ];
      } else {
        // Fetch "newer" in (likeCount desc, createdAt desc, id desc) ordering
        where.OR = [
          {
            likeCount: { gt: likeCount },
          },
          {
            AND: [{ likeCount: { equals: likeCount } }, { createdAt: { gt: createdAt } }],
          },
          {
            AND: [
              { likeCount: { equals: likeCount } },
              { createdAt: { equals: createdAt } },
              { id: { gt: id } },
            ],
          },
        ];
      }
    }

    const posts = await this.prisma.post.findMany({
      where,
      take: direction === 'next' ? limit + 1 : -(limit + 1),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasMore = posts.length > limit;
    const finalPosts = hasMore
      ? direction === 'next'
        ? posts.slice(0, limit)
        : posts.slice(1)
      : posts;

    // Get user stats if userId is provided
    let userStatsMap: Record<string, { isLiked: boolean; isShared: boolean }> =
      {};
    if (userId && finalPosts.length > 0) {
      const postIds = finalPosts.map((post) => post.id);
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

    const postsWithCounts = finalPosts.map((post) => {
      const basePost = {
        ...post,
        imageUrl: post.url,
      };
      if (userId && userStatsMap[post.id]) {
        return {
          ...basePost,
          isLiked: userStatsMap[post.id].isLiked,
          isShared: userStatsMap[post.id].isShared,
        };
      }
      return basePost;
    });

    const nextCursor =
      postsWithCounts.length > 0 && (direction === 'next' ? hasMore : true)
        ? this.encodeCursor(
            {
              likeCount: postsWithCounts[postsWithCounts.length - 1].likeCount ?? 0,
              createdAt: postsWithCounts[postsWithCounts.length - 1].createdAt,
              id: postsWithCounts[postsWithCounts.length - 1].id,
            },
          )
        : null;

    const prevCursor =
      postsWithCounts.length > 0 && (direction === 'prev' ? hasMore : true)
        ? this.encodeCursor(
            {
              likeCount: postsWithCounts[0].likeCount ?? 0,
              createdAt: postsWithCounts[0].createdAt,
              id: postsWithCounts[0].id,
            },
          )
        : null;

    return {
      posts: postsWithCounts,
      pagination: {
        limit,
        nextCursor,
        prevCursor,
        hasNext: direction === 'next' ? hasMore : true,
        hasPrev: direction === 'prev' ? hasMore : true,
      },
    };
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
        isHighlighted: true,
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
