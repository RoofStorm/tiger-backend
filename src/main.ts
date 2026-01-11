// Polyfill for crypto global - required for @nestjs/schedule
// @nestjs/schedule uses crypto.randomUUID() which requires crypto to be available globally
import * as nodeCrypto from 'crypto';
if (typeof globalThis.crypto === 'undefined') {
  // Expose crypto.randomUUID() for @nestjs/schedule compatibility
  globalThis.crypto = {
    randomUUID: () => nodeCrypto.randomUUID(),
    ...nodeCrypto,
  } as any;
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  // Configure logger based on environment variable
  const logLevels = (process.env.LOG_LEVEL?.split(',') || ['log', 'error', 'warn', 'debug', 'verbose']) as LogLevel[];
  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  // Security middleware
  app.use(helmet());
  app.use(compression());
  
  // Cookie parser for anonymous tracking
  app.use(cookieParser());

  // CORS - Must specify exact origin when credentials = true
  const corsOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000';

  app.enableCors({
    origin: corsOrigins, // 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Range',
      'Accept-Ranges',
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'Content-Type',
    ],
    credentials: true, // REQUIRED: Must be true to allow cookies with credentials
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Tiger - Social Mood & Rewards API')
    .setDescription('Backend API for Tiger social platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  this.logger.debug(`🚀 Application is running on: http://localhost:${port}`);
  this.logger.debug(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
