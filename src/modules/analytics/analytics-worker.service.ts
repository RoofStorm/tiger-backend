import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueueService, QueuedAnalyticsEvent } from './analytics-queue.service';

@Injectable()
export class AnalyticsWorkerService {
  private readonly logger = new Logger(AnalyticsWorkerService.name);
  private readonly BATCH_SIZE = 200;
  private isProcessing = false;

  constructor(
    private prisma: PrismaService,
    private queueService: AnalyticsQueueService,
  ) {}

  /**
   * Process queue and bulk insert to database
   * Runs every 2 seconds to process queued events
   */
  @Cron('*/2 * * * * *') // Every 2 seconds
  async processQueue() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    const queueSize = this.queueService.getQueueSize();
    if (queueSize === 0) {
      return; // No events to process
    }

    this.isProcessing = true;

    try {
      // Get batch from queue
      const batch = this.queueService.flush();
      
      if (batch.length === 0) {
        return;
      }

      // Bulk insert to database
      await this.bulkInsert(batch);
      
      this.logger.debug(`Processed ${batch.length} events from queue`);
    } catch (error) {
      this.logger.error('Error processing analytics queue:', error);
      // Optionally: re-queue failed events or send to dead letter queue
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Bulk insert events to database
   */
  private async bulkInsert(events: QueuedAnalyticsEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // Prepare data for Prisma
      const data = events.map((event) => ({
        userId: event.userId,
        sessionId: event.sessionId,
        isAnonymous: event.isAnonymous,
        page: event.page,
        zone: event.zone,
        component: event.component,
        action: event.action,
        value: event.value,
        metadata: event.metadata,
      }));

      // Bulk insert with skipDuplicates to handle race conditions
      await this.prisma.analyticsEvent.createMany({
        data,
        skipDuplicates: true,
      });

      this.logger.debug(`Bulk inserted ${events.length} analytics events`);
    } catch (error) {
      this.logger.error(`Error bulk inserting ${events.length} events:`, error);
      throw error; // Re-throw to trigger retry logic if needed
    }
  }

  /**
   * Manual trigger for processing queue (useful for testing)
   */
  async triggerProcess(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return {
      queueSize: this.queueService.getQueueSize(),
      isProcessing: this.isProcessing,
    };
  }
}

