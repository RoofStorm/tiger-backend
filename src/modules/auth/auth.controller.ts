import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { NextAuthGuard } from './guards/nextauth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Get('me')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req: Request) {
    return this.authService.getCurrentUser((req as any).user.id);
  }

  // Facebook OAuth
  @Get('oauth/facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook' })
  async facebookAuth() {
    // Passport will handle the redirect
  }

  @Get('callback/facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    if (!user) {
      return res.redirect(
        `${this.configService.get('CORS_ORIGIN') || 'http://localhost:3000'}/auth/error?error=AccessDenied`,
      );
    }

    // Lấy tokens từ user object (đã được lưu trong strategy)
    let tokens = (user as any)._tokens;
    
    // Nếu không có tokens, generate lại (fallback)
    if (!tokens) {
      tokens = await this.authService.generateTokensForUser(user.id);
    }

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    
    return res.redirect(redirectUrl);
  }

  // Google OAuth
  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google' })
  async googleAuth() {
    // Passport will handle the redirect
  }

  @Get('callback/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    if (!user) {
      return res.redirect(
        `${this.configService.get('CORS_ORIGIN') || 'http://localhost:3000'}/auth/error?error=AccessDenied`,
      );
    }

    // Lấy tokens từ user object (đã được lưu trong strategy)
    let tokens = (user as any)._tokens;
    
    // Nếu không có tokens, generate lại (fallback)
    if (!tokens) {
      tokens = await this.authService.generateTokensForUser(user.id);
    }

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    
    return res.redirect(redirectUrl);
  }

  // OAuth Error Handler
  @Get('error')
  @ApiOperation({ summary: 'OAuth error handler' })
  @ApiResponse({ status: 200, description: 'Error information' })
  async oauthError(@Query('error') error: string, @Res() res: Response) {
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/auth/error?error=${error || 'UnknownError'}`);
  }
}
