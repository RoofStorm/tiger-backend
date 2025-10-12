import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
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
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { ActionType } from '@prisma/client';

@ApiTags('Post Actions')
@Controller('api/posts')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  @ApiResponse({ status: 201, description: 'Post liked successfully' })
  @ApiResponse({ status: 409, description: 'Post already liked' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async likePost(@Param('id') postId: string, @Request() req) {
    return this.actionsService.createAction(
      { type: 'LIKE', postId },
      req.user.id,
    );
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a post' })
  @ApiResponse({ status: 201, description: 'Post shared successfully' })
  @ApiResponse({ status: 409, description: 'Post already shared' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async sharePost(@Param('id') postId: string, @Request() req) {
    return this.actionsService.createAction(
      { type: 'SHARE', postId },
      req.user.id,
    );
  }

  @Delete(':id/actions')
  @ApiOperation({ summary: 'Remove like from a post' })
  @ApiResponse({ status: 200, description: 'Action removed successfully' })
  @ApiResponse({ status: 404, description: 'Action not found' })
  async removeAction(
    @Param('id') postId: string,
    @Query('type') type: ActionType,
    @Request() req,
  ) {
    return this.actionsService.removeAction(postId, type, req.user.id);
  }
}

@ApiTags('User Actions')
@Controller('api/actions')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class UserActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('user')
  @ApiOperation({ summary: 'Get user actions' })
  @ApiResponse({
    status: 200,
    description: 'User actions retrieved successfully',
  })
  async getUserActions(@Request() req) {
    return this.actionsService.getUserActions(req.user.id);
  }
}
