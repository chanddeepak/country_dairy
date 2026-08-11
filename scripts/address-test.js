/**
 * Address book contract test.
 *
 * The account page can now add, edit and delete addresses, which means a
 * customer supplies an address id. The property that matters is that one
 * customer cannot touch another's address by guessing an id.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

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

async function makeCustomer(suffix) {
  const email = `addr-test-${suffix}-${stamp}@countrydairy.test`;
  const password = 'TestPass#2026';

  const reg = await call('/auth/email/register', {
    method: 'POST',
    body: { email, password, name: `Addr Tester ${suffix}` },
  });

  const token = reg.data?.accessToken;
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) made.users.push(user.id);

  return { token, id: user?.id, email };
}

const VALID = {
  line1: '12 Test Lane',
  city: 'Tanakpur',
  state: 'Uttarakhand',
  postalCode: '262309',
  phone: '9876543210',
};

(async () => {
  console.log('\n\x1b[1mADDRESS BOOK\x1b[0m\n');

  const [alice, bob] = await Promise.all([makeCustomer('a'), makeCustomer('b')]);
  ok('two customers registered', !!alice.token && !!bob.token);
  if (!alice.token || !bob.token) throw new Error('registration failed');

  // --- Create ---
  console.log('\n  Adding');
  const created = await call('/auth/address', { method: 'POST', token: alice.token, body: VALID });
  ok('address added', created.ok, `status ${created.status}`);
  ok('the full list comes back', Array.isArray(created.data?.addresses));
  ok('the first address becomes the default', created.data?.addresses?.[0]?.isDefault === true);

  const firstId = created.data?.addresses?.[0]?.id;

  const second = await call('/auth/address', {
    method: 'POST',
    token: alice.token,
    body: { ...VALID, line1: '99 Second Street' },
  });
  ok('a second address is added', second.data?.addresses?.length === 2);
  ok(
    'and does not steal the default',
    second.data.addresses.filter((a) => a.isDefault).length === 1,
  );

  const secondId = second.data.addresses.find((a) => a.line1 === '99 Second Street')?.id;

  // --- Validation ---
  console.log('\n  Validation');
  const badPin = await call('/auth/address', {
    method: 'POST',
    token: alice.token,
    body: { ...VALID, postalCode: '00123' },
  });
  ok('an invalid PIN code is rejected', badPin.status === 400, `status ${badPin.status}`);

  const badPhone = await call('/auth/address', {
    method: 'POST',
    token: alice.token,
    body: { ...VALID, phone: '12345' },
  });
  ok('an invalid mobile number is rejected', badPhone.status === 400, `status ${badPhone.status}`);

  const pincodeField = await call('/auth/address', {
    method: 'POST',
    token: alice.token,
    body: { ...VALID, pincode: '262309' },
  });
  ok('the wrong field name is rejected outright', pincodeField.status === 400, `status ${pincodeField.status}`);

  // --- Update ---
  console.log('\n  Editing');
  const edited = await call(`/auth/address/${firstId}`, {
    method: 'PATCH',
    token: alice.token,
    body: { line1: '12 Renamed Lane', line2: 'Near the temple' },
  });
  ok('address updated', edited.ok, `status ${edited.status}`);

  const renamed = edited.data?.addresses?.find((a) => a.id === firstId);
  ok('line1 changed', renamed?.line1 === '12 Renamed Lane', renamed?.line1);
  ok('line2 set', renamed?.line2 === 'Near the temple');
  ok('untouched fields survive a partial update', renamed?.city === VALID.city);

  const promoted = await call(`/auth/address/${secondId}`, {
    method: 'PATCH',
    token: alice.token,
    body: { isDefault: true },
  });
  ok('default can be moved', promoted.data?.addresses?.find((a) => a.id === secondId)?.isDefault === true);
  ok(
    'only one address is default at a time',
    promoted.data.addresses.filter((a) => a.isDefault).length === 1,
  );

  const badUpdate = await call(`/auth/address/${firstId}`, {
    method: 'PATCH',
    token: alice.token,
    body: { postalCode: 'abc' },
  });
  ok('an invalid edit is rejected', badUpdate.status === 400, `status ${badUpdate.status}`);

  // --- Ownership ---
  console.log("\n  One customer cannot touch another's address");
  const bobReads = await call(`/auth/address/${firstId}`, {
    method: 'PATCH',
    token: bob.token,
    body: { line1: 'Hijacked' },
  });
  ok("editing someone else's address is refused", bobReads.status === 404, `status ${bobReads.status}`);

  const bobDeletes = await call(`/auth/address/${firstId}`, {
    method: 'DELETE',
    token: bob.token,
  });
  ok("deleting someone else's address is refused", bobDeletes.status === 404, `status ${bobDeletes.status}`);

  const survived = await prisma.address.findUnique({ where: { id: firstId } });
  ok('the address is untouched', survived?.line1 === '12 Renamed Lane', survived?.line1);

  const anonEdit = await call(`/auth/address/${firstId}`, {
    method: 'PATCH',
    body: { line1: 'Anonymous' },
  });
  ok('anonymous edit rejected', anonEdit.status === 401, `status ${anonEdit.status}`);

  const anonDelete = await call(`/auth/address/${firstId}`, { method: 'DELETE' });
  ok('anonymous delete rejected', anonDelete.status === 401, `status ${anonDelete.status}`);

  // --- Profile ---
  console.log('\n  Profile');
  const profile = await call('/auth/profile', {
    method: 'PATCH',
    token: alice.token,
    body: { name: 'Alice Renamed', phone: '9812345678' },
  });
  ok('profile updated', profile.ok, `status ${profile.status}`);
  ok('name changed', profile.data?.user?.name === 'Alice Renamed', profile.data?.user?.name);
  ok('phone changed', profile.data?.user?.phone === '9812345678');
  ok('addresses still come back with the user', Array.isArray(profile.data?.user?.addresses));

  const meAfter = await call('/auth/me', { token: alice.token });
  ok('the change is not just cached — /auth/me agrees', meAfter.data?.name === 'Alice Renamed', meAfter.data?.name);

  const badPhoneProfile = await call('/auth/profile', {
    method: 'PATCH',
    token: alice.token,
    body: { phone: '12345' },
  });
  ok('an invalid mobile is rejected', badPhoneProfile.status === 400, `status ${badPhoneProfile.status}`);

  const emailChange = await call('/auth/profile', {
    method: 'PATCH',
    token: alice.token,
    body: { email: 'hijack@example.com' },
  });
  ok('email cannot be changed through the profile route', emailChange.status === 400, `status ${emailChange.status}`);

  await call('/auth/profile', { method: 'PATCH', token: bob.token, body: { phone: '9700000001' } });
  const phoneClash = await call('/auth/profile', {
    method: 'PATCH',
    token: alice.token,
    body: { phone: '9700000001' },
  });
  ok("cannot take another account's mobile number", phoneClash.status === 400, `status ${phoneClash.status}`);

  const anonProfile = await call('/auth/profile', { method: 'PATCH', body: { name: 'Anon' } });
  ok('anonymous profile edit rejected', anonProfile.status === 401, `status ${anonProfile.status}`);

  // --- Password ---
  console.log('\n  Password');
  const wrongCurrent = await call('/auth/change-password', {
    method: 'POST',
    token: alice.token,
    body: { currentPassword: 'NotMyPassword#1', newPassword: 'BrandNew#2026' },
  });
  ok('a wrong current password is refused', wrongCurrent.status === 401, `status ${wrongCurrent.status}`);

  const tooShort = await call('/auth/change-password', {
    method: 'POST',
    token: alice.token,
    body: { currentPassword: 'TestPass#2026', newPassword: 'short' },
  });
  ok('a short new password is refused', tooShort.status === 400, `status ${tooShort.status}`);

  const sameAgain = await call('/auth/change-password', {
    method: 'POST',
    token: alice.token,
    body: { currentPassword: 'TestPass#2026', newPassword: 'TestPass#2026' },
  });
  ok('reusing the same password is refused', sameAgain.status === 400, `status ${sameAgain.status}`);

  const changed = await call('/auth/change-password', {
    method: 'POST',
    token: alice.token,
    body: { currentPassword: 'TestPass#2026', newPassword: 'BrandNew#2026' },
  });
  ok('password changed', changed.ok, `status ${changed.status}`);

  const oldPassword = await call('/auth/email/login', {
    method: 'POST',
    body: { email: alice.email, password: 'TestPass#2026' },
  });
  ok('the old password no longer works', oldPassword.status === 401, `status ${oldPassword.status}`);

  const newPassword = await call('/auth/email/login', {
    method: 'POST',
    body: { email: alice.email, password: 'BrandNew#2026' },
  });
  ok('the new password works', newPassword.ok, `status ${newPassword.status}`);

  const anonPassword = await call('/auth/change-password', {
    method: 'POST',
    body: { currentPassword: 'x', newPassword: 'BrandNew#2026' },
  });
  ok('anonymous password change rejected', anonPassword.status === 401, `status ${anonPassword.status}`);

  // --- Delete ---
  console.log('\n  Deleting');
  const deleted = await call(`/auth/address/${secondId}`, {
    method: 'DELETE',
    token: alice.token,
  });
  ok('address deleted', deleted.ok, `status ${deleted.status}`);
  ok('one address left', deleted.data?.addresses?.length === 1);
  ok(
    'deleting the default promotes another — never leaves the customer without one',
    deleted.data.addresses[0].isDefault === true,
  );

  const gone = await call(`/auth/address/${secondId}`, { method: 'DELETE', token: alice.token });
  ok('deleting an already-deleted address returns 404', gone.status === 404, `status ${gone.status}`);
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
