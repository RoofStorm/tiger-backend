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
} from '@nestjs/common';
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
    return this.adminService.getAdminStats(req.user.id);
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
    return this.adminService.getPosts(
      req.user.id,
      pageNum,
      limitNum,
      highlightedBool,
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
