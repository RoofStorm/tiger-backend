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
    // Voucher 50k - 200 điểm năng lượng (giới hạn 3 lần/user)
    prisma.reward.create({
      data: {
        name: 'Voucher 50k cho sản phẩm Tiger',
        description: 'Phiếu giảm giá 50,000 VNĐ cho sản phẩm Tiger',
        pointsRequired: 200,
        lifeRequired: null,
        imageUrl: 'https://example.com/voucher50k-tiger.jpg',
        isActive: true,
        maxPerUser: 3,
      },
    }),
    // Voucher 100k - 300 điểm năng lượng (giới hạn 3 lần/user)
    prisma.reward.create({
      data: {
        name: 'Voucher 100k cho sản phẩm Tiger',
        description: 'Phiếu giảm giá 100,000 VNĐ cho sản phẩm Tiger',
        pointsRequired: 300,
        lifeRequired: null,
        imageUrl: 'https://example.com/voucher100k-tiger.jpg',
        isActive: true,
        maxPerUser: 3,
      },
    }),
    // Voucher 300k - 500 điểm năng lượng (giới hạn 3 lần/user)
    prisma.reward.create({
      data: {
        name: 'Voucher 300k cho sản phẩm Tiger',
        description: 'Phiếu giảm giá 300,000 VNĐ cho sản phẩm Tiger',
        pointsRequired: 500,
        lifeRequired: null,
        imageUrl: 'https://example.com/voucher300k-tiger.jpg',
        isActive: true,
        maxPerUser: 3,
      },
    }),
    // Hộp cơm Tiger - 1 Nhịp sống (giới hạn 1 lần/user)
    prisma.reward.create({
      data: {
        name: 'Hộp cơm Tiger',
        description: 'Hộp cơm Tiger cao cấp, giữ nhiệt tốt',
        pointsRequired: 0,
        lifeRequired: 1,
        imageUrl: 'https://example.com/lunchbox-tiger.jpg',
        isActive: true,
        maxPerUser: 1,
      },
    }),
    // Bình giữ nhiệt Tiger - 2 Nhịp sống (giới hạn 1 lần/user)
    prisma.reward.create({
      data: {
        name: 'Bình giữ nhiệt Tiger',
        description: 'Bình giữ nhiệt Tiger cao cấp, giữ nhiệt 24h',
        pointsRequired: 0,
        lifeRequired: 2,
        imageUrl: 'https://example.com/thermos-tiger.jpg',
        isActive: true,
        maxPerUser: 1,
      },
    }),
    // Máy xay sinh tố Tiger - 3 Nhịp sống (giới hạn 1 lần/user)
    prisma.reward.create({
      data: {
        name: 'Máy xay sinh tố Tiger',
        description: 'Máy xay sinh tố Tiger công suất cao, đa năng',
        pointsRequired: 0,
        lifeRequired: 3,
        imageUrl: 'https://example.com/blender-tiger.jpg',
        isActive: true,
        maxPerUser: 1,
      },
    }),
    // Nồi cơm điện Tiger bản thường - 5 Nhịp sống (giới hạn 1 lần/user)
    prisma.reward.create({
      data: {
        name: 'Nồi cơm điện Tiger (bản thường)',
        description: 'Nồi cơm điện Tiger bản thường, tiết kiệm điện',
        pointsRequired: 0,
        lifeRequired: 5,
        imageUrl: 'https://example.com/rice-cooker-tiger-basic.jpg',
        isActive: true,
        maxPerUser: 1,
      },
    }),
    // Nồi cơm điện Tiger cao tần - 10 Nhịp sống (giới hạn 1 lần/user)
    prisma.reward.create({
      data: {
        name: 'Nồi cơm điện Tiger cao tần (phiên bản cao cấp)',
        description:
          'Nồi cơm điện Tiger cao tần phiên bản cao cấp, công nghệ IH',
        pointsRequired: 0,
        lifeRequired: 10,
        imageUrl: 'https://example.com/rice-cooker-tiger-premium.jpg',
        isActive: true,
        maxPerUser: 1,
      },
    }),
  ]);

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
