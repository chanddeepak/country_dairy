#!/usr/bin/env node
/**
 * Copies Storage objects from one Supabase project to another.
 *
 * Seeding a fresh project restores the database rows, and those rows carry
 * image paths — but the files themselves live in the Storage of whichever
 * project they were uploaded to. A new project starts with empty buckets, so
 * every path resolves to nothing and the storefront renders broken images
 * against a database that looks perfectly correct.
 *
 * Reads from the source, writes to the destination, and never deletes
 * anything. Existing files in the destination are skipped rather than
 * overwritten, so running it twice is safe.
 *
 *   SOURCE_SUPABASE_URL=https://<prod-ref>.supabase.co \
 *   SOURCE_SERVICE_KEY=<prod service key> \
 *   DEST_SUPABASE_URL=https://<dev-ref>.supabase.co \
 *   DEST_SERVICE_KEY=<dev service key> \
 *   node scripts/copy-storage.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const BUCKETS = ['hero-banners', 'products', 'review-media', 'lab-reports'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the header of this file for the four it needs.`);
    process.exit(1);
  }
  return value;
}

const dryRun = process.argv.includes('--dry-run');

const source = createClient(requireEnv('SOURCE_SUPABASE_URL'), requireEnv('SOURCE_SERVICE_KEY'), {
  auth: { persistSession: false },
});
const dest = createClient(requireEnv('DEST_SUPABASE_URL'), requireEnv('DEST_SERVICE_KEY'), {
  auth: { persistSession: false },
});

/** Storage lists a page at a time, and a bucket can hold more than one page. */
async function listAll(client, bucket, prefix = '') {
  const found = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });

    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder comes back with no id; recurse into it.
      if (entry.id === null) {
        found.push(...(await listAll(client, bucket, path)));
      } else {
        found.push(path);
      }
    }

    if (data.length < pageSize) break;
  }

  return found;
}

async function copyBucket(bucket) {
  let files;
  try {
    files = await listAll(source, bucket);
  } catch (err) {
    console.log(`  ${bucket}: skipped (${err.message})`);
    return { copied: 0, skipped: 0, failed: 0 };
  }

  // The destination bucket has to exist, and public/private must match the
  // source or the storefront's public URLs will 400 on a file that is there.
  if (!dryRun) {
    await dest.storage.createBucket(bucket, { public: true }).catch(() => {});
  }

  const existing = new Set(await listAll(dest, bucket).catch(() => []));
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const path of files) {
    if (existing.has(path)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      copied += 1;
      continue;
    }

    const { data, error } = await source.storage.from(bucket).download(path);
    if (error) {
      console.log(`    ! download ${path}: ${error.message}`);
      failed += 1;
      continue;
    }

    const body = Buffer.from(await data.arrayBuffer());
    const { error: upErr } = await dest.storage
      .from(bucket)
      .upload(path, body, { contentType: data.type || undefined, upsert: false });

    if (upErr) {
      console.log(`    ! upload ${path}: ${upErr.message}`);
      failed += 1;
    } else {
      copied += 1;
    }
  }

  console.log(
    `  ${bucket}: ${copied} copied, ${skipped} already there, ${failed} failed ` +
      `(source had ${files.length})`,
  );
  return { copied, skipped, failed };
}

(async () => {
  console.log(dryRun ? 'Dry run — nothing will be written.\n' : 'Copying Storage objects.\n');
  console.log(`  from ${process.env.SOURCE_SUPABASE_URL}`);
  console.log(`  to   ${process.env.DEST_SUPABASE_URL}\n`);

  if (process.env.SOURCE_SUPABASE_URL === process.env.DEST_SUPABASE_URL) {
    console.error('Source and destination are the same project. Refusing.');
    process.exit(1);
  }

  const totals = { copied: 0, skipped: 0, failed: 0 };
  for (const bucket of BUCKETS) {
    const result = await copyBucket(bucket);
    totals.copied += result.copied;
    totals.skipped += result.skipped;
    totals.failed += result.failed;
  }

  console.log(
    `\n${totals.copied} copied, ${totals.skipped} already present, ${totals.failed} failed.`,
  );
  process.exit(totals.failed > 0 ? 1 : 0);
})();
