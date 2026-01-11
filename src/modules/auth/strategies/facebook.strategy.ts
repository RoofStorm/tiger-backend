import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('OAUTH_FACEBOOK_CLIENT_ID') ||
        configService.get('OAUTH_FB_CLIENT_ID'),
      clientSecret: configService.get('OAUTH_FACEBOOK_CLIENT_SECRET') ||
        configService.get('OAUTH_FB_CLIENT_SECRET'),
      callbackURL: configService.get('OAUTH_FACEBOOK_CALLBACK_URL') ||
        configService.get('OAUTH_FB_CALLBACK_URL'),
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'displayName', 'picture'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: Function,
  ) {
    try {
      const { id, name, emails, photos, displayName } = profile;
      
      // Xử lý trường hợp không có email - tạo email từ providerId
      let email = emails?.[0]?.value;
      if (!email) {
        // Tạo email giả từ Facebook ID để đảm bảo unique
        email = `fb_${id}@facebook.temporary`;
        this.logger.debug(
          `⚠️ Facebook user ${id} không có email, tạo email tạm: ${email}`,
        );
      }

      // Chuẩn hóa tên
      let fullName = displayName;
      if (!fullName && name) {
        fullName = `${name.givenName || ''} ${name.familyName || ''}`.trim();
      }
      if (!fullName) {
        fullName = `Facebook User ${id.substring(0, 8)}`;
      }

      // Chuẩn hóa profile object để truyền vào oauthLogin
      const normalizedProfile = {
        id,
        emails: [{ value: email }],
        displayName: fullName,
        photos: photos ? [{ value: photos[0]?.value }] : [],
      };

      // Gọi oauthLogin để xử lý login/register
      const result = await this.authService.oauthLogin(
        normalizedProfile,
        'facebook',
      );

      // Lưu tokens vào user object để dùng trong callback
      const userWithTokens = {
        ...result.user,
        _tokens: result.accessToken && result.refreshToken ? {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        } : null,
      };

      // Passport cần user object
      done(null, userWithTokens);
    } catch (error) {
      this.logger.error('❌ Facebook OAuth validation error:', error);
      done(error, null);
    }
  }
}

