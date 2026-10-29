import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      scope: ['email', 'profile'],
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
    });
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    if (!profile) {
      throw new BadRequestException('Google did not return a user profile');
    }

    const { id, name, emails, photos } = profile;
    const email = emails?.[0]?.value;

    if (!id || !email) {
      throw new BadRequestException('Google account did not provide a usable profile');
    }

    const user = {
      email,
      accessToken,
      googleId: id,
      refreshToken,
      avatar: photos?.[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
    };

    done(null, user);
  }
}
