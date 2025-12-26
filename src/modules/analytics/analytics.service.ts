import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCornerAnalyticsDto } from './dto/create-corner-analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async createCornerAnalytics(
    createCornerAnalyticsDto: CreateCornerAnalyticsDto,
    userId?: string,
  ) {
    const { corner, durationSec } = createCornerAnalyticsDto;

    // Validate corner is not empty
    if (!corner || corner.trim().length === 0) {
      throw new BadRequestException('Corner must not be empty');
    }

    // Validate duration
    if (durationSec <= 0) {
      throw new BadRequestException('Duration must be positive');
    }

    // If no userId provided, create anonymous record
    if (!userId) {
      // For anonymous users, we could store in a separate table or use a special identifier
      // For now, we'll skip storing anonymous data
      return { message: 'Analytics recorded (anonymous)' };
    }

    // Create analytics record
    const analytics = await this.prisma.cornerAnalytics.create({
      data: {
        userId,
        corner: corner.trim(),
        duration: durationSec,
      },
    });

    return analytics;
  }

  async createCornerAnalyticsBatch(
    events: CreateCornerAnalyticsDto[],
    userId?: string,
  ) {
    // Validate all events
    for (const event of events) {
      if (!event.corner || event.corner.trim().length === 0) {
        throw new BadRequestException('Corner must not be empty');
      }
      if (event.durationSec <= 0) {
        throw new BadRequestException('Duration must be positive');
      }
    }

    // If no userId provided, skip storing
    if (!userId) {
      return {
        message: 'Analytics recorded (anonymous)',
        count: events.length,
      };
    }

    // Create multiple analytics records
    const analytics = await this.prisma.cornerAnalytics.createMany({
      data: events.map((event) => ({
        userId,
        corner: event.corner.trim(),
        duration: event.durationSec,
      })),
    });

    return { message: 'Analytics recorded', count: analytics.count };
  }

  async getCornerSummary(corner: string, adminId: string) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    // Validate corner is not empty
    if (!corner || corner.trim().length === 0) {
      throw new BadRequestException('Corner must not be empty');
    }

    // Get analytics data for the corner
    const analytics = await this.prisma.cornerAnalytics.findMany({
      where: { corner: corner.trim() },
      select: {
        duration: true,
        createdAt: true,
      },
    });

    if (analytics.length === 0) {
      return {
        corner: corner.trim(),
        totalRecords: 0,
        averageDuration: 0,
        medianDuration: 0,
        totalDuration: 0,
      };
    }

    // Calculate statistics
    const durations = analytics.map((a) => a.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce(
      (sum, duration) => sum + duration,
      0,
    );
    const averageDuration = totalDuration / durations.length;

    // Calculate median
    const medianDuration =
      durations.length % 2 === 0
        ? (durations[durations.length / 2 - 1] +
            durations[durations.length / 2]) /
          2
        : durations[Math.floor(durations.length / 2)];

    return {
      corner: corner.trim(),
      totalRecords: analytics.length,
      averageDuration: Math.round(averageDuration * 100) / 100,
      medianDuration: Math.round(medianDuration * 100) / 100,
      totalDuration,
    };
  }

  async getUserAnalytics(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [analytics, total] = await Promise.all([
      this.prisma.cornerAnalytics.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cornerAnalytics.count({
        where: { userId },
      }),
    ]);

    return {
      analytics,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCornerStats(adminId: string) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    // Get all unique corners from database
    const uniqueCorners = await this.prisma.cornerAnalytics.findMany({
      select: {
        corner: true,
      },
      distinct: ['corner'],
    });

    // Get stats for all unique corners
    const stats = await Promise.all(
      uniqueCorners.map((item) =>
        this.getCornerSummary(item.corner, adminId),
      ),
    );

    return stats;
  }

  async getAllCornerAnalytics(adminId: string) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    // Get all analytics data
    const analytics = await this.prisma.cornerAnalytics.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        corner: true,
        duration: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return analytics;
  }
}
