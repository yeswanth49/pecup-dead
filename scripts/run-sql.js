/**
 * Minimal SQL runner using node-postgres.
 * Usage:
 *   node scripts/run-sql.js supabase/migrations/20251012073000_create_academic_config.sql
 * Falls back to the default migration above if no arg is provided.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.warn('[db:sql] Failed to parse .env.local:', result.error.message);
    } else {
      console.log(`[db:sql] Loaded env from ${envPath}`);
    }
  } else {
    console.warn('[db:sql] .env.local not found; relying on process env');
  }
}

/**
 * Build a pg Client config that explicitly forces SSL with
 * rejectUnauthorized=false to avoid SELF_SIGNED_CERT_IN_CHAIN errors.
 */
function pgConfigFromConnectionString(connectionString) {
  try {
    const u = new URL(connectionString);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      ssl: { require: true, rejectUnauthorized: false },
    };
  } catch {
    // Fallback: still enforce SSL flags if parsing fails
    return { connectionString, ssl: { require: true, rejectUnauthorized: false } };
  }
}

async function run() {
  loadEnv();

  // Prefer pooled URL first for better TLS compatibility, fall back to others
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    console.error(
      '[db:sql] Missing POSTGRES_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING) in environment.'
    );
    process.exit(1);
  }

  const sqlPath =
    process.argv[2] ||
    'supabase/migrations/20251012073000_create_academic_config.sql';

  const absSqlPath = path.resolve(process.cwd(), sqlPath);
  if (!fs.existsSync(absSqlPath)) {
    console.error(`[db:sql] SQL file not found: ${absSqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(absSqlPath, 'utf8');
  if (!sql || !sql.trim()) {
    console.error('[db:sql] SQL file is empty.');
    process.exit(1);
  }

  console.log(`[db:sql] Connecting to Postgres...`);
  // Relax TLS verification explicitly to handle Supabase pooler cert chain
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`[db:sql] Running SQL from: ${absSqlPath}`);
    await client.query(sql);
    console.log('[db:sql] SQL executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[db:sql] Error executing SQL:');
    console.error('  message:', err.message);
    if (err.code) console.error('  code:', err.code);
    if (err.detail) console.error('  detail:', err.detail);
    if (err.hint) console.error('  hint:', err.hint);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

run();