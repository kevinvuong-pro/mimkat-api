import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Get, Controller, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';

import { AppService } from '@/app.service';
import { Public } from '@/common/decorators';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';

@Controller()
export class AppController implements OnModuleDestroy {
  private redis?: Redis;
  private redisConnection?: Promise<void>;

  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async getHealth(): Promise<{
    status: 'ok';
    dependencies: { redis: boolean; storage: boolean; database: boolean };
  }> {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storage.healthCheck(),
      this.checkRedis(),
    ]);
    const dependencies = {
      redis: checks[2].status === 'fulfilled',
      storage: checks[1].status === 'fulfilled',
      database: checks[0].status === 'fulfilled',
    };

    if (!Object.values(dependencies).every(Boolean)) {
      throw new ServiceUnavailableException({
        dependencies,
        message: 'Health check failed',
      });
    }

    return { status: 'ok', dependencies };
  }

  private async checkRedis(): Promise<void> {
    if (!this.redis || this.redis.status === 'end') {
      this.redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      this.redisConnection = undefined;
    }

    if (this.redis.status === 'wait') {
      this.redisConnection ??= this.redis.connect();

      try {
        await this.redisConnection;
      } catch (error) {
        this.redisConnection = undefined;
        this.redis.disconnect();
        throw error;
      }
    }

    await this.redis.ping();
  }

  onModuleDestroy(): void {
    this.redisConnection = undefined;
    this.redis?.disconnect();
  }
}
