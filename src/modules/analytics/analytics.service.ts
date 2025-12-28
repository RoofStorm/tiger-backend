import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';
import { FunnelQueryDto } from './dto/funnel.dto';
import { AnalyticsQueueService } from './analytics-queue.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private queueService: AnalyticsQueueService,
  ) {}

  /**
   * Ingest analytics events (high-throughput, async)
   * Validates schema, appends server timestamp, and queues for bulk insert
   * Returns immediately after queuing (non-blocking)
   */
  async ingestEvents(
    events: CreateAnalyticsEventDto[],
    sessionId: string,
    userId?: string,
  ) {
    if (!events || events.length === 0) {
      throw new BadRequestException('Events array cannot be empty');
    }

    if (!sessionId || sessionId.trim().length === 0) {
      throw new BadRequestException('SessionId is required');
    }

    // Validate all events (lightweight validation)
    for (const event of events) {
      if (!event.page || event.page.trim().length === 0) {
        throw new BadRequestException('Page is required for all events');
      }
      if (!event.action || event.action.trim().length === 0) {
        throw new BadRequestException('Action is required for all events');
      }
    }

    // Prepare data for queue (add server timestamp implicitly via DB default)
    const isAnonymous = !userId;
    const queuedEvents = events.map((event) => ({
      userId: userId || null,
      sessionId: sessionId.trim(),
      isAnonymous,
      page: event.page.trim(),
      zone: event.zone?.trim() || null,
      component: event.component?.trim() || null,
      action: event.action.trim(),
      value: event.value || null,
      metadata: event.metadata || null,
    }));

    // Enqueue events (non-blocking, returns immediately)
    this.queueService.enqueue(queuedEvents);

    // Return success immediately (events will be processed by worker)
    return {
      message: 'Events queued',
      count: events.length,
    };
  }

  /**
   * Get analytics summary by page/zone
   * ONLY queries aggregate table for performance (no raw events)
   */
  async getSummary(query: AnalyticsSummaryQueryDto) {
    const { page, zone } = query;

    // Build where clause for aggregate table
    const where: any = {};
    if (page) where.page = page;
    if (zone) where.zone = zone;

    // Get aggregated data from aggregate table only (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const aggregates = await this.prisma.analyticsAggregate.findMany({
      where: {
        ...where,
        date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { date: 'desc' },
    });

    if (aggregates.length === 0) {
      return {
        page: page || 'all',
        zone: zone || 'all',
        totalEvents: 0,
        avgTime: 0,
        totalClicks: 0,
        uniqueSessions: 0,
        completionRate: 0,
      };
    }

    // Calculate totals from aggregate data
    const totalEvents = aggregates.reduce(
      (sum, agg) => sum + agg.totalEvents,
      0,
    );
    const totalClicks = aggregates
      .filter((agg) => agg.action === 'click')
      .reduce((sum, agg) => sum + agg.totalEvents, 0);
    
    // Calculate avg time from page_view/zone_view/view_end/complete actions (actions with duration value)
    const durationAggregates = aggregates.filter(
      (agg) => 
        agg.action === 'page_view' ||
        agg.action === 'zone_view' || 
        agg.action === 'view_end' || 
        agg.action === 'complete',
    );
    const totalDuration = durationAggregates.reduce(
      (sum, agg) => sum + (agg.totalValue || 0),
      0,
    );
    const totalDurationEvents = durationAggregates.reduce(
      (sum, agg) => sum + agg.totalEvents,
      0,
    );
    const avgTime = totalDurationEvents > 0 ? totalDuration / totalDurationEvents : 0;

    // Get unique sessions from aggregate (sum of uniqueSessions)
    const uniqueSessionsMap = new Map<string, number>();
    aggregates.forEach((agg) => {
      const key = `${agg.page}_${agg.zone || ''}_${agg.date}`;
      uniqueSessionsMap.set(key, Math.max(uniqueSessionsMap.get(key) || 0, agg.uniqueSessions));
    });
    const uniqueSessions = Array.from(uniqueSessionsMap.values()).reduce((sum, val) => sum + val, 0);

    // Calculate completion rate
    const startEvents = aggregates
      .filter((agg) => agg.action === 'start')
      .reduce((sum, agg) => sum + agg.totalEvents, 0);
    const completeEvents = aggregates
      .filter((agg) => agg.action === 'complete')
      .reduce((sum, agg) => sum + agg.totalEvents, 0);
    const completionRate =
      startEvents > 0 ? completeEvents / startEvents : 0;

    return {
      page: page || 'all',
      zone: zone || 'all',
      totalEvents,
      avgTime: Math.round(avgTime * 100) / 100,
      totalClicks,
      uniqueSessions,
      completionRate: Math.round(completionRate * 1000) / 1000,
    };
  }

  /**
   * Calculate funnel/conversion metrics
   */
  async getFunnel(query: FunnelQueryDto) {
    const { page, zone, steps } = query;

    if (!steps || steps.length < 2) {
      throw new BadRequestException('At least 2 steps are required');
    }

    // Build where clause
    const where: any = {
      page,
      action: { in: steps },
    };
    if (zone) where.zone = zone;

    // Get events for the last 30 days
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        sessionId: true,
        action: true,
      },
    });

    // Group by session and track which steps each session completed
    const sessionSteps = new Map<string, Set<string>>();
    for (const event of events) {
      if (!sessionSteps.has(event.sessionId)) {
        sessionSteps.set(event.sessionId, new Set());
      }
      sessionSteps.get(event.sessionId)!.add(event.action);
    }

    // Calculate funnel steps
    const funnelSteps = [];
    let previousCount = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let count = 0;

      if (i === 0) {
        // For first step, count all sessions that have this action
        count = Array.from(sessionSteps.values()).filter((s) =>
          s.has(step),
        ).length;
        previousCount = count;
      } else {
        // For subsequent steps, count sessions that completed all previous steps AND current step
        for (const [sessionId, completedSteps] of sessionSteps.entries()) {
          // Check if session completed all previous steps (0 to i-1) and current step (i)
          let hasAllPrevious = true;
          for (let j = 0; j <= i; j++) {
            if (!completedSteps.has(steps[j])) {
              hasAllPrevious = false;
              break;
            }
          }
          if (hasAllPrevious) {
            count++;
          }
        }
      }

      const percentage =
        i === 0 ? 100 : previousCount > 0 ? (count / previousCount) * 100 : 0;

      funnelSteps.push({
        step,
        count,
        percentage: Math.round(percentage * 100) / 100,
      });

      // Update previousCount for next iteration
      if (i > 0) {
        previousCount = count;
      }
    }

    // Overall conversion rate (first to last step)
    const firstStepCount = funnelSteps[0]?.count || 0;
    const lastStepCount = funnelSteps[funnelSteps.length - 1]?.count || 0;
    const conversionRate =
      firstStepCount > 0 ? lastStepCount / firstStepCount : 0;

    return {
      page,
      zone: zone || null,
      steps: funnelSteps,
      conversionRate: Math.round(conversionRate * 1000) / 1000,
    };
  }

  // Legacy methods (kept for backward compatibility, can be removed later)
  async createCornerAnalytics(
    createCornerAnalyticsDto: any,
    userId?: string,
  ) {
    // Deprecated - use ingestEvents instead
    throw new BadRequestException(
      'This endpoint is deprecated. Please use /api/analytics/events',
    );
  }

  async createCornerAnalyticsBatch(events: any[], userId?: string) {
    // Deprecated - use ingestEvents instead
    throw new BadRequestException(
      'This endpoint is deprecated. Please use /api/analytics/events',
    );
  }

  async getCornerSummary(corner: string, adminId: string) {
    // Deprecated
    throw new BadRequestException(
      'This endpoint is deprecated. Please use /api/analytics/summary',
    );
  }

  async getUserAnalytics(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [analytics, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.analyticsEvent.count({
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

    // Get summary for all pages
    const pages = ['welcome', 'emoji', 'challenge', 'nhip-bep', 'doi-qua', 'profile'];
    const stats = await Promise.all(
      pages.map((page) => this.getSummary({ page })),
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

    // Get all analytics events
    const analytics = await this.prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent overload
      select: {
        id: true,
        page: true,
        zone: true,
        component: true,
        action: true,
        value: true,
        metadata: true,
        createdAt: true,
        userId: true,
        sessionId: true,
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
