// Sentry first: it patches the libraries it instruments as they load, so
// anything imported before it is invisible to crash reporting. It also loads
// the env itself, which is why this replaces the direct config import.
import './instrument';

import * as path from 'path';
import * as fs from 'fs';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
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

/**
 * JSON.stringify throws on a BigInt — "Do not know how to serialize a BigInt"
 * — and Nest serialises every response with it. Adding Product.externalId
 * turned the entire catalogue into a 500 the moment the column existed, which
 * is a spectacular way for a new id to take a shop down.
 *
 * Number rather than String: the columns are sequential from 1, so the 2^53
 * ceiling on a JavaScript number is not a ceiling anyone will reach — a dairy
 * would need to add a product every second for 285 million years. Switching
 * to String would change the shape of every catalogue response.
 */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(
  this: bigint,
): number {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
   * Behind Render every request arrives from their proxy, so req.ip is the
   * proxy's address and the per-IP OTP limit would count every customer as the
   * same caller — throttling everyone at once while stopping no attacker.
   *
   * `1` trusts exactly one hop. Trusting them all would let a caller spoof
   * X-Forwarded-For and opt out of the limit entirely.
   */
  app.set('trust proxy', 1);
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

  // Same reasoning for Cashfree, whose HMAC is over the body they sent.
  app.use(
    '/api/orders/webhook/cashfree',
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
