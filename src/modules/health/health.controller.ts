import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe - checks if application is alive' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  @ApiResponse({ status: 503, description: 'Application is not responding' })
  @HealthCheck()
  checkLiveness() {
    // Liveness probe - simple check to see if the application is running
    // Returns healthy if the application can respond to HTTP requests
    return this.health.check([]);
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe - checks if application is ready to serve traffic' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  @HealthCheck()
  async checkReadiness() {
    // Readiness probe - checks if critical dependencies are healthy
    // This includes database connectivity
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
    ]);
  }
}
