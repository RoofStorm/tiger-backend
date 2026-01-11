import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private prisma: PrismaService) {}

  async getAdminStats(userId: string) {
    this.logger.debug('🔍 AdminService.getAdminStats called with userId:', userId);

    try {
      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      this.logger.debug('🔍 User found:', user);

      if (!user || user.role !== 'ADMIN') {
        throw new ForbiddenException('Only admins can access this endpoint');
      }

      this.logger.debug('🔍 Querying database stats...');

      // Test simple raw SQL query first
      try {
        const testQuery = await this.prisma.$queryRaw`SELECT 1 as test`;
        this.logger.debug('🔍 Test query result:', testQuery);
      } catch (error) {
        this.logger.error('❌ Test query failed:', error);
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

      this.logger.debug('🔍 Database stats (raw SQL):', {
        totalUsers,
        totalPosts,
        totalRedeems,
        totalPointsAwarded,
      });

      const recentActivity = (recentActivityResult as any[]).map((log) => ({
        description: `${log.name} earned ${log.points} points`,
        timestamp: log.createdAt,
      }));

      this.logger.debug('🔍 Recent activity count:', recentActivity.length);

      const result = {
        totalUsers,
        totalPosts,
        totalRedeems,
        totalPointsAwarded,
        recentActivity,
      };

      this.logger.debug('🔍 Final result:', result);
      return result;
    } catch (error) {
      this.logger.error('❌ Error in AdminService.getAdminStats:', error);
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

  async exportUsersToExcel(
    adminId: string,
    res: Response,
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

    // Build where clause for filtering
    const where: any = {};
    if (role) where.role = role as any;
    if (status) where.status = status as any;

    // Get all users (no pagination for export)
    const users = await this.prisma.user.findMany({
      where,
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
      },
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 40 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Points', key: 'points', width: 15 },
      { header: 'Login Method', key: 'loginMethod', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 25 },
      { header: 'Updated At', key: 'updatedAt', width: 25 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    users.forEach((user) => {
      worksheet.addRow({
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        status: user.status || '',
        points: user.points || 0,
        loginMethod: user.loginMethod || '',
        createdAt: user.createdAt ? new Date(user.createdAt) : '',
        updatedAt: user.updatedAt ? new Date(user.updatedAt) : '',
      });
    });

    // Format date columns
    worksheet.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
    worksheet.getColumn('updatedAt').numFmt = 'yyyy-mm-dd hh:mm:ss';

    // Set response headers
    const filename = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
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

  async exportRedeemsToExcel(
    adminId: string,
    res: Response,
    status?: string,
  ) {
    // Check if user is admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }

    // Get all monthly rankings (no pagination for export)
    const monthlyRankings = await this.prisma.monthlyPostRanking.findMany({
      orderBy: [{ month: 'desc' }, { rank: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            type: true,
            url: true,
            caption: true,
            likeCount: true,
          },
        },
      },
    });

    // Build where clause for redeem requests
    const where: any = {};
    if (status) where.status = status as any;

    // Get all redeem requests (no pagination for export)
    const redeemRequests = await this.prisma.redeemRequest.findMany({
      where,
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
            rewardCategory: true,
            rank: true,
            month: true,
          },
        },
      },
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Monthly Rankings (Danh sách người thắng giải)
    const rankingsSheet = workbook.addWorksheet('Danh sách người thắng giải');
    rankingsSheet.columns = [
      { header: 'Tháng', key: 'month', width: 15 },
      { header: 'Hạng', key: 'rank', width: 10 },
      { header: 'Tên người dùng', key: 'userName', width: 30 },
      { header: 'Email', key: 'userEmail', width: 40 },
      { header: 'ID Người dùng', key: 'userId', width: 36 },
      { header: 'ID Bài viết', key: 'postId', width: 36 },
      { header: 'Loại bài viết', key: 'postType', width: 15 },
      { header: 'Số lượt thích', key: 'likeCount', width: 15 },
      { header: 'URL bài viết', key: 'postUrl', width: 50 },
      { header: 'Mô tả bài viết', key: 'postCaption', width: 50 },
      { header: 'Ngày tạo', key: 'createdAt', width: 25 },
    ];

    rankingsSheet.getRow(1).font = { bold: true };
    rankingsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    monthlyRankings.forEach((ranking) => {
      rankingsSheet.addRow({
        month: ranking.month.toISOString().split('T')[0],
        rank: ranking.rank,
        userName: ranking.user.name || '',
        userEmail: ranking.user.email || '',
        userId: ranking.userId,
        postId: ranking.postId,
        postType: ranking.post.type || '',
        likeCount: ranking.likeCount,
        postUrl: ranking.post.url || '',
        postCaption: ranking.post.caption || '',
        createdAt: ranking.createdAt ? new Date(ranking.createdAt) : '',
      });
    });

    // Format date columns
    rankingsSheet.getColumn('month').numFmt = 'yyyy-mm-dd';
    rankingsSheet.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss';

    // Sheet 2: Redeem Requests (Quản lý đổi thưởng)
    const redeemsSheet = workbook.addWorksheet('Quản lý đổi thưởng');
    redeemsSheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Tên người dùng', key: 'userName', width: 30 },
      { header: 'Email người dùng', key: 'userEmail', width: 40 },
      { header: 'ID Người dùng', key: 'userId', width: 36 },
      { header: 'Tên phần thưởng', key: 'rewardName', width: 30 },
      { header: 'Mô tả phần thưởng', key: 'rewardDescription', width: 40 },
      { header: 'Loại phần thưởng', key: 'rewardCategory', width: 20 },
      { header: 'Hạng (nếu có)', key: 'rewardRank', width: 15 },
      { header: 'Tháng (nếu có)', key: 'rewardMonth', width: 15 },
      { header: 'Điểm yêu cầu', key: 'pointsRequired', width: 15 },
      { header: 'Điểm đã dùng', key: 'pointsUsed', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Số điện thoại người nhận', key: 'receiverPhone', width: 20 },
      { header: 'Email người nhận', key: 'receiverEmail', width: 40 },
      { header: 'Lý do từ chối', key: 'rejectionReason', width: 40 },
      { header: 'Ngày tạo', key: 'createdAt', width: 25 },
      { header: 'Ngày cập nhật', key: 'updatedAt', width: 25 },
    ];

    redeemsSheet.getRow(1).font = { bold: true };
    redeemsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    redeemRequests.forEach((redeem) => {
      redeemsSheet.addRow({
        id: redeem.id,
        userName: redeem.user.name || '',
        userEmail: redeem.user.email || '',
        userId: redeem.userId,
        rewardName: redeem.reward.name || '',
        rewardDescription: redeem.reward.description || '',
        rewardCategory: redeem.reward.rewardCategory || '',
        rewardRank: redeem.reward.rank || '',
        rewardMonth: redeem.reward.month
          ? new Date(redeem.reward.month).toISOString().split('T')[0]
          : '',
        pointsRequired: redeem.reward.pointsRequired || 0,
        pointsUsed: redeem.pointsUsed,
        status: redeem.status || '',
        receiverPhone: redeem.receiverPhone || '',
        receiverEmail: redeem.receiverEmail || '',
        rejectionReason: redeem.rejectionReason || '',
        createdAt: redeem.createdAt ? new Date(redeem.createdAt) : '',
        updatedAt: redeem.updatedAt ? new Date(redeem.updatedAt) : '',
      });
    });

    // Format date columns
    redeemsSheet.getColumn('rewardMonth').numFmt = 'yyyy-mm-dd';
    redeemsSheet.getColumn('createdAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
    redeemsSheet.getColumn('updatedAt').numFmt = 'yyyy-mm-dd hh:mm:ss';

    // Set response headers
    const filename = `redeems_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  }
}
