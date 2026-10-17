import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Injectable, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

interface JwtPayload {
  sub: string;
  sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('User does not exist');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account has been disabled');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      throw new ForbiddenException('Session is invalid or has been logged out');
    }

    return {
      id: user.id,
      sessionId: session.id,
    };
  }
}
