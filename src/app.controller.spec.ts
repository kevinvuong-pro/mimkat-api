import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';

import { AppService } from '@/app.service';
import { ConfigService } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
        { provide: StorageService, useValue: { healthCheck: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    jest
      .spyOn(appController as AppController & { checkRedis: () => Promise<void> }, 'checkRedis')
      .mockResolvedValue(undefined);
  });

  describe('root', () => {
    it('should return "Hello World!" (raw controller response)', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should return string type', () => {
      const result = appController.getHello();

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('health', () => {
    it('should report an ok status', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        dependencies: {
          database: true,
          redis: true,
          storage: true,
        },
      });
    });

    it('should report unavailable dependencies', async () => {
      const storage = jest
        .spyOn(appController['storage'], 'healthCheck')
        .mockRejectedValue(new Error('storage unavailable'));

      await expect(appController.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);

      storage.mockRestore();
    });
  });
});
