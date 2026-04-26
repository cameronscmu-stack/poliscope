import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id       SERIAL       PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        run_at   TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM _migrations');
    const ran = new Set(rows.map(r => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (ran.has(file)) { console.log(`  skip ${file}`); continue; }
      console.log(`  running ${file}...`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓ ${file}`);
    }
    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
