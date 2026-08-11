/**
 * Session and registration contract test.
 *
 * Two questions this answers directly:
 *   - Does a dead token actually get rejected everywhere, or only on writes?
 *   - Can the same email be used twice, in any casing?
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = process.env.TEST_API_URL || 'http://localhost:4000/api';

let pass = 0;
let fail = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

const stamp = Date.now();
const made = { users: [] };

(async () => {
  console.log('\n\x1b[1mSESSION & REGISTRATION\x1b[0m\n');

  // --- Duplicate email ---
  console.log('  The same email cannot be reused');
  const email = `dupe-${stamp}@countrydairy.test`;

  const first = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password: 'TestPass#2026', name: 'First Signup' },
  });
  ok('first registration succeeds', first.ok, `status ${first.status}`);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) made.users.push(user.id);

  const again = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password: 'Different#2026', name: 'Second Signup' },
  });
  ok('the same email is refused', again.status === 400, `status ${again.status}`);

  const upper = await call('/auth/email/register', {
    method: 'POST',
    body: { email: email.toUpperCase(), password: 'Different#2026', name: 'Shouty Signup' },
  });
  ok('a different casing of it is also refused', upper.status === 400, `status ${upper.status}`);

  const padded = await call('/auth/email/register', {
    method: 'POST',
    body: { email: `  ${email}  `, password: 'Different#2026', name: 'Padded Signup' },
  });
  ok('surrounding whitespace does not slip past', padded.status === 400, `status ${padded.status}`);

  const count = await prisma.user.count({ where: { email: email.toLowerCase() } });
  ok('exactly one account exists for that address', count === 1, `${count} rows`);

  const stillWorks = await call('/auth/email/login', {
    method: 'POST',
    body: { email, password: 'TestPass#2026' },
  });
  ok('the original password still works — the retry did not overwrite it', stillWorks.ok);

  const token = stillWorks.data?.accessToken;

  // --- A live token works everywhere ---
  console.log('\n  A live token is accepted');
  const me = await call('/auth/me', { token });
  ok('/auth/me accepts it', me.ok, `status ${me.status}`);
  ok('and returns the right account', me.data?.email === email.toLowerCase());

  const orders = await call('/orders', { token });
  ok('/orders accepts it', orders.ok, `status ${orders.status}`);

  // --- A dead token is rejected everywhere ---
  console.log('\n  A dead token is rejected on reads, not just writes');

  const secret = process.env.JWT_SECRET || 'dev-secret';
  const expired = jwt.sign({ sub: user.id, email, role: 'CUSTOMER' }, secret, { expiresIn: '-1h' });
  const wrongSecret = jwt.sign({ sub: user.id, email, role: 'CUSTOMER' }, 'not-the-real-secret', {
    expiresIn: '7d',
  });
  const garbage = `${token.slice(0, -6)}abcdef`;

  for (const [label, bad] of [
    ['an expired token', expired],
    ['a token signed with the wrong secret', wrongSecret],
    ['a tampered token', garbage],
  ]) {
    const readMe = await call('/auth/me', { token: bad });
    const readOrders = await call('/orders', { token: bad });
    const write = await call('/auth/address', {
      method: 'POST',
      token: bad,
      body: {
        line1: '1 Nowhere Road',
        city: 'Nowhere',
        state: 'Nowhere',
        postalCode: '262309',
        phone: '9876543210',
      },
    });

    ok(`${label}: /auth/me returns 401`, readMe.status === 401, `status ${readMe.status}`);
    ok(`${label}: /orders returns 401`, readOrders.status === 401, `status ${readOrders.status}`);
    ok(`${label}: a write returns 401`, write.status === 401, `status ${write.status}`);
  }

  // --- A deleted account's token stops working ---
  console.log('\n  A token for a removed account stops working');
  const ghostEmail = `ghost-${stamp}@countrydairy.test`;
  const ghost = await call('/auth/email/register', {
    method: 'POST',
    body: { email: ghostEmail, password: 'TestPass#2026', name: 'Ghost' },
  });
  const ghostToken = ghost.data?.accessToken;
  const ghostUser = await prisma.user.findUnique({ where: { email: ghostEmail } });

  ok('the ghost token works while the account exists', (await call('/auth/me', { token: ghostToken })).ok);

  await prisma.cartItem.deleteMany({ where: { userId: ghostUser.id } });
  await prisma.authIdentity.deleteMany({ where: { userId: ghostUser.id } });
  await prisma.user.delete({ where: { id: ghostUser.id } });

  // The user cache holds for 10s, so wait it out rather than assert a stale hit.
  await new Promise((r) => setTimeout(r, 11_000));

  const ghostAfter = await call('/auth/me', { token: ghostToken });
  ok('and is rejected once the account is gone', ghostAfter.status === 401, `status ${ghostAfter.status}`);

  // --- Deactivated account ---
  console.log('\n  A deactivated account cannot keep using its token');
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
  await new Promise((r) => setTimeout(r, 11_000));

  const deactivated = await call('/auth/me', { token });
  ok('a deactivated account is refused', deactivated.status === 401, `status ${deactivated.status}`);

  await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
})()
  .catch((err) => {
    fail++;
    console.error('\n\x1b[31mFATAL\x1b[0m', err.message);
  })
  .finally(async () => {
    await prisma.address.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.authIdentity.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.user.deleteMany({ where: { id: { in: made.users } } });
    await prisma.$disconnect();

    const colour = fail ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n${colour}\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`);
    process.exit(fail ? 1 : 0);
  });
