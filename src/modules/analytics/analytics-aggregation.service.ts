import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { getVietnamTime, getStartOfDayVietnam } from '../../common/utils/date.utils';

@Injectable()
export class AnalyticsAggregationService {
  private readonly logger = new Logger(AnalyticsAggregationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Aggregate analytics events into aggregate table
   * Runs every 5 minutes to keep aggregate table up to date
   * Groups by: page, zone, action, date, hour (time bucket)
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async aggregateEvents() {
    this.logger.log('Starting analytics aggregation...');

    try {
      // Get the last aggregation time (or default to 1 hour ago)
      const lastAggregation = await this.getLastAggregationTime();
      const endTime = getVietnamTime();
      const startTime = lastAggregation || new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

      // Aggregate by page, zone, action, date, and hour
      const aggregates = await this.prisma.$queryRaw<
        Array<{
          page: string;
          zone: string | null;
          action: string;
          date: Date;
          hour: number;
          totalEvents: bigint;
          totalValue: bigint | null;
          avgValue: number | null;
          uniqueSessions: bigint;
        }>
      >`
        SELECT
          page,
          zone,
          action,
          DATE("createdAt") as date,
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*)::bigint as "totalEvents",
          SUM(value)::bigint as "totalValue",
          AVG(value)::float as "avgValue",
          COUNT(DISTINCT "sessionId")::bigint as "uniqueSessions"
        FROM analytics_events
        WHERE "createdAt" >= ${startTime}
          AND "createdAt" < ${endTime}
        GROUP BY
          page,
          zone,
          action,
          DATE("createdAt"),
          EXTRACT(HOUR FROM "createdAt")
        ORDER BY date DESC, hour DESC
      `;

      // Upsert aggregates
      for (const agg of aggregates) {
        // Use empty string for null zone in unique constraint
        const zoneForUnique = agg.zone || '';
        await this.prisma.analyticsAggregate.upsert({
          where: {
            page_zone_action_date_hour: {
              page: agg.page,
              zone: zoneForUnique,
              action: agg.action,
              date: agg.date,
              hour: agg.hour,
            },
          },
          update: {
            totalEvents: Number(agg.totalEvents),
            totalValue: agg.totalValue ? Number(agg.totalValue) : null,
            avgValue: agg.avgValue || null,
            uniqueSessions: Number(agg.uniqueSessions),
            updatedAt: getVietnamTime(),
          },
          create: {
            page: agg.page,
            zone: zoneForUnique || null, // Use same value as unique constraint
            action: agg.action,
            date: agg.date,
            hour: agg.hour,
            totalEvents: Number(agg.totalEvents),
            totalValue: agg.totalValue ? Number(agg.totalValue) : null,
            avgValue: agg.avgValue || null,
            uniqueSessions: Number(agg.uniqueSessions),
          },
        });
      }

      this.logger.log(
        `Aggregation completed: ${aggregates.length} aggregates processed`,
      );
    } catch (error) {
      this.logger.error('Error during aggregation:', error);
    }
  }

  /**
   * Daily aggregation (runs at midnight)
   * Aggregates by day (without hour) for daily summaries
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDaily() {
    this.logger.log('Starting daily analytics aggregation...');

    try {
      const today = getStartOfDayVietnam();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Aggregate by page, zone, action, and date (without hour)
      const aggregates = await this.prisma.$queryRaw<
        Array<{
          page: string;
          zone: string | null;
          action: string;
          date: Date;
          totalEvents: bigint;
          totalValue: bigint | null;
          avgValue: number | null;
          uniqueSessions: bigint;
        }>
      >`
        SELECT
          page,
          zone,
          action,
          DATE("createdAt") as date,
          COUNT(*)::bigint as "totalEvents",
          SUM(value)::bigint as "totalValue",
          AVG(value)::float as "avgValue",
          COUNT(DISTINCT "sessionId")::bigint as "uniqueSessions"
        FROM analytics_events
        WHERE "createdAt" >= ${yesterday}
          AND "createdAt" < ${today}
        GROUP BY
          page,
          zone,
          action,
          DATE("createdAt")
      `;

      // Upsert daily aggregates (hour = -1 for daily aggregates)
      for (const agg of aggregates) {
        // Use empty string for null zone in unique constraint
        const zoneForUnique = agg.zone || '';
        await this.prisma.analyticsAggregate.upsert({
          where: {
            page_zone_action_date_hour: {
              page: agg.page,
              zone: zoneForUnique,
              action: agg.action,
              date: agg.date,
              hour: -1,
            },
          },
          update: {
            totalEvents: Number(agg.totalEvents),
            totalValue: agg.totalValue ? Number(agg.totalValue) : null,
            avgValue: agg.avgValue || null,
            uniqueSessions: Number(agg.uniqueSessions),
            updatedAt: getVietnamTime(),
          },
          create: {
            page: agg.page,
            zone: zoneForUnique || null, // Use same value as unique constraint
            action: agg.action,
            date: agg.date,
            hour: -1,
            totalEvents: Number(agg.totalEvents),
            totalValue: agg.totalValue ? Number(agg.totalValue) : null,
            avgValue: agg.avgValue || null,
            uniqueSessions: Number(agg.uniqueSessions),
          },
        });
      }

      this.logger.log(
        `Daily aggregation completed: ${aggregates.length} aggregates processed`,
      );
    } catch (error) {
      this.logger.error('Error during daily aggregation:', error);
    }
  }

  /**
   * Cleanup old raw events (DISABLED - Short-term project, no cleanup needed)
   * Deletes events older than 90 days to manage storage
   * 
   * NOTE: Disabled for short-term project (3-4 months duration)
   * If needed in the future, uncomment @Cron decorator below
   */
  // @Cron('0 2 * * *') // Daily at 2 AM - DISABLED
  async cleanupOldEvents() {
    // Database cleanup disabled for short-term project
    // All analytics data will be kept in database
    this.logger.log('Database cleanup is disabled for short-term project (3-4 months)');
    return;

    // Original cleanup code (kept for future reference):
    // this.logger.log('Starting cleanup of old analytics events...');
    // try {
    //   const cutoffDate = getVietnamTime();
    //   cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days retention
    //   const result = await this.prisma.analyticsEvent.deleteMany({
    //     where: {
    //       createdAt: {
    //         lt: cutoffDate,
    //       },
    //     },
    //   });
    //   this.logger.log(`Cleanup completed: ${result.count} old events deleted`);
    // } catch (error) {
    //   this.logger.error('Error during cleanup:', error);
    // }
  }

  /**
   * Get the last aggregation time from the most recent aggregate record
   */
  private async getLastAggregationTime(): Promise<Date | null> {
    const lastAggregate = await this.prisma.analyticsAggregate.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return lastAggregate?.updatedAt || null;
  }

  /**
   * Manual trigger for aggregation (useful for testing or immediate aggregation)
   */
  async triggerAggregation() {
    await this.aggregateEvents();
  }
}

