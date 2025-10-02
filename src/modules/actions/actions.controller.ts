import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActionType } from '@prisma/client';

@ApiTags('Post Actions')
@Controller('api/posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post(':id/actions')
  @ApiOperation({ summary: 'Like or share a post' })
  @ApiResponse({ status: 201, description: 'Action created successfully' })
  @ApiResponse({ status: 409, description: 'Action already exists' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async createAction(
    @Param('id') postId: string,
    @Body() createActionDto: CreateActionDto,
    @Request() req,
  ) {
    return this.actionsService.createAction(createActionDto, req.user.id);
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

