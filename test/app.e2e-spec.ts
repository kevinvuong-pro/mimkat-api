import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters';
import { PrismaService } from '@/prisma/prisma.service';
import { ResponseInterceptor } from '@/common/interceptors';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('path', '/');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('statusCode', 200);
        expect(res.body).toHaveProperty('data', 'Hello World!');
        expect(res.body).toHaveProperty('message', 'Data retrieved successfully');
      });
  });

  it('formats HTTP errors without exposing internal details', () => {
    return request(app.getHttpServer())
      .get('/missing-route')
      .expect(404)
      .expect((res) => {
        expect(res.body).toMatchObject({
          success: false,
          statusCode: 404,
          path: '/missing-route',
        });
        expect(res.body).not.toHaveProperty('stack');
      });
  });

  it('returns service unavailable when a health dependency fails', async () => {
    const prisma = app.get(PrismaService);
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect((res) => {
        expect(res.body).toMatchObject({
          success: false,
          statusCode: 503,
          message: 'Health check failed',
        });
        expect(res.body.data).toBeUndefined();
      });
  });
});
