ALTER TABLE products
  ADD COLUMN IF NOT EXISTS inventory_item_id TEXT;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS inventory_item_id TEXT;

ALTER TABLE ingredients_inventory
  ADD COLUMN IF NOT EXISTS inventory_item_id TEXT;

ALTER TABLE product_ingredients
  ADD COLUMN IF NOT EXISTS recipe_ingredient_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_store_inventory_item_uidx
  ON products (store_id, inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_inventory_item_uidx
  ON product_variants (product_id, inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ingredients_store_inventory_item_uidx
  ON ingredients_inventory (store_id, inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_ingredients_store_recipe_ingredient_uidx
  ON product_ingredients (store_id, recipe_ingredient_id)
  WHERE recipe_ingredient_id IS NOT NULL;

WITH store_business AS (
  SELECT
    s.id AS store_id,
    CASE WHEN s.store_type = 'RETAIL' THEN 'RETAIL_STORE' ELSE s.store_type END AS store_type,
    b.id AS business_id,
    CASE WHEN s.store_type IN ('RETAIL', 'RETAIL_STORE') THEN 'RETAIL' ELSE 'RESTAURANT' END AS module
  FROM stores s
  JOIN LATERAL (
    SELECT b.*
    FROM "Business" b
    WHERE (
      s.store_type IN ('RETAIL', 'RETAIL_STORE')
      AND 'RETAIL'::"BusinessModule" = ANY(b.modules)
    ) OR (
      s.store_type = 'RESTAURANT'
      AND 'RESTAURANT'::"BusinessModule" = ANY(b.modules)
    )
    ORDER BY
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM users pu
          JOIN "User" iu ON lower(iu.email) = lower(pu.email)
          WHERE pu.store_id = s.id
            AND iu."businessId" = b.id
        ) THEN 0
        ELSE 1
      END,
      b."createdAt" ASC
    LIMIT 1
  ) b ON TRUE
),
category_source AS (
  SELECT DISTINCT
    sb.store_id,
    sb.store_type,
    c.name,
    c.description
  FROM store_business sb
  JOIN "Category" c
    ON c."businessId" = sb.business_id
   AND c.module = sb.module::"BusinessModule"
)
INSERT INTO product_categories (store_id, store_type, name, description)
SELECT cs.store_id, cs.store_type, cs.name, cs.description
FROM category_source cs
WHERE NOT EXISTS (
  SELECT 1
  FROM product_categories pc
  WHERE pc.store_id = cs.store_id
    AND pc.store_type = cs.store_type
    AND lower(pc.name) = lower(cs.name)
);

WITH store_business AS (
  SELECT
    s.id AS store_id,
    CASE WHEN s.store_type = 'RETAIL' THEN 'RETAIL_STORE' ELSE s.store_type END AS store_type,
    b.id AS business_id,
    CASE WHEN s.store_type IN ('RETAIL', 'RETAIL_STORE') THEN 'RETAIL' ELSE 'RESTAURANT' END AS module
  FROM stores s
  JOIN LATERAL (
    SELECT b.*
    FROM "Business" b
    WHERE (
      s.store_type IN ('RETAIL', 'RETAIL_STORE')
      AND 'RETAIL'::"BusinessModule" = ANY(b.modules)
    ) OR (
      s.store_type = 'RESTAURANT'
      AND 'RESTAURANT'::"BusinessModule" = ANY(b.modules)
    )
    ORDER BY b."createdAt" ASC
    LIMIT 1
  ) b ON TRUE
),
item_source AS (
  SELECT
    sb.store_id,
    sb.store_type,
    i.id AS inventory_item_id,
    i.name,
    i.description,
    i.category,
    i.price,
    i."imageUrl",
    i.sku,
    i.barcode,
    i.unit,
    i.size,
    i.quantity,
    i."minStock",
    i."itemType"
  FROM store_business sb
  JOIN "InventoryItem" i
    ON i."businessId" = sb.business_id
  WHERE (
    sb.store_type = 'RETAIL_STORE'
    AND i."itemType" = 'RETAIL_ITEM'::"InventoryItemType"
  ) OR (
    sb.store_type = 'RESTAURANT'
    AND i."itemType" = 'MENU_ITEM'::"InventoryItemType"
  )
)
INSERT INTO products (
  store_id,
  category_id,
  store_type,
  name,
  description,
  price,
  image_url,
  sku,
  barcode,
  unit,
  size,
  stock_quantity,
  low_stock_limit,
  is_available,
  inventory_item_id
)
SELECT
  src.store_id,
  pc.id,
  src.store_type,
  src.name,
  src.description,
  COALESCE(src.price, 0),
  src."imageUrl",
  src.sku,
  src.barcode,
  src.unit,
  src.size,
  COALESCE(src.quantity, 0),
  COALESCE(src."minStock", 0),
  TRUE,
  src.inventory_item_id
FROM item_source src
LEFT JOIN product_categories pc
  ON pc.store_id = src.store_id
 AND pc.store_type = src.store_type
 AND lower(pc.name) = lower(src.category)
ON CONFLICT (store_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  sku = EXCLUDED.sku,
  barcode = EXCLUDED.barcode,
  unit = EXCLUDED.unit,
  size = EXCLUDED.size,
  stock_quantity = EXCLUDED.stock_quantity,
  low_stock_limit = EXCLUDED.low_stock_limit,
  is_available = EXCLUDED.is_available,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO product_variants (
  product_id,
  size,
  color,
  sku,
  barcode,
  image_url,
  price,
  stock_quantity,
  low_stock_limit,
  is_active,
  inventory_item_id
)
SELECT
  p.id,
  p.size,
  p.color,
  p.sku,
  p.barcode,
  p.image_url,
  p.price,
  p.stock_quantity,
  p.low_stock_limit,
  p.is_available,
  p.inventory_item_id
FROM products p
WHERE p.store_type = 'RETAIL_STORE'
  AND p.inventory_item_id IS NOT NULL
ON CONFLICT (product_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL
DO UPDATE SET
  size = EXCLUDED.size,
  color = EXCLUDED.color,
  sku = EXCLUDED.sku,
  barcode = EXCLUDED.barcode,
  image_url = EXCLUDED.image_url,
  price = EXCLUDED.price,
  stock_quantity = EXCLUDED.stock_quantity,
  low_stock_limit = EXCLUDED.low_stock_limit,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

WITH store_business AS (
  SELECT
    s.id AS store_id,
    b.id AS business_id
  FROM stores s
  JOIN LATERAL (
    SELECT b.*
    FROM "Business" b
    WHERE s.store_type = 'RESTAURANT'
      AND 'RESTAURANT'::"BusinessModule" = ANY(b.modules)
    ORDER BY b."createdAt" ASC
    LIMIT 1
  ) b ON TRUE
)
INSERT INTO ingredients_inventory (
  store_id,
  ingredient_name,
  quantity_available,
  unit,
  low_stock_limit,
  cost_per_unit,
  is_available,
  inventory_item_id
)
SELECT
  sb.store_id,
  i.name,
  COALESCE(i.quantity, 0),
  COALESCE(i.unit, 'unit'),
  COALESCE(i."minStock", 0),
  COALESCE(i."costPrice", i.price, 0),
  TRUE,
  i.id
FROM store_business sb
JOIN "InventoryItem" i
  ON i."businessId" = sb.business_id
WHERE i."itemType" IN ('INGREDIENT'::"InventoryItemType", 'SUPPLY'::"InventoryItemType")
ON CONFLICT (store_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL
DO UPDATE SET
  ingredient_name = EXCLUDED.ingredient_name,
  quantity_available = EXCLUDED.quantity_available,
  unit = EXCLUDED.unit,
  low_stock_limit = EXCLUDED.low_stock_limit,
  cost_per_unit = EXCLUDED.cost_per_unit,
  is_available = EXCLUDED.is_available,
  updated_at = CURRENT_TIMESTAMP;

WITH recipe_source AS (
  SELECT
    p.store_id,
    p.id AS product_id,
    ri.id AS recipe_ingredient_id,
    pos_ingredient.id AS ingredient_inventory_id,
    ii.name AS ingredient_name,
    ri.quantity,
    COALESCE(ri.unit, ii.unit, 'unit') AS unit,
    COALESCE(ri."unitCost", 0) AS additional_cost
  FROM products p
  JOIN "Recipe" r ON r."menuItemId" = p.inventory_item_id
  JOIN "RecipeIngredient" ri ON ri."recipeId" = r.id
  JOIN "InventoryItem" ii ON ii.id = ri."itemId"
  LEFT JOIN ingredients_inventory pos_ingredient
    ON pos_ingredient.store_id = p.store_id
   AND pos_ingredient.inventory_item_id = ii.id
  WHERE p.store_type = 'RESTAURANT'
    AND p.inventory_item_id IS NOT NULL
    AND pos_ingredient.id IS NOT NULL
)
INSERT INTO product_ingredients (
  store_id,
  product_id,
  ingredient_id,
  ingredient_name,
  quantity_required,
  default_quantity,
  unit,
  additional_cost,
  is_required,
  is_removable,
  recipe_ingredient_id
)
SELECT
  rs.store_id,
  rs.product_id,
  rs.ingredient_inventory_id,
  rs.ingredient_name,
  rs.quantity,
  rs.quantity,
  rs.unit,
  rs.additional_cost,
  TRUE,
  TRUE,
  rs.recipe_ingredient_id
FROM recipe_source rs
ON CONFLICT (store_id, recipe_ingredient_id) WHERE recipe_ingredient_id IS NOT NULL
DO UPDATE SET
  product_id = EXCLUDED.product_id,
  ingredient_id = EXCLUDED.ingredient_id,
  ingredient_name = EXCLUDED.ingredient_name,
  quantity_required = EXCLUDED.quantity_required,
  default_quantity = EXCLUDED.default_quantity,
  unit = EXCLUDED.unit,
  additional_cost = EXCLUDED.additional_cost,
  updated_at = CURRENT_TIMESTAMP;
