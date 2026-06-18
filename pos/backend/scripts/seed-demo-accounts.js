require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const demoStores = {
  restaurant: {
    storeName: 'Restaurant Demo Store',
    storeType: 'RESTAURANT',
  },
  retail: {
    storeName: 'Retail Demo Store',
    storeType: 'RETAIL',
  },
};

const demoAccounts = [
  {
    fullName: 'Demo Superadmin',
    email: 'superadmin@gmail.com',
    password: 'superadmin123',
    role: 'SUPERADMIN',
    store: null,
    staffType: null,
  },
  {
    fullName: 'Restaurant Admin',
    email: 'restaurantadmin@gmail.com',
    password: 'restaurantadmin123',
    role: 'ADMIN',
    store: 'restaurant',
    staffType: null,
  },
  {
    fullName: 'Restaurant POS Staff',
    email: 'resstaff@pos.com',
    password: 'resstaffpos123',
    role: 'STAFF',
    store: 'restaurant',
    staffType: 'POS_STAFF',
  },
  {
    fullName: 'Restaurant Inventory Staff',
    email: 'resstaff@inventory.com',
    password: 'resstaffinventory123',
    role: 'STAFF',
    store: 'restaurant',
    staffType: 'INVENTORY_STAFF',
  },
  {
    fullName: 'Restaurant Manager',
    email: 'resstaff@manager.com',
    password: 'resstaffmanager123',
    role: 'STAFF',
    store: 'restaurant',
    staffType: 'MANAGER',
  },
  {
    fullName: 'Retail Admin',
    email: 'retailadmin@gmail.com',
    password: 'retailadmin123',
    role: 'ADMIN',
    store: 'retail',
    staffType: null,
  },
  {
    fullName: 'Retail POS Staff',
    email: 'retailstaff@pos.com',
    password: 'retailstaffpos123',
    role: 'STAFF',
    store: 'retail',
    staffType: 'POS_STAFF',
  },
  {
    fullName: 'Retail Inventory Staff',
    email: 'retailstaff@inventory.com',
    password: 'retailstaffinventory123',
    role: 'STAFF',
    store: 'retail',
    staffType: 'INVENTORY_STAFF',
  },
  {
    fullName: 'Retail Manager',
    email: 'retailstaff@manager.com',
    password: 'retailstaffmanager123',
    role: 'STAFF',
    store: 'retail',
    staffType: 'MANAGER',
  },
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
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in pos/backend/.env');
  }

  const schema = await getSchema();
  const userColumns = resolveUserColumns(schema.users);
  const storeColumns = resolveStoreColumns(schema.stores);

  if (!userColumns.fullName || !userColumns.role || !userColumns.password) {
    throw new Error('Users table is missing full name, role, or password columns.');
  }

  if (!storeColumns.storeType) {
    throw new Error('Stores table is missing a store type column.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const storeIds = {
      restaurant: await ensureStore(client, storeColumns, demoStores.restaurant),
      retail: await ensureStore(client, storeColumns, demoStores.retail),
    };

    for (const account of demoAccounts) {
      const storeId = account.store ? storeIds[account.store] : null;
      await upsertUser(client, userColumns, account, storeId);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(`Seeded ${demoAccounts.length} demo accounts.`);
}

async function getSchema() {
  const result = await pool.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'stores')
    `,
  );

  return {
    users: new Set(result.rows.filter((row) => row.table_name === 'users').map((row) => row.column_name.toLowerCase())),
    stores: new Set(result.rows.filter((row) => row.table_name === 'stores').map((row) => row.column_name.toLowerCase())),
  };
}

function resolveUserColumns(columns) {
  return {
    fullName: pick(columns, ['full_name', 'fullname', 'name']),
    role: pick(columns, ['role']),
    storeId: pick(columns, ['store_id']),
    staffType: pick(columns, ['staff_type']),
    password: pick(columns, ['hashed_password', 'password_hash', 'password']),
    status: pick(columns, ['status']),
  };
}

function resolveStoreColumns(columns) {
  return {
    storeType: pick(columns, ['store_type', 'type', 'store_kind']),
    storeName: pick(columns, ['store_name', 'name']),
  };
}

function pick(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate.toLowerCase())) || null;
}

async function ensureStore(client, storeColumns, store) {
  const conditions = [`${quote(storeColumns.storeType)} = $1`];
  const params = [store.storeType];

  if (storeColumns.storeName) {
    conditions.push(`${quote(storeColumns.storeName)} = $2`);
    params.push(store.storeName);
  }

  const existing = await client.query(
    `
      SELECT id
      FROM stores
      WHERE ${conditions.join(' AND ')}
      ORDER BY id ASC
      LIMIT 1
    `,
    params,
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const insertColumns = [quote(storeColumns.storeType)];
  const insertValues = [store.storeType];
  const placeholders = ['$1'];

  if (storeColumns.storeName) {
    insertColumns.push(quote(storeColumns.storeName));
    insertValues.push(store.storeName);
    placeholders.push('$2');
  }

  const inserted = await client.query(
    `
      INSERT INTO stores (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING id
    `,
    insertValues,
  );

  return inserted.rows[0].id;
}

async function upsertUser(client, userColumns, account, storeId) {
  const passwordHash = await bcrypt.hash(account.password, 10);
  const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [account.email]);

  if (existing.rows[0]?.id) {
    const updates = [
      `${quote(userColumns.fullName)} = $1`,
      `email = $2`,
      `${quote(userColumns.role)} = $3`,
      `${quote(userColumns.password)} = $4`,
    ];
    const values = [account.fullName, account.email, account.role, passwordHash];

    if (userColumns.storeId) {
      values.push(storeId);
      updates.push(`${quote(userColumns.storeId)} = $${values.length}`);
    }

    if (userColumns.staffType) {
      values.push(account.staffType);
      updates.push(`${quote(userColumns.staffType)} = $${values.length}`);
    }

    if (userColumns.status) {
      values.push('ACTIVE');
      updates.push(`${quote(userColumns.status)} = $${values.length}`);
    }

    values.push(existing.rows[0].id);
    await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    return;
  }

  const insertColumns = ['email', quote(userColumns.fullName), quote(userColumns.role), quote(userColumns.password)];
  const values = [account.email, account.fullName, account.role, passwordHash];
  const placeholders = ['$1', '$2', '$3', '$4'];

  if (userColumns.storeId) {
    insertColumns.push(quote(userColumns.storeId));
    values.push(storeId);
    placeholders.push(`$${values.length}`);
  }

  if (userColumns.staffType) {
    insertColumns.push(quote(userColumns.staffType));
    values.push(account.staffType);
    placeholders.push(`$${values.length}`);
  }

  if (userColumns.status) {
    insertColumns.push(quote(userColumns.status));
    values.push('ACTIVE');
    placeholders.push(`$${values.length}`);
  }

  await client.query(
    `
      INSERT INTO users (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `,
    values,
  );
}

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
