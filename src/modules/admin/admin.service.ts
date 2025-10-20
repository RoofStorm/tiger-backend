import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAdminStats(userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    const [totalUsers, totalPosts, totalRedeems, totalPointsAwarded] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.post.count(),
        this.prisma.redeemRequest.count(),
        this.prisma.pointsLog.aggregate({
          _sum: { points: true },
        }),
      ]);

    // Get recent activity
    const recentActivity = await this.prisma.pointsLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      totalUsers,
      totalPosts,
      totalRedeems,
      totalPointsAwarded: totalPointsAwarded._sum.points || 0,
      recentActivity: recentActivity.map((log) => ({
        type: log.type,
        description: `${log.user.name} earned ${log.points} points`,
        timestamp: log.createdAt,
      })),
    };
  }

  async getRedeemLogs(page = 1, limit = 20, status?: string, userId?: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [redeems, total] = await Promise.all([
      this.prisma.redeemRequest.findMany({
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
            },
          },
          reward: true,
        },
      }),
      this.prisma.redeemRequest.count({ where }),
    ]);

    return {
      data: redeems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateRedeemStatus(redeemId: string, status: string, userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update redeem status');
    }

    const redeem = await this.prisma.redeemRequest.findUnique({
      where: { id: redeemId },
    });

    if (!redeem) {
      throw new NotFoundException('Redeem request not found');
    }

    return this.prisma.redeemRequest.update({
      where: { id: redeemId },
      data: { status: status as any },
    });
  }

  async getUsers(
    adminId: string,
    page = 1,
    limit = 20,
    role?: string,
    status?: string,
  ) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Ensure page and limit are numbers
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (role) where.role = role as any;
    if (status) where.status = status as any;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          status: true,
          points: true,
          loginMethod: true,
          createdAt: true,
          updatedAt: true,
          // Exclude sensitive fields
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getPosts(adminId: string, page = 1, limit = 20, highlighted?: boolean) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Ensure page and limit are numbers
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (highlighted !== undefined) where.highlighted = highlighted;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limitNum,
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
      data: posts,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getWishes(
    adminId: string,
    page = 1,
    limit = 20,
    highlighted?: boolean,
  ) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Ensure page and limit are numbers
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (highlighted !== undefined) where.highlighted = highlighted;

    const [wishes, total] = await Promise.all([
      this.prisma.wish.findMany({
        where,
        skip,
        take: limitNum,
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
      this.prisma.wish.count({ where }),
    ]);

    return {
      data: wishes,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getRedeems(adminId: string, page = 1, limit = 20, status?: string) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Ensure page and limit are numbers
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status as any;

    const [redeems, total] = await Promise.all([
      this.prisma.redeemLog.findMany({
        where,
        skip,
        take: limitNum,
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
      this.prisma.redeemLog.count({ where }),
    ]);

    return {
      data: redeems,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async highlightPost(postId: string, userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can highlight posts');
    }

    // Check if post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Update post to highlighted
    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: { isHighlighted: true },
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

    return {
      message: 'Post highlighted successfully',
      post: updatedPost,
    };
  }

  async unhighlightPost(postId: string, userId: string) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can unhighlight posts');
    }

    // Check if post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Update post to unhighlighted
    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: { isHighlighted: false },
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

    return {
      message: 'Post unhighlighted successfully',
      post: updatedPost,
    };
  }
}
