import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.userPostAction.deleteMany();
    await prisma.post.deleteMany();
    await prisma.pointLog.deleteMany();
    await prisma.redeemLog.deleteMany();
    await prisma.cornerAnalytics.deleteMany();
    await prisma.user.deleteMany();

    await app.close();
  });

  describe('Authentication', () => {
    it('/api/auth/register (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
      userId = response.body.user.id;
    });

    it('/api/auth/login (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('/api/auth/refresh (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
  });

  describe('Posts', () => {
    let postId: string;

    it('/api/posts (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'EMOJI_CARD',
          caption: 'Test post! 🐅',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('EMOJI_CARD');
      expect(response.body.caption).toBe('Test post! 🐅');

      postId = response.body.id;
    });

    it('/api/posts (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/posts')
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.posts)).toBe(true);
    });

    it('/api/posts/:id (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/posts/${postId}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.caption).toBe('Test post! 🐅');
    });
  });

  describe('Post Actions', () => {
    let postId: string;

    beforeAll(async () => {
      // Create a test post
      const post = await prisma.post.create({
        data: {
          userId,
          type: 'EMOJI_CARD',
          caption: 'Test post for actions',
        },
      });
      postId = post.id;
    });

    it('/api/posts/:id/actions (POST) - Like', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/actions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'LIKE',
          postId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('LIKE');
    });

    it('/api/posts/:id/actions (POST) - Share', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/actions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'SHARE',
          postId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe('SHARE');
    });

    it('/api/posts/:id/actions (POST) - Duplicate like should fail', async () => {
      await request(app.getHttpServer())
        .post(`/api/posts/${postId}/actions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'LIKE',
          postId,
        })
        .expect(409);
    });

    it('/api/posts/:id/actions (DELETE) - Remove like', async () => {
      await request(app.getHttpServer())
        .delete(`/api/posts/${postId}/actions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ type: 'LIKE' })
        .expect(200);
    });
  });

  describe('Points', () => {
    it('/api/points/summary (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/points/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentPoints');
      expect(response.body).toHaveProperty('totalEarned');
      expect(response.body).toHaveProperty('totalSpent');
    });

    it('/api/points/history (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/points/history')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Redeem', () => {
    it('/api/redeems (POST)', async () => {
      // First, give user some points
      await prisma.user.update({
        where: { id: userId },
        data: { points: 2000 },
      });

      const response = await request(app.getHttpServer())
        .post('/api/redeems')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          giftCode: 'voucher50k',
          receiverInfo: {
            name: 'John Doe',
            phone: '+1234567890',
            address: '123 Main St, City, Country',
          },
          payWith: 'points',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.giftCode).toBe('voucher50k');
    });

    it('/api/redeems (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/redeems')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('redeems');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Analytics', () => {
    it('/api/analytics/corner (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/analytics/corner')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          corner: 2,
          durationSec: 120,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.corner).toBe(2);
      expect(response.body.duration).toBe(120);
    });

    it('/api/analytics/user (GET)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/analytics/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('analytics');
      expect(response.body).toHaveProperty('pagination');
    });
  });
});
