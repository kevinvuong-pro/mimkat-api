import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Get, Req, Post, Body, Query, HttpCode, Controller, HttpStatus } from '@nestjs/common';

import { Public } from '@/common/decorators';
import { extractFrontendUrl } from '@/common/utils';
import { ResetPasswordDto } from '@/verification/dto/reset-password.dto';
import { VerificationService } from '@/verification/verification.service';
import { ForgotPasswordDto } from '@/verification/dto/forgot-password.dto';
import { ResendVerificationDto } from '@/verification/dto/resend-verification.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Public()
  @Get('email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    return this.verificationService.verifyEmail(token);
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 12, ttl: 3600000 } }) // 12 requests per 1 hour
  async resendVerification(
    @Req() req: Request,
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    const frontendUrl = extractFrontendUrl(req);

    return this.verificationService.resendVerificationEmail(
      resendVerificationDto.email,
      frontendUrl,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per 1 hour
  async forgotPassword(@Req() req: Request, @Body() forgotPasswordDto: ForgotPasswordDto) {
    const frontendUrl = extractFrontendUrl(req);

    return this.verificationService.forgotPassword(forgotPasswordDto.email, frontendUrl);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per 1 hour
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    await this.verificationService.resetPassword(resetPasswordDto.token, resetPasswordDto.password);

  }
}
