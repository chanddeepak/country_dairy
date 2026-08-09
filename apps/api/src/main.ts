import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const PROD_ORIGINS = ['https://countrydairy.in', 'https://www.countrydairy.in'];

function resolveAllowedOrigins(isProduction: boolean): string[] {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  }
  return isProduction ? PROD_ORIGINS : [...DEV_ORIGINS, ...PROD_ORIGINS];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  const allowedOrigins = resolveAllowedOrigins(isProduction);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Server-to-server calls and curl send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Previously both branches allowed the request, so this check did nothing.
      callback(new Error(`Origin ${origin} is not permitted by CORS policy`));
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties with no DTO decorator
      forbidNonWhitelisted: true, // reject unexpected properties outright
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();
