import {
  PrismaClient,
  LoginMethod,
  Role,
  UserStatus,
  PostType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tiger.com' },
    update: {},
    create: {
      email: 'admin@tiger.com',
      name: 'Admin User',
      passwordHash: adminPassword,
      loginMethod: LoginMethod.LOCAL,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      points: 1000,
    },
  });

  // Create test user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@tiger.com' },
    update: {},
    create: {
      email: 'user@tiger.com',
      name: 'Test User',
      passwordHash: userPassword,
      loginMethod: LoginMethod.LOCAL,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      points: 500,
    },
  });

  // Create sample posts
  const posts = await Promise.all([
    prisma.post.create({
      data: {
        userId: user.id,
        type: PostType.EMOJI_CARD,
        caption: 'Feeling great today! 🐅',
        likeCount: 5,
        shareCount: 2,
      },
    }),
    prisma.post.create({
      data: {
        userId: user.id,
        type: PostType.CONFESSION,
        caption: 'Sometimes I feel overwhelmed by life...',
        likeCount: 3,
        shareCount: 1,
      },
    }),
    prisma.post.create({
      data: {
        userId: admin.id,
        type: PostType.IMAGE,
        caption: 'Beautiful sunset from my window',
        url: 'https://example.com/sunset.jpg',
        likeCount: 10,
        shareCount: 5,
      },
    }),
  ]);

  // Create rewards
  const rewards = await Promise.all([
    prisma.reward.create({
      data: {
        name: 'Voucher 50k',
        description: 'Phiếu giảm giá 50,000 VNĐ tại các cửa hàng đối tác',
        pointsRequired: 1000,
        imageUrl: 'https://example.com/voucher50k.jpg',
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        name: 'Voucher 100k',
        description: 'Phiếu giảm giá 100,000 VNĐ tại các cửa hàng đối tác',
        pointsRequired: 2000,
        imageUrl: 'https://example.com/voucher100k.jpg',
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        name: 'Premium 1 tháng',
        description: 'Gói Premium 1 tháng với nhiều tính năng đặc biệt',
        pointsRequired: 5000,
        imageUrl: 'https://example.com/premium.jpg',
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        name: 'Sticker Pack',
        description: 'Bộ sticker độc quyền của Tiger',
        pointsRequired: 500,
        imageUrl: 'https://example.com/stickers.jpg',
        isActive: true,
      },
    }),
  ]);

  // Create point logs
  await prisma.pointLog.createMany({
    data: [
      {
        userId: user.id,
        points: 50,
        reason: 'Daily login bonus',
      },
      {
        userId: user.id,
        points: 100,
        reason: 'Share confession',
      },
      {
        userId: admin.id,
        points: 200,
        reason: 'Admin bonus',
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log(`👤 Admin user: admin@tiger.com / admin123`);
  console.log(`👤 Test user: user@tiger.com / user123`);
  console.log(`📝 Created ${posts.length} sample posts`);
  console.log(`🎁 Created ${rewards.length} rewards`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
