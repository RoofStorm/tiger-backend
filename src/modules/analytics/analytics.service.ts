import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnalyticsEventDto } from './dto/create-analytics-event.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';
import { AnalyticsQueueService } from './analytics-queue.service';
import { RedisService } from '../../common/redis/redis.service';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(
    private prisma: PrismaService,
    private queueService: AnalyticsQueueService,
    private redisService: RedisService,
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

    // Debug: Log first event to verify userId is set correctly
    if (queuedEvents.length > 0) {
      this.logger.debug(`[Analytics] First event: userId=${queuedEvents[0].userId}, isAnonymous=${queuedEvents[0].isAnonymous}, page=${queuedEvents[0].page}, action=${queuedEvents[0].action}`);
    }

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
   * Queries directly from raw events for perfect accuracy and sync with Analysis API
   */
  async getSummary(query: AnalyticsSummaryQueryDto) {
    const { page, zone, from, to } = query;

    // Validate: zone can only be used when page is provided
    if (zone && !page) {
      throw new BadRequestException(
        'Zone filter can only be used when page filter is provided',
      );
    }

    // Build where clause for non-user metrics (views, clicks, durations)
    // These can be filtered by both page and zone
    const where: any = {};
    if (page) {
      where.page = page;
      if (zone) {
        where.zone = zone;
      } else {
        // If page is provided but zone is not, only count page-level events (zone = null)
        where.zone = null;
      }
    }
    // If no page is provided, where = {} means query all pages

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      if (startDate > endDate) {
        throw new BadRequestException(
          'From date must be before or equal to to date',
        );
      }
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 90) {
        throw new BadRequestException('Date range cannot exceed 90 days');
      }
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    const timeFilter = { gte: startDate, lte: endDate };

    // Build where clause for user metrics (only filter by page, ignore zone)
    // Users are counted at page level, not zone level
    const userWhere: any = {};
    if (page) {
      userWhere.page = page;
      // Don't filter by zone for user metrics - all zones in the page count
    }

    // Get all stats in parallel from raw events table
    const [totalViews, clickStats, durationStats, uniqueSessionsResult, uniqueUsersResult] =
      await Promise.all([
        // 1. Total Views (can filter by zone if needed)
        this.prisma.analyticsEvent.count({
          where: {
            ...where,
            action: { in: ['page_view', 'zone_view', 'view'] },
            createdAt: timeFilter,
          },
        }),
        // 2. Total Clicks (can filter by zone if needed)
        this.prisma.analyticsEvent.count({
          where: {
            ...where,
            action: { in: ['click', 'start', 'submit'] },
            createdAt: timeFilter,
          },
        }),
        // 3. Durations (can filter by zone if needed)
        this.prisma.analyticsEvent.aggregate({
          where: {
            ...where,
            action: { in: ['page_view', 'zone_view', 'view_end', 'complete'] },
            value: { gt: 0 },
            createdAt: timeFilter,
          },
          _sum: { value: true },
          _count: { _all: true },
        }),
        // 4. Unique Sessions (page level only, ignore zone)
        this.prisma.analyticsEvent.groupBy({
          by: ['sessionId'],
          where: { ...userWhere, createdAt: timeFilter },
        }),
        // 5. Unique Users (page level only, ignore zone)
        // Users are counted at page level - if they visited the page, they count regardless of zone
        this.prisma.analyticsEvent.groupBy({
          by: ['userId'],
          where: {
            ...userWhere,
            userId: { not: null },
            createdAt: timeFilter,
          },
        }),
      ]);

    const totalDurations = durationStats._sum.value || 0;
    const avgDuration = totalViews > 0 ? totalDurations / totalViews : 0;

    // Get unique anonymous users from database (page level only, ignore zone)
    // Query from analytics_events where isAnonymous = true and filter by page
    let uniqueAnonymousUsers = 0;
    try {
      const anonymousSessionsResult = await this.prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: {
          ...userWhere, // Only filter by page, not zone
          isAnonymous: true,
          createdAt: timeFilter,
        },
      });
      uniqueAnonymousUsers = anonymousSessionsResult.length;
    } catch (error) {
      // If query fails, fallback to 0 (don't break the API)
      this.logger.error('Error getting unique anonymous users from database:', error);
    }

    return {
      page: page || 'all',
      zone: zone || 'all',
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      totalViews,
      totalClicks: clickStats,
      totalDurations: Math.round(totalDurations * 100) / 100,
      avgDuration: Math.round(avgDuration * 100) / 100,
      uniqueSessions: uniqueSessionsResult.length,
      uniqueUsers: uniqueUsersResult.length,
      uniqueAnonymousUsers,
    };
  }

  /**
   * Get raw analytics data in table format
   * Returns individual records matching filters, not aggregated totals
   * Marketing can read and process this data directly (like Excel)
   */
  async getAnalysis(query: any) {
    const { from, to, page, zone, action: actionFilter, limit = 100, cursor } =
      query;

    // Validate date range
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // End of day

    if (fromDate > toDate) {
      throw new BadRequestException(
        'From date must be before or equal to to date',
      );
    }

    // Validate date range is not too large (max 90 days for performance)
    const daysDiff = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff > 90) {
      throw new BadRequestException('Date range cannot exceed 90 days');
    }

    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    if (limitNum < 1 || limitNum > 1000) {
      throw new BadRequestException('Limit must be between 1 and 1000');
    }

    // Build where clause for raw events
    // If only page is provided, only count records with that page and zone = null
    // If both page and zone are provided, count records matching both
    const eventWhere: any = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
      // Filter logic: Clicks, Durations (value > 0), and other meaningful actions
      // Exclude pure views (no duration) to focus on interactions
      AND: [
        {
          OR: [
            { action: 'click' },
            { value: { gt: 0 } },
            {
              action: {
                notIn: ['page_view', 'zone_view', 'view', 'click'],
              },
            },
          ],
        },
      ],
    };

    if (page) {
      eventWhere.page = page;
      if (zone) {
        eventWhere.zone = zone;
      } else {
        // If only page is provided, only count page-level records (zone = null)
        eventWhere.zone = null;
      }
    }
    if (actionFilter) eventWhere.action = actionFilter;

    // Get all events from analytics_events table (raw data) with pagination
    const events = await this.prisma.analyticsEvent.findMany({
      where: eventWhere,
      take: limitNum + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const hasMore = events.length > limitNum;
    const paginatedEvents = events.slice(0, limitNum);

    const rows = paginatedEvents.map((event) => {
      let action = event.action;
      let unit = 'event';
      let value = event.value || 1;

      // Normalize action and unit
      if (
        ['page_view', 'zone_view', 'view_end', 'complete'].includes(
          event.action,
        ) &&
        event.value
      ) {
        action = 'duration';
        unit = 'seconds';
      } else if (event.action === 'click') {
        unit = 'click';
      } else {
        // Other actions
        unit = `${event.action}s`;
        if (event.action === 'start') unit = 'starts';
        else if (event.action === 'submit') unit = 'submits';
        else if (event.action === 'complete') unit = 'completions';
        else if (event.action === 'upload') unit = 'uploads';
      }

      return {
        date: event.createdAt.toISOString().split('T')[0],
        timestamp: event.createdAt.toISOString(),
        page: event.page,
        zone: event.zone || null,
        action,
        component: event.component || null,
        value,
        unit,
        metadata: (event.metadata as Record<string, any>) || {},
      };
    });

    const nextCursor = hasMore
      ? paginatedEvents[paginatedEvents.length - 1].id
      : null;

    return {
      columns: [
        'date',
        'timestamp',
        'page',
        'zone',
        'action',
        'component',
        'value',
        'unit',
        'metadata',
      ],
      rows,
      nextCursor,
      count: rows.length,
      hasMore,
    };
  }

  async exportAnalyticsToExcel(
    query: AnalyticsSummaryQueryDto,
    res: Response,
  ) {
    const { from, to, page, zone } = query;

    // Validate date range
    let startDate: Date;
    let endDate: Date;

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      if (startDate > endDate) {
        throw new BadRequestException(
          'From date must be before or equal to to date',
        );
      }
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 90) {
        throw new BadRequestException('Date range cannot exceed 90 days');
      }
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    // Get summary data
    const summary = await this.getSummary(query);

    // Get all analysis data (no pagination)
    const eventWhere: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      AND: [
        {
          OR: [
            { action: 'click' },
            { value: { gt: 0 } },
            {
              action: {
                notIn: ['page_view', 'zone_view', 'view', 'click'],
              },
            },
          ],
        },
      ],
    };

    if (page) {
      eventWhere.page = page;
      if (zone) {
        eventWhere.zone = zone;
      } else {
        eventWhere.zone = null;
      }
    }

    // Get all events (no limit for export)
    const allEvents = await this.prisma.analyticsEvent.findMany({
      where: eventWhere,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform events to analysis rows
    const analysisRows = allEvents.map((event) => {
      let action = event.action;
      let unit = 'event';
      let value = event.value || 1;

      if (
        ['page_view', 'zone_view', 'view_end', 'complete'].includes(
          event.action,
        ) &&
        event.value
      ) {
        action = 'duration';
        unit = 'seconds';
      } else if (event.action === 'click') {
        unit = 'click';
      } else {
        unit = `${event.action}s`;
        if (event.action === 'start') unit = 'starts';
        else if (event.action === 'submit') unit = 'submits';
        else if (event.action === 'complete') unit = 'completions';
        else if (event.action === 'upload') unit = 'uploads';
      }

      return {
        date: event.createdAt.toISOString().split('T')[0],
        timestamp: event.createdAt.toISOString(),
        page: event.page,
        zone: event.zone || null,
        action,
        component: event.component || null,
        value,
        unit,
        metadata: JSON.stringify((event.metadata as Record<string, any>) || {}),
      };
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    summarySheet.addRow({ metric: 'Page', value: summary.page });
    summarySheet.addRow({ metric: 'Zone', value: summary.zone });
    summarySheet.addRow({
      metric: 'Date Range (From)',
      value: summary.dateRange.from,
    });
    summarySheet.addRow({
      metric: 'Date Range (To)',
      value: summary.dateRange.to,
    });
    summarySheet.addRow({ metric: 'Total Views', value: summary.totalViews });
    summarySheet.addRow({
      metric: 'Total Clicks',
      value: summary.totalClicks,
    });
    summarySheet.addRow({
      metric: 'Total Durations (seconds)',
      value: summary.totalDurations,
    });
    summarySheet.addRow({
      metric: 'Average Duration (seconds)',
      value: summary.avgDuration,
    });
    summarySheet.addRow({
      metric: 'Unique Sessions',
      value: summary.uniqueSessions,
    });
    summarySheet.addRow({
      metric: 'Unique Users',
      value: summary.uniqueUsers,
    });
    summarySheet.addRow({
      metric: 'Unique Anonymous Users',
      value: summary.uniqueAnonymousUsers,
    });

    // Sheet 2: Analysis
    const analysisSheet = workbook.addWorksheet('Analysis');
    analysisSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Page', key: 'page', width: 20 },
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Component', key: 'component', width: 25 },
      { header: 'Value', key: 'value', width: 15 },
      { header: 'Unit', key: 'unit', width: 15 },
      { header: 'Metadata', key: 'metadata', width: 40 },
    ];

    analysisSheet.getRow(1).font = { bold: true };
    analysisSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    analysisRows.forEach((row) => {
      analysisSheet.addRow(row);
    });

    // Format date columns
    analysisSheet.getColumn('timestamp').numFmt = 'yyyy-mm-dd hh:mm:ss';

    // Set response headers
    const filename = `analytics_export_${summary.dateRange.from}_to_${summary.dateRange.to}.xlsx`;
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

  /**
   * Get all available actions, pages, zones, and components from analytics data
   * Useful for admin to see what data is available in the system
   */
  async getAvailableData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get distinct values from aggregate table (more efficient)
    const aggregates = await this.prisma.analyticsAggregate.findMany({
      where: {
        date: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        page: true,
        zone: true,
        action: true,
      },
    });

    // Get distinct components from events (not in aggregate table)
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        component: {
          not: null,
        },
      },
      select: {
        component: true,
      },
      distinct: ['component'],
    });

    // Extract unique values
    const pages = new Set<string>();
    const zonesByPage = new Map<string, Set<string>>(); // Group zones by page
    const actions = new Set<string>();
    const components = new Set<string>();

    aggregates.forEach((agg) => {
      if (agg.page) {
        pages.add(agg.page);
        
        // Group zones by page
        if (agg.zone) {
          if (!zonesByPage.has(agg.page)) {
            zonesByPage.set(agg.page, new Set<string>());
          }
          zonesByPage.get(agg.page)!.add(agg.zone);
        }
      }
      if (agg.action) actions.add(agg.action);
    });

    events.forEach((event) => {
      if (event.component) components.add(event.component);
    });

    // Count usage for each action
    const actionCounts = new Map<string, number>();
    aggregates.forEach((agg) => {
      const count = actionCounts.get(agg.action) || 0;
      actionCounts.set(agg.action, count + 1);
    });

    const actionsWithCounts = Array.from(actions)
      .map((action) => ({
        action,
        count: actionCounts.get(action) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Convert zonesByPage Map to object with sorted arrays
    const zonesByPageObject: Record<string, string[]> = {};
    zonesByPage.forEach((zones, page) => {
      zonesByPageObject[page] = Array.from(zones).sort();
    });

    return {
      pages: Array.from(pages).sort(),
      zonesByPage: zonesByPageObject, // Zones grouped by page
      actions: actionsWithCounts,
      components: Array.from(components).sort(),
      commonFunnelSteps: ['start', 'submit', 'complete', 'click', 'page_view'],
      totalRecords: aggregates.length,
      dateRange: {
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    };
  }

  async getMonthlyRankings(page = 1, limit = 20) {
    // Ensure page and limit are numbers
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

    const skip = (pageNum - 1) * limitNum;

    const [rankings, total] = await Promise.all([
      this.prisma.monthlyPostRanking.findMany({
        skip,
        take: limitNum,
        orderBy: [{ month: 'desc' }, { rank: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
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
      }),
      this.prisma.monthlyPostRanking.count(),
    ]);

    return {
      data: rankings,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }
}
