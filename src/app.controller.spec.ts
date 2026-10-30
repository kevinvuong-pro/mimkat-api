import { Test, TestingModule } from '@nestjs/testing';

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
    it('should report an ok status', () => {
      expect(appController.getHealth()).resolves.toMatchObject({ status: 'ok' });
    });
  });
});
