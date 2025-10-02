import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get('OAUTH_FB_CLIENT_ID'),
      clientSecret: configService.get('OAUTH_FB_CLIENT_SECRET'),
      callbackURL: configService.get('OAUTH_FB_CALLBACK_URL'),
      profileFields: ['id', 'emails', 'name', 'picture'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: Function,
  ) {
    const { id, name, emails, photos } = profile;
    const user = {
      id,
      email: emails?.[0]?.value,
      name: `${name?.givenName} ${name?.familyName}`,
      avatar: photos?.[0]?.value,
    };
    done(null, user);
  }
}

