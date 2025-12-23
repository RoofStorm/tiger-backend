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
    console.log('🔍 AdminService.getAdminStats called with userId:', userId);

    try {
      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      console.log('🔍 User found:', user);

      if (!user || user.role !== 'ADMIN') {
        throw new ForbiddenException('Only admins can access this endpoint');
      }

      console.log('🔍 Querying database stats...');

      // Test simple raw SQL query first
      try {
        const testQuery = await this.prisma.$queryRaw`SELECT 1 as test`;
        console.log('🔍 Test query result:', testQuery);
      } catch (error) {
        console.error('❌ Test query failed:', error);
        throw error;
      }

      // Use raw SQL queries to bypass Prisma client issues
      const [
        totalUsersResult,
        totalPostsResult,
        totalRedeemsResult,
        totalPointsResult,
        recentActivityResult,
      ] = await Promise.all([
        this.prisma.$queryRaw`SELECT COUNT(*) as count FROM users`,
        this.prisma.$queryRaw`SELECT COUNT(*) as count FROM posts`,
        this.prisma.$queryRaw`SELECT COUNT(*) as count FROM redeem_requests`,
        this.prisma
          .$queryRaw`SELECT COALESCE(SUM(points), 0) as total FROM point_logs`,
        this.prisma.$queryRaw`
          SELECT pl.*, u.name, u.email 
          FROM point_logs pl 
          JOIN users u ON pl."userId" = u.id 
          ORDER BY pl."createdAt" DESC 
          LIMIT 10
        `,
      ]);

      const totalUsers = Number((totalUsersResult as any)[0].count);
      const totalPosts = Number((totalPostsResult as any)[0].count);
      const totalRedeems = Number((totalRedeemsResult as any)[0].count);
      const totalPointsAwarded = Number((totalPointsResult as any)[0].total);

      console.log('🔍 Database stats (raw SQL):', {
        totalUsers,
        totalPosts,
        totalRedeems,
        totalPointsAwarded,
      });

      const recentActivity = (recentActivityResult as any[]).map((log) => ({
        description: `${log.name} earned ${log.points} points`,
        timestamp: log.createdAt,
      }));

      console.log('🔍 Recent activity count:', recentActivity.length);

      const result = {
        totalUsers,
        totalPosts,
        totalRedeems,
        totalPointsAwarded,
        recentActivity,
      };

      console.log('🔍 Final result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error in AdminService.getAdminStats:', error);
      throw error;
    }
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

  async getPosts(
    adminId: string,
    page = 1,
    limit = 20,
    isHighlighted?: boolean,
    sortBy?: string,
    sortOrder: string = 'desc',
    month?: number,
    year?: number,
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
    if (isHighlighted !== undefined) where.isHighlighted = isHighlighted;

    // Filter by month and year (based on createdAt)
    if (month !== undefined || year !== undefined) {
      const filterYear = year ?? new Date().getFullYear();
      const startDate = new Date();
      const endDate = new Date();

      if (month !== undefined) {
        // Validate month (1-12)
        if (month < 1 || month > 12) {
          throw new Error('Month must be between 1 and 12');
        }
        // First day of the month
        startDate.setFullYear(filterYear, month - 1, 1);
        // Last day of the month
        endDate.setFullYear(filterYear, month, 0);
      } else {
        // Filter by entire year
        startDate.setFullYear(filterYear, 0, 1); // January 1st
        endDate.setFullYear(filterYear, 11, 31); // December 31st
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Build orderBy based on sortBy parameter
    let orderBy: any = { createdAt: 'desc' }; // Default sort

    if (sortBy) {
      const validSortFields = [
        'likeCount',
        'isHighlighted',
        'createdAt',
        'userName',
      ];
      const validSortOrders = ['asc', 'desc'];

      if (validSortFields.includes(sortBy)) {
        const order = validSortOrders.includes(sortOrder.toLowerCase())
          ? sortOrder.toLowerCase()
          : 'desc';

        if (sortBy === 'userName') {
          // Sort by user name requires ordering by relation
          orderBy = {
            user: {
              name: order,
            },
          };
        } else {
          orderBy = {
            [sortBy]: order,
          };
        }
      }
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
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
      this.prisma.redeemRequest.findMany({
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
          reward: {
            select: {
              id: true,
              name: true,
              description: true,
              pointsRequired: true,
              lifeRequired: true,
              imageUrl: true,
            },
          },
        },
      }),
      this.prisma.redeemRequest.count({ where }),
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
