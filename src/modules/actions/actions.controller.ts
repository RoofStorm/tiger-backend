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
import { ShareService } from './share.service';
import { CreateActionDto } from './dto/create-action.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { ActionType } from '@prisma/client';
import { SHARE_LIMITS } from '../../constants/points';

@ApiTags('Post Actions')
@Controller('api/posts')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class ActionsController {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly shareService: ShareService,
  ) {}

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
  @ApiOperation({
    summary: 'Share a post (can share multiple times). Share to Facebook to earn 50 points once lifetime.',
  })
  @ApiResponse({ status: 201, description: 'Post shared successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async sharePost(
    @Param('id') postId: string,
    @Body() body: { platform?: string },
    @Request() req,
  ) {
    const result = await this.actionsService.createAction(
      { type: 'SHARE', postId, platform: body?.platform },
      req.user.id,
    );

    // Award points for sharing to Facebook (first share lifetime)
    const pointsAwarded = await this.shareService.awardShareBonus(
      req.user.id,
      postId,
      'post',
      body?.platform,
    );

    return {
      ...result,
      pointsAwarded,
      pointsMessage: pointsAwarded
        ? `Chúc mừng! Bạn đã nhận được ${SHARE_LIMITS.LIFETIME_SHARE_POINTS} điểm cho việc chia sẻ lên Facebook.`
        : body?.platform === 'facebook'
          ? 'Bài viết đã được chia sẻ thành công. Bạn đã nhận điểm cho việc chia sẻ lên Facebook.'
          : 'Bài viết đã được chia sẻ thành công. Hãy chia sẻ lên Facebook để nhận điểm.',
    };
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
