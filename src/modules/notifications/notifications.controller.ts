import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Notifications')
@Controller('api/notifications')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getNotifications(
    @Request() req,
    @Query('isRead') isRead?: string,
  ) {
    const userId = req.user.id;
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationsService.getNotifications(userId, isReadBool);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
  })
  async markAsRead(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.notificationsService.markAsRead(id, userId);
  }
}

