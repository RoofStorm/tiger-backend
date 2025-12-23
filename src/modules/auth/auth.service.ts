import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PointsService } from '../points/points.service';
import { ReferralService } from '../referral/referral.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { LoginMethod, UserStatus } from '@prisma/client';
import { POINTS } from '../../constants/points';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private pointsService: PointsService,
    private referralService: ReferralService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, referralCode } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    let user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        loginMethod: LoginMethod.LOCAL,
        status: UserStatus.ACTIVE,
      },
    });

    // Auto-generate referral code for new user
    console.log(`🔄 Auto-generating referral code for new user: ${user.id}`);
    const newUserReferralCode =
      await this.referralService.generateReferralCode();
    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { referralCode: newUserReferralCode },
    });
    console.log(
      `✅ Generated referral code for new user: ${newUserReferralCode}`,
    );

    // Process referral if provided
    if (referralCode) {
      const referralResult = await this.referralService.processReferral(
        user.id,
        referralCode,
      );
      if (!referralResult.success) {
        console.log('⚠️ Referral processing failed:', referralResult.message);
        // Don't throw error, just log it - user registration should still succeed
      } else {
        console.log('✅ Referral processed:', referralResult.message);
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Award daily login bonus (automatically handles duplicate prevention)
    // Updated to 10 points per day
    try {
      await this.pointsService.awardPoints(
        user.id,
        POINTS.DAILY_LOGIN_BONUS,
        'Daily login bonus',
      );
      console.log(
        `🎁 Daily login bonus awarded to ${user.email} (+${POINTS.DAILY_LOGIN_BONUS} points)`,
      );
    } catch (error) {
      // Silently fail if daily bonus already awarded or limit reached
      // This prevents login failure due to bonus issues
      if (error instanceof BadRequestException) {
        console.log(
          `ℹ️ Daily login bonus already awarded today for ${user.email}`,
        );
      } else {
        console.error(
          `❌ Error awarding daily login bonus to ${user.email}:`,
          error,
        );
      }
    }

    // Reload user to get updated points value
    const updatedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(updatedUser || user),
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token không hợp lệ');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (isPasswordValid && user.status === UserStatus.ACTIVE) {
        return this.usersService.sanitizeUser(user);
      }
    }

    return null;
  }

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      return this.usersService.sanitizeUser(user);
    }

    return null;
  }

  async oauthLoginFromRequest(
    oauthDto: {
      providerId: string;
      email: string;
      name?: string;
      avatarUrl?: string;
    },
    provider: 'google' | 'facebook',
  ) {
    const { providerId, email, name, avatarUrl } = oauthDto;

    // Tìm user theo email hoặc providerId + loginMethod
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Nếu không tìm thấy theo email, thử tìm theo providerId
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          providerId,
          loginMethod:
            provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
        },
      });
    }

    if (user) {
      // Update existing user with OAuth info if needed
      const updateData: any = {};

      // Cập nhật providerId nếu chưa có hoặc khác
      if (!user.providerId || user.providerId !== providerId) {
        updateData.providerId = providerId;
      }

      // Cập nhật loginMethod nếu là LOCAL
      if (user.loginMethod === LoginMethod.LOCAL) {
        updateData.loginMethod =
          provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK;
      }

      // Cập nhật avatar nếu có và khác với hiện tại
      if (avatarUrl && user.avatarUrl !== avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      // Cập nhật name nếu có và user chưa có name
      if (name && !user.name) {
        updateData.name = name;
      }

      // Cập nhật email nếu email hiện tại là temporary và có email mới
      if (
        email &&
        !email.includes('.temporary') &&
        user.email.includes('.temporary')
      ) {
        updateData.email = email;
      }

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      // Auto-generate referral code if user doesn't have one
      if (!user.referralCode) {
        console.log(
          `🔄 Auto-generating referral code for existing ${provider} user: ${user.id}`,
        );
        const newUserReferralCode =
          await this.referralService.generateReferralCode();
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: newUserReferralCode },
        });
        console.log(
          `✅ Generated referral code for existing ${provider} user: ${newUserReferralCode}`,
        );
      }

      // Award daily login bonus (automatically handles duplicate prevention)
      try {
        await this.pointsService.awardPoints(
          user.id,
          POINTS.DAILY_LOGIN_BONUS,
          'Daily login bonus',
        );
        console.log(
          `🎁 Daily login bonus awarded to ${user.email} (+${POINTS.DAILY_LOGIN_BONUS} points)`,
        );
      } catch (error) {
        // Silently fail if daily bonus already awarded or limit reached
        if (error instanceof BadRequestException) {
          console.log(
            `ℹ️ Daily login bonus already awarded today for ${user.email}`,
          );
        } else {
          console.error(
            `❌ Error awarding daily login bonus to ${user.email}:`,
            error,
          );
        }
      }

      // Reload user to get updated points value
      const updatedUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });
      user = updatedUser || user;
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name: name || `${provider} User`,
          avatarUrl,
          loginMethod:
            provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
          providerId,
          status: UserStatus.ACTIVE,
        },
      });

      // Auto-generate referral code for new OAuth user
      console.log(
        `🔄 Auto-generating referral code for new ${provider} user: ${user.id}`,
      );
      const newUserReferralCode =
        await this.referralService.generateReferralCode();
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { referralCode: newUserReferralCode },
      });
      console.log(
        `✅ Generated referral code for new ${provider} user: ${newUserReferralCode}`,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async oauthLogin(profile: any, provider: 'google' | 'facebook') {
    const { id, emails, displayName, photos } = profile;
    const email = emails?.[0]?.value;

    // Nếu không có email, đã được xử lý ở strategy (tạo email tạm)
    // Nhưng vẫn kiểm tra để đảm bảo an toàn
    if (!email) {
      throw new BadRequestException(
        'Không thể lấy email từ nhà cung cấp OAuth',
      );
    }

    // Tìm user theo email hoặc providerId
    // Ưu tiên tìm theo email trước
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Nếu không tìm thấy theo email, thử tìm theo providerId
    // (trường hợp user đã đăng ký với email khác nhưng cùng providerId)
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          providerId: id,
          loginMethod:
            provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
        },
      });
    }

    if (user) {
      // Update existing user with OAuth info if needed
      const updateData: any = {};

      // Cập nhật providerId nếu chưa có hoặc khác
      if (!user.providerId || user.providerId !== id) {
        updateData.providerId = id;
      }

      // Cập nhật loginMethod nếu là LOCAL
      if (user.loginMethod === LoginMethod.LOCAL) {
        updateData.loginMethod =
          provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK;
      }

      // Cập nhật avatar nếu có
      if (photos?.[0]?.value && !user.avatarUrl) {
        updateData.avatarUrl = photos[0].value;
      }

      // Cập nhật name nếu có và user chưa có name
      if (displayName && !user.name) {
        updateData.name = displayName;
      }

      // Cập nhật email nếu email hiện tại là temporary và có email mới
      if (email && !email.includes('.temporary') && user.email.includes('.temporary')) {
        updateData.email = email;
      }

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      // Auto-generate referral code if user doesn't have one
      if (!user.referralCode) {
        console.log(
          `🔄 Auto-generating referral code for existing ${provider} user: ${user.id}`,
        );
        const newUserReferralCode =
          await this.referralService.generateReferralCode();
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: newUserReferralCode },
        });
        console.log(
          `✅ Generated referral code for existing ${provider} user: ${newUserReferralCode}`,
        );
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName || `${provider} User`,
          avatarUrl: photos?.[0]?.value,
          loginMethod:
            provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
          providerId: id,
          status: UserStatus.ACTIVE,
        },
      });

      // Auto-generate referral code for new OAuth user
      console.log(
        `🔄 Auto-generating referral code for new ${provider} user: ${user.id}`,
      );
      const newUserReferralCode =
        await this.referralService.generateReferralCode();
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { referralCode: newUserReferralCode },
      });
      console.log(
        `✅ Generated referral code for new ${provider} user: ${newUserReferralCode}`,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    return this.usersService.sanitizeUser(user);
  }

  async logout(userId: string) {
    // Invalidate refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async generateTokensForUser(userId: string) {
    return this.generateTokens(userId);
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId };
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Store refresh token in database
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }
}
