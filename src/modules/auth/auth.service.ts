import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PointsService } from '../points/points.service';
import { ReferralService } from '../referral/referral.service';
import { AnonymousConversionService } from '../../common/services/anonymous-conversion.service';
import { LoginDto, RegisterDto, RefreshTokenDto, ChangePasswordDto } from './dto/auth.dto';
import { LoginMethod, UserStatus } from '@prisma/client';
import { POINTS } from '../../constants/points';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private pointsService: PointsService,
    private referralService: ReferralService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private anonymousConversionService: AnonymousConversionService,
  ) {}

  // Check if this is user's first login
  // Returns true if user has never received daily login bonus or first login bonus
  private async isFirstLogin(userId: string): Promise<boolean> {
    const hasLoginBonus = await this.prisma.pointLog.findFirst({
      where: {
        userId,
        reason: {
          in: ['Daily login bonus', 'First login bonus'],
        },
      },
    });

    return !hasLoginBonus;
  }

  // Check if user has received First login bonus today
  // Returns true if user has received First login bonus in today
  private async hasReceivedFirstLoginBonusToday(userId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hasFirstLoginBonusToday = await this.prisma.pointLog.findFirst({
      where: {
        userId,
        reason: 'First login bonus',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return !!hasFirstLoginBonusToday;
  }

  async register(registerDto: RegisterDto, anonymousId?: string) {
    if (this.configService.get<string>('LOCAL_REGISTRATION_ENABLED') !== 'true') {
      throw new ForbiddenException('Không thể tạo tài khoản.');
    }

    const { username, password, email, name, referralCode } = registerDto;

    // Validate: must have either username or email
    if (!username && !email) {
      throw new BadRequestException('Phải cung cấp username hoặc email');
    }

    // Generate username from email if username not provided
    let finalUsername = username;
    if (!finalUsername && email) {
      // Extract username from email (part before @)
      finalUsername = email.split('@')[0];
      // Clean username: remove special characters, keep only alphanumeric and underscore
      finalUsername = finalUsername.replace(/[^a-zA-Z0-9_]/g, '');
      // Ensure minimum length
      if (finalUsername.length < 3) {
        finalUsername = finalUsername + '123'; // Add suffix if too short
      }
      // Check if generated username already exists, add random suffix if needed
      let checkUsername = finalUsername;
      let counter = 1;
      while (await this.usersService.findByUsername(checkUsername)) {
        checkUsername = `${finalUsername}${counter}`;
        counter++;
      }
      finalUsername = checkUsername;
    }

    // Check if username already exists
    const existingUserByUsername = await this.usersService.findByUsername(finalUsername);

    if (existingUserByUsername) {
      throw new ConflictException('Username này đã được sử dụng');
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        throw new ConflictException('Email này đã được sử dụng');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    // For local accounts, email is optional but username is required
    // If email not provided, create a temporary email from username
    const userEmail = email || `${finalUsername}@local.temporary`;

    let user = await this.prisma.user.create({
      data: {
        username: finalUsername,
        email: userEmail,
        passwordHash,
        name,
        loginMethod: LoginMethod.LOCAL,
        status: UserStatus.ACTIVE,
      },
    });

    // Auto-generate referral code for new user
    this.logger.debug(`🔄 Auto-generating referral code for new user: ${user.id}`);
    const newUserReferralCode =
      await this.referralService.generateReferralCode();
    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { referralCode: newUserReferralCode },
    });
    this.logger.debug(
      `✅ Generated referral code for new user: ${newUserReferralCode}`,
    );

    // Process referral if provided
    if (referralCode) {
      const referralResult = await this.referralService.processReferral(
        user.id,
        referralCode,
      );
      if (!referralResult.success) {
        this.logger.debug('⚠️ Referral processing failed:', referralResult.message);
        // Don't throw error, just log it - user registration should still succeed
      } else {
        this.logger.debug('✅ Referral processed:', referralResult.message);
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto, anonymousId?: string) {
    const { username, password } = loginDto;

    // Try to find user by username first
    let user = await this.usersService.findByUsername(username);

    // If not found by username, try to find by email
    if (!user) {
      user = await this.usersService.findByEmail(username);
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Username/Email hoặc mật khẩu không đúng');
    }

    // Check if user is using LOCAL login method
    if (user.loginMethod !== LoginMethod.LOCAL) {
      throw new UnauthorizedException('Tài khoản này không sử dụng đăng nhập bằng username/password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Username/Email hoặc mật khẩu không đúng');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Check if this is first login
    const isFirst = await this.isFirstLogin(user.id);
    let pointsAwarded = false;
    let pointsMessage = 'Đăng nhập thành công.';

    if (isFirst) {
      // Award first login bonus (200 points, replaces daily login bonus)
      try {
        await this.pointsService.awardPoints(
          user.id,
          POINTS.FIRST_LOGIN_BONUS,
          'First login bonus',
        );
        pointsAwarded = true;
        pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.FIRST_LOGIN_BONUS} điểm cho lần đăng nhập đầu tiên.`;
        this.logger.debug(
          `🎁 First login bonus awarded to ${user.username || user.email} (+${POINTS.FIRST_LOGIN_BONUS} points)`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error awarding first login bonus to ${user.username || user.email}:`,
          error,
        );
      }
    } else {
      // Check if user has already received First login bonus today
      // If yes, don't award Daily login bonus
      const hasFirstLoginBonusToday = await this.hasReceivedFirstLoginBonusToday(user.id);
      
      if (hasFirstLoginBonusToday) {
        this.logger.debug(
          `ℹ️ User ${user.username || user.email} already received First login bonus today, skipping Daily login bonus`,
        );
      } else {
        // Award daily login bonus (automatically handles duplicate prevention)
        // pointsAwarded will only be true if points were actually awarded
        // If user already received bonus today, awardPoints will throw BadRequestException
        // and pointsAwarded will remain false
        try {
          await this.pointsService.awardPoints(
            user.id,
            POINTS.DAILY_LOGIN_BONUS,
            'Daily login bonus',
          );
          pointsAwarded = true; // Only set to true if award was successful
          pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.DAILY_LOGIN_BONUS} điểm đăng nhập hôm nay.`;
          this.logger.debug(
            `🎁 Daily login bonus awarded to ${user.username || user.email} (+${POINTS.DAILY_LOGIN_BONUS} points)`,
          );
        } catch (error) {
          // Silently fail if daily bonus already awarded or limit reached
          // This prevents login failure due to bonus issues
          if (error instanceof BadRequestException) {
            this.logger.debug(
              `ℹ️ Daily login bonus already awarded today for ${user.username || user.email}`,
            );
          } else {
            this.logger.error(
              `❌ Error awarding daily login bonus to ${user.username || user.email}:`,
              error,
            );
          }
        }
      }
    }

    // Track anonymous to logged-in conversion if anonymousId exists
    if (anonymousId) {
      await this.anonymousConversionService.trackConversion(
        anonymousId,
        user.id,
      );
    }

    // Reload user to get updated points value
    const updatedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(updatedUser || user),
      pointsAwarded,
      pointsMessage,
      isFirstLogin: isFirst,
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

  async validateUser(username: string, password: string) {
    // Try to find user by username first
    let user = await this.usersService.findByUsername(username);

    // If not found by username, try to find by email
    if (!user) {
      user = await this.usersService.findByEmail(username);
    }

    if (user && user.passwordHash && user.loginMethod === LoginMethod.LOCAL) {
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
    anonymousId?: string,
  ) {
    const { providerId, email, name, avatarUrl } = oauthDto;
    let pointsAwarded = false;
    let isFirstLoginBonus = false;
    let isFirstLogin = false;

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
        this.logger.debug(
          `🔄 Auto-generating referral code for existing ${provider} user: ${user.id}`,
        );
        const newUserReferralCode =
          await this.referralService.generateReferralCode();
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: newUserReferralCode },
        });
        this.logger.debug(
          `✅ Generated referral code for existing ${provider} user: ${newUserReferralCode}`,
        );
      }

      // Check if this is first login
      const isFirst = await this.isFirstLogin(user.id);
      isFirstLogin = isFirst;
      if (isFirst) {
        // Award first login bonus (200 points, replaces daily login bonus)
        try {
          await this.pointsService.awardPoints(
            user.id,
            POINTS.FIRST_LOGIN_BONUS,
            'First login bonus',
          );
          pointsAwarded = true;
          isFirstLoginBonus = true;
          this.logger.debug(
            `🎁 First login bonus awarded to ${user.email} (+${POINTS.FIRST_LOGIN_BONUS} points)`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error awarding first login bonus to ${user.email}:`,
            error,
          );
        }
      } else {
        // Check if user has already received First login bonus today
        // If yes, don't award Daily login bonus
        const hasFirstLoginBonusToday = await this.hasReceivedFirstLoginBonusToday(user.id);
        
        if (hasFirstLoginBonusToday) {
          this.logger.debug(
            `ℹ️ User ${user.email} already received First login bonus today, skipping Daily login bonus`,
          );
        } else {
          // Award daily login bonus (automatically handles duplicate prevention)
          // pointsAwarded will only be true if points were actually awarded
          // If user already received bonus today, awardPoints will throw BadRequestException
          // and pointsAwarded will remain false
          try {
            await this.pointsService.awardPoints(
              user.id,
              POINTS.DAILY_LOGIN_BONUS,
              'Daily login bonus',
            );
            pointsAwarded = true; // Only set to true if award was successful
            this.logger.debug(
              `🎁 Daily login bonus awarded to ${user.email} (+${POINTS.DAILY_LOGIN_BONUS} points)`,
            );
          } catch (error) {
            // Silently fail if daily bonus already awarded or limit reached
            if (error instanceof BadRequestException) {
              this.logger.debug(
                `ℹ️ Daily login bonus already awarded today for ${user.email}`,
              );
            } else {
              this.logger.error(
                `❌ Error awarding daily login bonus to ${user.email}:`,
                error,
              );
            }
          }
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
      this.logger.debug(
        `🔄 Auto-generating referral code for new ${provider} user: ${user.id}`,
      );
      const newUserReferralCode =
        await this.referralService.generateReferralCode();
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { referralCode: newUserReferralCode },
      });
      this.logger.debug(
        `✅ Generated referral code for new ${provider} user: ${newUserReferralCode}`,
      );

      // Award first login bonus for new user (200 points, replaces daily login bonus)
      // New user is always first login
      isFirstLogin = true;
      try {
        await this.pointsService.awardPoints(
          user.id,
          POINTS.FIRST_LOGIN_BONUS,
          'First login bonus',
        );
        pointsAwarded = true;
        isFirstLoginBonus = true;
        this.logger.debug(
          `🎁 First login bonus awarded to new ${provider} user ${user.email} (+${POINTS.FIRST_LOGIN_BONUS} points)`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error awarding first login bonus to new ${provider} user ${user.email}:`,
          error,
        );
      }
    }

    // Track anonymous to logged-in conversion if anonymousId exists
    if (anonymousId) {
      await this.anonymousConversionService.trackConversion(
        anonymousId,
        user.id,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Determine points message
    let pointsMessage = 'Đăng nhập thành công.';
    if (pointsAwarded) {
      if (isFirstLoginBonus) {
        pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.FIRST_LOGIN_BONUS} điểm cho lần đăng nhập đầu tiên.`;
      } else {
        pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.DAILY_LOGIN_BONUS} điểm đăng nhập hôm nay.`;
      }
    }

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
      pointsAwarded,
      pointsMessage,
      isFirstLogin,
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
        this.logger.debug(
          `🔄 Auto-generating referral code for existing ${provider} user: ${user.id}`,
        );
        const newUserReferralCode =
          await this.referralService.generateReferralCode();
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: newUserReferralCode },
        });
        this.logger.debug(
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
      this.logger.debug(
        `🔄 Auto-generating referral code for new ${provider} user: ${user.id}`,
      );
      const newUserReferralCode =
        await this.referralService.generateReferralCode();
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { referralCode: newUserReferralCode },
      });
      this.logger.debug(
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

  async getSession(userId: string, accessToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    // If access token is provided, decode it to get expiration time
    // Otherwise, generate new tokens
    let tokens: { accessToken: string; refreshToken: string };
    let expires: Date;

    if (accessToken) {
      try {
        // Decode token to get expiration
        const decoded = this.jwtService.decode(accessToken) as any;
        if (decoded && decoded.exp) {
          // Convert expiration timestamp to Date
          expires = new Date(decoded.exp * 1000);
        } else {
          // If can't decode, generate new tokens
          tokens = await this.generateTokens(userId);
          const newDecoded = this.jwtService.decode(tokens.accessToken) as any;
          expires = new Date(newDecoded.exp * 1000);
        }
        // Use existing refresh token from database
        tokens = {
          accessToken,
          refreshToken: user.refreshToken || '',
        };
      } catch (error) {
        // If token is invalid, generate new tokens
        tokens = await this.generateTokens(userId);
        const decoded = this.jwtService.decode(tokens.accessToken) as any;
        expires = new Date(decoded.exp * 1000);
      }
    } else {
      // Generate new tokens if no access token provided
      tokens = await this.generateTokens(userId);
      const decoded = this.jwtService.decode(tokens.accessToken) as any;
      expires = new Date(decoded.exp * 1000);
    }

    // Check if this is first login
    const isFirst = await this.isFirstLogin(user.id);
    const isFirstLogin = isFirst;
    let pointsAwarded = false;
    let pointsMessage = 'Đã cập nhật phiên đăng nhập.';

    if (isFirst) {
      // Award first login bonus (200 points, replaces daily login bonus)
      try {
        await this.pointsService.awardPoints(
          user.id,
          POINTS.FIRST_LOGIN_BONUS,
          'First login bonus',
        );
        pointsAwarded = true;
        pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.FIRST_LOGIN_BONUS} điểm cho lần đăng nhập đầu tiên.`;
        this.logger.debug(
          `🎁 First login bonus awarded via session to ${user.username || user.email} (+${POINTS.FIRST_LOGIN_BONUS} points)`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error awarding first login bonus via session to ${user.username || user.email}:`,
          error,
        );
      }
    } else {
      // Check if user has already received First login bonus today
      // If yes, don't award Daily login bonus
      const hasFirstLoginBonusToday = await this.hasReceivedFirstLoginBonusToday(user.id);
      
      if (hasFirstLoginBonusToday) {
        this.logger.debug(
          `ℹ️ User ${user.username || user.email} already received First login bonus today, skipping Daily login bonus`,
        );
      } else {
        // Award daily login bonus (automatically handles duplicate prevention)
        // This allows users to get daily bonus even if they don't login again
        // because refresh token is valid for 7 days
        // pointsAwarded will only be true if points were actually awarded
        // If user already received bonus today, awardPoints will throw BadRequestException
        // and pointsAwarded will remain false
        try {
          await this.pointsService.awardPoints(
            user.id,
            POINTS.DAILY_LOGIN_BONUS,
            'Daily login bonus',
          );
          pointsAwarded = true; // Only set to true if award was successful
          pointsMessage = `Chúc mừng! Bạn đã nhận được ${POINTS.DAILY_LOGIN_BONUS} điểm đăng nhập hôm nay.`;
          this.logger.debug(
            `🎁 Daily login bonus awarded via session to ${user.username || user.email} (+${POINTS.DAILY_LOGIN_BONUS} points)`,
          );
        } catch (error) {
          // Silently fail if daily bonus already awarded or limit reached
          // This prevents session check failure due to bonus issues
          if (error instanceof BadRequestException) {
            this.logger.debug(
              `ℹ️ Daily login bonus already awarded today for ${user.username || user.email}`,
            );
          } else {
            this.logger.error(
              `❌ Error awarding daily login bonus via session to ${user.username || user.email}:`,
              error,
            );
          }
        }
      }
    }

    // Reload user to get updated points value
    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return {
      user: this.usersService.sanitizeUser(updatedUser || user),
      expires,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      pointsAwarded,
      pointsMessage,
      isFirstLogin,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    // Check if user is using LOCAL login method
    if (user.loginMethod !== LoginMethod.LOCAL) {
      throw new BadRequestException(
        'Chỉ tài khoản đăng ký bằng email/mật khẩu mới có thể đổi mật khẩu',
      );
    }

    // Check if user has password hash
    if (!user.passwordHash) {
      throw new BadRequestException('Tài khoản này chưa có mật khẩu');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác với mật khẩu cũ',
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      message: 'Đổi mật khẩu thành công',
    };
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
