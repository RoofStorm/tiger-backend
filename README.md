# Tiger - Social Mood & Rewards Backend

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/tiger-backend/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/YOUR_USERNAME/tiger-backend/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.6-2D3748.svg)](https://prisma.io/)

A comprehensive backend API for the Tiger social platform built with NestJS, PostgreSQL, and Prisma.

## 🚀 Features

- **Authentication**: JWT + Refresh tokens, OAuth (Google, Facebook)
- **Posts**: Create, read, delete posts with different types (Emoji Card, Image, Confession, Clip)
- **Social Actions**: Like and share posts with point rewards
- **Points System**: Earn points through various activities with daily/weekly limits
- **Redeem System**: Exchange points for gift codes with admin approval
- **Analytics**: Track user behavior and corner analytics
- **File Storage**: S3-compatible storage (MinIO) and Cloudinary support
- **API Documentation**: Auto-generated Swagger/OpenAPI docs
- **Testing**: Comprehensive unit and integration tests
- **Docker**: Full containerization with docker-compose

## 🛠 Tech Stack

- **Framework**: NestJS (Node.js 18+)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Passport strategies
- **Storage**: MinIO (S3-compatible) + Cloudinary
- **Testing**: Jest + SuperTest
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker + Docker Compose

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/get-started))
- **Git** ([Download](https://git-scm.com/))

## 🚀 Quick Start

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TigerBackend
   ```

2. **Start all services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database
   - MinIO S3 storage
   - Redis (optional)
   - Tiger Backend API

3. **Access the application**
   - API: http://localhost:4000
   - API Documentation: http://localhost:4000/api/docs
   - MinIO Console: http://localhost:9001 (admin/admin)

### Option 2: Local Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd TigerBackend
   npm install
   ```

2. **Set up PostgreSQL database**
   ```bash
   # Using Docker for database only
   docker run --name tiger-postgres -e POSTGRES_DB=tiger -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15-alpine
   
   # Or install PostgreSQL locally and create database
   createdb tiger
   ```

3. **Set up MinIO (S3-compatible storage)**
   ```bash
   docker run --name tiger-minio -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin -d minio/minio server /data --console-address ":9001"
   ```

4. **Configure environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations and seed**
   ```bash
   npm run migration:generate
   npm run migration:deploy
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run start:dev
   ```

## 🔧 Environment Configuration

Copy `env.example` to `.env` and configure:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/tiger"

# JWT Secrets (Generate strong secrets)
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"

# Server
PORT=4000
NODE_ENV="development"

# S3 Storage (MinIO)
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="tiger-uploads"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"

# OAuth (Optional)
OAUTH_GOOGLE_CLIENT_ID="your-google-client-id"
OAUTH_GOOGLE_CLIENT_SECRET="your-google-client-secret"
OAUTH_FB_CLIENT_ID="your-facebook-client-id"
OAUTH_FB_CLIENT_SECRET="your-facebook-client-secret"
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:4000/api/docs
- **OpenAPI JSON**: http://localhost:4000/api/docs-json

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/oauth/google` - Google OAuth
- `POST /api/auth/oauth/facebook` - Facebook OAuth

#### Posts
- `GET /api/posts` - Get all posts (with pagination and filters)
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get post by ID
- `DELETE /api/posts/:id` - Delete post

#### Actions
- `POST /api/posts/:id/actions` - Like or share post
- `DELETE /api/posts/:id/actions` - Remove action

#### Points
- `GET /api/points/summary` - Get user points summary
- `GET /api/points/history` - Get points history
- `POST /api/points/grant` - Grant points (Admin only)

#### Redeem
- `GET /api/redeems` - Get user redeem history
- `POST /api/redeems` - Create redeem request
- `GET /api/redeems/admin` - Get all redeems (Admin only)

#### Analytics
- `POST /api/analytics/events` - Record analytics events (batch)
- `GET /api/analytics/summary` - Get analytics summary by page/zone (Admin only) - [📖 Full Spec](./docs/ANALYTICS_SUMMARY_AND_AVAILABLE_DATA_API.md#api-get-analytics-summary)
- `GET /api/analytics/funnel` - Get funnel/conversion metrics (Admin only) - [📖 Full Spec](./docs/ANALYTICS_FUNNEL_API.md)
- `GET /api/analytics/user` - Get user analytics history
- `GET /api/analytics/available-data` - Get all available pages, zones, actions (Admin only) - [📖 Full Spec](./docs/ANALYTICS_SUMMARY_AND_AVAILABLE_DATA_API.md#api-get-available-data)

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run e2e tests
```bash
npm run test:e2e
```

### Run tests with coverage
```bash
npm run test:cov
```

## 🐳 Docker Commands

### Start all services
```bash
docker-compose up -d
```

### Stop all services
```bash
docker-compose down
```

### Rebuild and start
```bash
docker-compose up --build -d
```

### View logs
```bash
docker-compose logs -f backend
```

### Access database
```bash
docker-compose exec db psql -U postgres -d tiger
```

## 📊 Database Management

### Generate migration
```bash
npm run migration:generate
```

### Apply migrations
```bash
npm run migration:deploy
```

### Reset database
```bash
npm run migration:reset
```

### Seed database
```bash
npm run db:seed
```

### Open Prisma Studio
```bash
npm run db:studio
```

## 🔒 Business Rules

### Point Awards
- **Daily login**: +5 points (1 per day)
- **Share post**: +10 points (1 per day)
- **Challenge keep rhythm**: +100 points (1 per week)
- **Challenge confession**: +100 points (1 per week)
- **Invite friend**: +50 points (2 per week)

### Point Conversion
- 1000 points = 1 "Nhịp sống" (life)
- Users can pay with points or life for redemptions

### Redemption Limits
- Each gift code has per-user limits
- Admin approval required for all redemptions
- Points/life deducted immediately upon redemption

## 🏗 Project Structure

```
src/
├── modules/
│   ├── auth/           # Authentication & JWT
│   ├── users/          # User management
│   ├── posts/          # Post CRUD operations
│   ├── actions/        # Like/Share actions
│   ├── points/         # Points system & rewards
│   ├── redeem/         # Gift redemption
│   ├── analytics/      # User analytics
│   └── storage/        # File upload & storage
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Database seeding
├── test/               # E2E tests
└── main.ts            # Application entry point
```

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/tiger
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
S3_ENDPOINT=https://your-s3-endpoint.com
S3_BUCKET=tiger-production
# ... other production configs
```

### Docker Production Build
```bash
docker build -t tiger-backend .
docker run -p 4000:4000 --env-file .env tiger-backend
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [API Documentation](http://localhost:4000/api/docs)
2. Review the test files for usage examples
3. Check the Docker logs: `docker-compose logs -f backend`
4. Open an issue on GitHub

## 🔄 API Versioning

The API uses URL versioning. Current version is v1 (default):
- All endpoints are prefixed with `/api/`
- Future versions will use `/api/v2/`, etc.

---

**Happy coding! 🐅**

