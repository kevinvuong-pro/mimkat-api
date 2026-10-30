import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Logger, Injectable, BadRequestException } from '@nestjs/common';

import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async verifyEmail(token: string) {
    const tokenDigest = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findUnique({
      where: {
        verificationTokenDigest: tokenDigest,
      },
    });

    if (
      !user ||
      user.isEmailVerified ||
      !user.verificationToken ||
      !user.verificationTokenExpiry ||
      user.verificationTokenExpiry < new Date() ||
      !(await bcrypt.compare(token, user.verificationToken))
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        verificationTokenDigest: null,
      },
    });
  }

  async resendVerificationEmail(email: string, frontendUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new BadRequestException('User not found');

    if (user.isEmailVerified) throw new BadRequestException('Email is already verified');

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(verificationToken, 10);

    // Token expires in 48 hours
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 48);

    // Update user with new token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenExpiry,
        verificationToken: hashedToken,
        verificationTokenDigest: crypto
          .createHash('sha256')
          .update(verificationToken)
          .digest('hex'),
      },
    });

    // Send verification email
    await this.mailService.sendVerificationEmail(email, verificationToken, frontendUrl);
  }

  async forgotPassword(email: string, frontendUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Don't reveal if user exists or not (security best practice)
    // Only allow password reset for accounts that have password capability
    if (!user) {
      throw new BadRequestException(
        'If an account with that email exists, we sent a password reset link.',
      );
    }

    if (!user.password) {
      throw new BadRequestException(
        'If an account with that email exists, we sent a password reset link.',
      );
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Token expires in 1 hour (shorter than email verification for security)
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    // Update user with reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpiry: resetTokenExpiry,
        passwordResetTokenDigest: crypto.createHash('sha256').update(resetToken).digest('hex'),
      },
    });

    // Send password reset email
    try {
      await this.mailService.sendPasswordResetEmail(email, resetToken, frontendUrl);
    } catch (error) {
      // Log email sending errors without failing the password reset flow
      this.logger.error(
        'Failed to send password reset email',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenDigest = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findUnique({
      where: {
        passwordResetTokenDigest: tokenDigest,
      },
    });

    if (
      !user ||
      !user.passwordResetToken ||
      !user.passwordResetTokenExpiry ||
      user.passwordResetTokenExpiry < new Date() ||
      !(await bcrypt.compare(token, user.passwordResetToken))
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
        passwordResetTokenDigest: null,
      },
    });

    // Invalidate all existing sessions for security
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
  }
}
