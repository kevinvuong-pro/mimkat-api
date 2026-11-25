import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from '@/users/users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '@/storage/storage.service';
import { ImageProcessingService } from '@/image-processing/image-processing.service';

describe('UsersService session location', () => {
  let usersService: UsersService;
  const prisma = {
    session: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch');
    prisma.session.findFirst.mockResolvedValue({ id: 'session-id' });
    prisma.session.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ImageProcessingService, useValue: {} },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores coordinates for the current session', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          address: { city: 'Da Nang', country: 'Vietnam' },
        }),
        { status: 200 },
      ),
    );

    await usersService.updateCurrentSessionLocation('user-id', 'session-id', 16.0544, 108.2022);

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', userId: 'user-id' },
      data: {
        latitude: 16.0544,
        longitude: 108.2022,
        location: 'Da Nang, Vietnam',
      },
    });
  });

  it('rejects when the current session does not belong to the user', async () => {
    prisma.session.findFirst.mockResolvedValue(null);

    await expect(
      usersService.updateCurrentSessionLocation('user-id', 'other-session-id', 16.0544, 108.2022),
    ).rejects.toThrow('Session not found');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stores the coordinates when reverse geocoding is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 503 }));

    await usersService.updateCurrentSessionLocation('user-id', 'session-id', 16.0544, 108.2022);

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', userId: 'user-id' },
      data: {
        latitude: 16.0544,
        longitude: 108.2022,
        location: null,
      },
    });
  });

  it('includes saved coordinates in the active sessions response', async () => {
    prisma.session.findMany.mockResolvedValue([
      {
        id: 'session-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        lastUsedAt: new Date('2026-01-01T00:00:00.000Z'),
        latitude: 16.0544,
        longitude: 108.2022,
        location: 'Da Nang, Vietnam',
        ipAddress: '203.0.113.1',
        deviceName: 'Test device',
        deviceType: 'desktop',
        absoluteExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);
    prisma.session.count.mockResolvedValue(1);

    await expect(usersService.getActiveSessions('user-id', 'session-id')).resolves.toMatchObject({
      items: [
        {
          latitude: 16.0544,
          longitude: 108.2022,
          location: 'Da Nang, Vietnam',
          isCurrent: true,
        },
      ],
      meta: { total: 1 },
    });
  });
});
