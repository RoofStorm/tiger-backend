import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Admin')
@Controller('api/admin')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin statistics' })
  @ApiResponse({
    status: 200,
    description: 'Admin stats retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAdminStats(@Request() req) {
    console.log('🔍 AdminController.getAdminStats called');
    console.log('🔍 Request user:', req.user);
    console.log('🔍 Authorization header:', req.headers.authorization);

    if (!req.user) {
      console.log('❌ No user found in request');
      throw new Error('User not authenticated');
    }

    return this.adminService.getAdminStats(req.user.id);
  }

  @Get('users/export-excel')
  @ApiOperation({ summary: 'Export all users to Excel (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded successfully',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportUsersToExcel(
    @Request() req,
    @Res() res: Response,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.exportUsersToExcel(
      req.user.id,
      res,
      role,
      status,
    );
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUsers(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    return this.adminService.getUsers(
      req.user.id,
      pageNum,
      limitNum,
      role,
      status,
    );
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get all posts (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Posts retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPosts(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('isHighlighted') isHighlighted?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const isHighlightedBool =
      isHighlighted === 'true'
        ? true
        : isHighlighted === 'false'
          ? false
          : undefined;
    const monthNum = month ? parseInt(month.toString(), 10) : undefined;
    const yearNum = year ? parseInt(year.toString(), 10) : undefined;
    return this.adminService.getPosts(
      req.user.id,
      pageNum,
      limitNum,
      isHighlightedBool,
      sortBy,
      sortOrder,
      monthNum,
      yearNum,
    );
  }

  @Get('wishes')
  @ApiOperation({ summary: 'Get all wishes (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Wishes retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getWishes(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('highlighted') highlighted?: string,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    const highlightedBool =
      highlighted === 'true'
        ? true
        : highlighted === 'false'
          ? false
          : undefined;
    return this.adminService.getWishes(
      req.user.id,
      pageNum,
      limitNum,
      highlightedBool,
    );
  }

  @Get('redeems/export-excel')
  @ApiOperation({
    summary: 'Export redeems data to Excel with 2 sheets (Admin only)',
    description:
      'Exports redeems data to Excel file with 2 sheets: Monthly Rankings (Danh sách người thắng giải) and Redeem Requests (Quản lý đổi thưởng)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded successfully',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportRedeemsToExcel(
    @Request() req,
    @Res() res: Response,
    @Query('status') status?: string,
  ) {
    return this.adminService.exportRedeemsToExcel(req.user.id, res, status);
  }

  @Get('redeems')
  @ApiOperation({ summary: 'Get all redeem logs (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Redeem logs retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRedeems(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    return this.adminService.getRedeems(req.user.id, pageNum, limitNum, status);
  }

  @Post('posts/:id/highlight')
  @ApiOperation({ summary: 'Highlight a post (Admin only)' })
  @ApiResponse({ status: 200, description: 'Post highlighted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async highlightPost(@Param('id') postId: string, @Request() req) {
    return this.adminService.highlightPost(postId, req.user.id);
  }

  @Post('posts/:id/unhighlight')
  @ApiOperation({ summary: 'Unhighlight a post (Admin only)' })
  @ApiResponse({ status: 200, description: 'Post unhighlighted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async unhighlightPost(@Param('id') postId: string, @Request() req) {
    return this.adminService.unhighlightPost(postId, req.user.id);
  }

  @Get('redeems')
  @ApiOperation({ summary: 'Get all redeem requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Redeem requests retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRedeemLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminService.getRedeemLogs(page, limit, status);
  }

  @Patch('redeems/:id')
  @ApiOperation({ summary: 'Update redeem status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Redeem status updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateRedeemStatus(
    @Param('id') redeemId: string,
    @Body('status') status: string,
    @Request() req,
  ) {
    return this.adminService.updateRedeemStatus(redeemId, status, req.user.id);
  }
}
