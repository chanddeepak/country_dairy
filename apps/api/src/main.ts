// Loads .env as a side effect; must precede anything that reads process.env.
import './config/env';

import * as path from 'path';
import * as fs from 'fs';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';

const PROD_ORIGINS = ['https://countrydairy.in', 'https://www.countrydairy.in'];

/**
 * Any localhost or 127.0.0.1 port. Vite picks the next free port when its
 * default is taken (5173 -> 5174 -> 5175...), so pinning an explicit list
 * produces a "Failed to fetch" that looks like the API is down.
 */
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function resolveAllowedOrigins(isProduction: boolean): string[] {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  }
  return PROD_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  // The gateway signs the exact bytes it sent, so the webhook route needs the
  // raw body. Re-serialising the parsed object changes key order and
  // whitespace, and every signature check would fail.
  app.use(
    '/api/orders/webhook/razorpay',
    express.raw({ type: '*/*', limit: '1mb' }),
  );

  const allowedOrigins = resolveAllowedOrigins(isProduction);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Server-to-server calls and curl send no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Outside production, trust any local dev server whatever port it landed on.
      if (!isProduction && LOCALHOST_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }

      // Deny by omitting the CORS headers rather than throwing: the browser
      // blocks the response either way, and this avoids logging a 500 for
      // what is a routine rejection. Previously both branches allowed the
      // request, so this check did nothing at all.
      console.warn(`[CORS] blocked origin: ${origin}`);
      callback(null, false);
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

  console.log(`\nCountry Dairy API — http://localhost:${port}/api`);
  console.log(`  env:     ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `  origins: ${allowedOrigins.join(', ')}${isProduction ? '' : ' (+ any localhost port)'}`,
  );
  console.log(`  db:      ${process.env.DATABASE_URL ? 'configured' : 'MISSING DATABASE_URL'}`);
  console.log(
    `  payments: ${
      process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_mock')
        ? 'live Razorpay'
        : 'MOCK MODE — no real charges'
    }\n`,
  );
}

bootstrap();
