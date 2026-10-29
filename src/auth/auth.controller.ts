import {
  Get,
  Req,
  Res,
  Body,
  Post,
  HttpCode,
  UseGuards,
  Controller,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { LoginDto } from '@/auth/dto/login.dto';
import { AuthService } from '@/auth/auth.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { DeviceUtil, extractFrontendUrl, isAllowedFrontendUrl } from '@/common/utils';
import { GoogleAuthGuard } from '@/auth/guards/google-auth.guard';
import { Public, CurrentUser, type UserPayload } from '@/common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const frontendUrl = extractFrontendUrl(req);

    return this.authService.register(registerDto, frontendUrl);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  async login(@Req() req: Request, @Body() loginDto: LoginDto) {
    const deviceInfo = await DeviceUtil.extractDeviceInfo(req);

    return this.authService.login(loginDto, deviceInfo);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: UserPayload, @Body() refreshTokenDto: RefreshTokenDto) {
    const refreshToken = refreshTokenDto.refreshToken;

    await this.authService.logout(user.id, refreshToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Req() req: Request, @Body() refreshTokenDto: RefreshTokenDto) {
    const deviceInfo = await DeviceUtil.extractDeviceInfo(req);

    return this.authService.refreshTokens(refreshTokenDto.refreshToken, deviceInfo);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // This route initiates the Google OAuth flow
    // User will be redirected to Google's login page
    // GoogleAuthGuard will automatically handle state parameter
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    // After Google authentication, this callback is triggered
    const deviceInfo = await DeviceUtil.extractDeviceInfo(req);

    const result = await this.authService.googleLogin(req.user as any, deviceInfo);

    // Return tokens in the URL fragment so the frontend can store them locally.
    const redirectUrl = req.query.state;
    if (typeof redirectUrl !== 'string' || !isAllowedFrontendUrl(redirectUrl)) {
      throw new BadRequestException('Invalid OAuth redirect URL');
    }

    const redirect = new URL(redirectUrl);
    redirect.hash = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }).toString();

    res.redirect(redirect.toString());
  }
}
