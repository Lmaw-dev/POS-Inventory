const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const backendRoot = path.join(__dirname, '..');
const syncSqlPath = path.join(backendRoot, 'sql', 'sync-inventory-catalog-into-pos.sql');
const resetPosHistory = process.argv.includes('--reset-pos-history');

function createPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_SUPABASE ||
    process.env.DATABASE_URL_LOCAL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 1),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 5000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 10000),
    allowExitOnIdle: true,
  });
}

async function tableExists(pool, tableName) {
  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public."${tableName}"`]);
  return Boolean(result.rows[0]?.exists);
}

async function countRows(pool, tableName) {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
  return result.rows[0]?.count ?? 0;
}

async function main() {
  const pool = createPool();

  try {
    if (!(await tableExists(pool, 'Business')) || !(await tableExists(pool, 'InventoryItem'))) {
      throw new Error('Inventory tables are missing. Run npm run db:merge-inventory or npm run db:seed-demo first.');
    }

    await pool.query('BEGIN');
    await pool.query('ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS description TEXT');

    if (resetPosHistory) {
      await pool.query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
    }

    await pool.query(`
      DELETE FROM product_variants
      WHERE inventory_item_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM "InventoryItem" i WHERE i.id = product_variants.inventory_item_id
         )
    `);

    await pool.query(`
      DELETE FROM products
      WHERE inventory_item_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM "InventoryItem" i WHERE i.id = products.inventory_item_id
         )
    `);

    await pool.query(`
      DELETE FROM ingredients_inventory
      WHERE inventory_item_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM "InventoryItem" i WHERE i.id = ingredients_inventory.inventory_item_id
         )
    `);

    await pool.query(`
      DELETE FROM product_categories pc
      WHERE NOT EXISTS (
        SELECT 1 FROM products p WHERE p.category_id = pc.id
      )
    `);

    await pool.query(fs.readFileSync(syncSqlPath, 'utf8'));
    await pool.query('COMMIT');

    const summaryTables = [
      'orders',
      'order_items',
      'payments',
      'products',
      'product_variants',
      'ingredients_inventory',
      'product_ingredients',
      'product_categories',
    ];

    const counts = {};
    for (const tableName of summaryTables) {
      counts[tableName] = await countRows(pool, tableName);
    }

    console.log('Unified POS + Inventory database repaired and synced.');
    console.table(counts);
    if (!resetPosHistory) {
      console.log('POS order history was preserved. Add -- --reset-pos-history if you intentionally want to clear it.');
    }
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
