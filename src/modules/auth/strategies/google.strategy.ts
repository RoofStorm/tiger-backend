import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('OAUTH_GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('OAUTH_GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('OAUTH_GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      const { id, name, emails, photos } = profile;

      // Xử lý trường hợp không có email - tạo email từ providerId
      let email = emails?.[0]?.value;
      if (!email) {
        // Tạo email giả từ Google ID để đảm bảo unique
        email = `google_${id}@google.temporary`;
        console.log(
          `⚠️ Google user ${id} không có email, tạo email tạm: ${email}`,
        );
      }

      // Chuẩn hóa tên
      let fullName = '';
      if (name) {
        fullName = `${name.givenName || ''} ${name.familyName || ''}`.trim();
      }
      if (!fullName) {
        fullName = `Google User ${id.substring(0, 8)}`;
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
        'google',
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
      console.error('❌ Google OAuth validation error:', error);
      done(error, null);
    }
  }
}

