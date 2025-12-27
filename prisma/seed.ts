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

  // Create rewards - Only 4 vouchers: 50k, 100k, 500k, 1000k
  const rewards = await Promise.all([
    // Voucher 50k
    prisma.reward.upsert({
      where: { id: 'voucher-50k' },
      update: {
        name: 'Voucher 50k',
        description: 'Phiếu giảm giá 50,000 VNĐ',
        pointsRequired: 200,
        lifeRequired: null,
        isActive: true,
        maxPerUser: null,
      },
      create: {
        id: 'voucher-50k',
        name: 'Voucher 50k',
        description: 'Phiếu giảm giá 50,000 VNĐ',
        pointsRequired: 200,
        lifeRequired: null,
        imageUrl: null,
        isActive: true,
        maxPerUser: null,
      },
    }),
    // Voucher 100k
    prisma.reward.upsert({
      where: { id: 'voucher-100k' },
      update: {
        name: 'Voucher 100k',
        description: 'Phiếu giảm giá 100,000 VNĐ',
        pointsRequired: 1000,
        lifeRequired: null,
        isActive: true,
        maxPerUser: null,
      },
      create: {
        id: 'voucher-100k',
        name: 'Voucher 100k',
        description: 'Phiếu giảm giá 100,000 VNĐ',
        pointsRequired: 1000,
        lifeRequired: null,
        imageUrl: null,
        isActive: true,
        maxPerUser: null,
      },
    }),
    // Voucher 500k
    prisma.reward.upsert({
      where: { id: 'voucher-500k' },
      update: {
        name: 'Voucher 500k',
        description: 'Phiếu giảm giá 500,000 VNĐ',
        pointsRequired: 5000,
        lifeRequired: null,
        isActive: true,
        maxPerUser: null,
      },
      create: {
        id: 'voucher-500k',
        name: 'Voucher 500k',
        description: 'Phiếu giảm giá 500,000 VNĐ',
        pointsRequired: 5000,
        lifeRequired: null,
        imageUrl: null,
        isActive: true,
        maxPerUser: null,
      },
    }),
    // Voucher 1000k
    prisma.reward.upsert({
      where: { id: 'voucher-1000k' },
      update: {
        name: 'Voucher 1000k',
        description: 'Phiếu giảm giá 1,000,000 VNĐ',
        pointsRequired: 10000,
        lifeRequired: null,
        isActive: true,
        maxPerUser: null,
      },
      create: {
        id: 'voucher-1000k',
        name: 'Voucher 1000k',
        description: 'Phiếu giảm giá 1,000,000 VNĐ',
        pointsRequired: 10000,
        lifeRequired: null,
        imageUrl: null,
        isActive: true,
        maxPerUser: null,
      },
    }),
  ]);

  // Deactivate or delete other rewards (optional - keep for reference)
  // You can uncomment this if you want to remove old rewards
  // await prisma.reward.updateMany({
  //   where: {
  //     id: {
  //       notIn: ['voucher-50k', 'voucher-100k', 'voucher-500k', 'voucher-1000k'],
  //     },
  //   },
  //   data: {
  //     isActive: false,
  //   },
  // });

  // Create sample wishes
  const wishes = await Promise.all([
    prisma.wish.create({
      data: {
        userId: user.id,
        content: 'Chúc mọi người có một ngày tuyệt vời! 🌟',
        isHighlighted: true,
      },
    }),
    prisma.wish.create({
      data: {
        userId: user.id,
        content: 'Hy vọng năm mới sẽ mang đến nhiều niềm vui và hạnh phúc! 🎉',
        isHighlighted: true,
      },
    }),
    prisma.wish.create({
      data: {
        userId: admin.id,
        content: 'Chúc cộng đồng Tiger Mood Corner luôn vui vẻ và gắn kết! 🐅',
        isHighlighted: false,
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
  console.log(`🌟 Created ${wishes.length} sample wishes`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
