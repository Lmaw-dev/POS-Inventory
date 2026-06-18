require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const demoAccounts = [
  ['superadmin@gmail.com', 'superadmin123'],
  ['restaurantadmin@gmail.com', 'restaurantadmin123'],
  ['resstaff@pos.com', 'resstaffpos123'],
  ['resstaff@inventory.com', 'resstaffinventory123'],
  ['resstaff@manager.com', 'resstaffmanager123'],
  ['retailadmin@gmail.com', 'retailadmin123'],
  ['retailstaff@pos.com', 'retailstaffpos123'],
  ['retailstaff@inventory.com', 'retailstaffinventory123'],
  ['retailstaff@manager.com', 'retailstaffmanager123'],
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 1),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || 10000),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 5000),
  allowExitOnIdle: true,
});

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error.message || error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

async function main() {
  const columns = await getUserColumns();
  const passwordColumn = pick(columns, ['hashed_password', 'password_hash', 'password']);
  const roleColumn = pick(columns, ['role']);
  const staffTypeColumn = pick(columns, ['staff_type']);

  if (!passwordColumn || !roleColumn) {
    throw new Error('Users table is missing a password or role column.');
  }

  for (const [email, password] of demoAccounts) {
    const selectColumns = ['email', roleColumn, staffTypeColumn, passwordColumn]
      .filter(Boolean)
      .map(quote)
      .join(', ');

    const result = await pool.query(`SELECT ${selectColumns} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    const user = result.rows[0];

    if (!user) {
      throw new Error(`${email} is missing.`);
    }

    const passwordMatches = await bcrypt.compare(password, user[passwordColumn]);

    if (!passwordMatches) {
      throw new Error(`${email} has an unexpected password.`);
    }

    console.log(`${email} role=${user[roleColumn]} staff=${staffTypeColumn ? user[staffTypeColumn] || '' : ''} ok=true`);
  }
}

async function getUserColumns() {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
    `,
  );

  return result.rows.map((row) => row.column_name);
}

function pick(columns, candidates) {
  return candidates.find((candidate) => columns.includes(candidate)) || null;
}

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
