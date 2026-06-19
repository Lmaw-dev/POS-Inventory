import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../shared/database/database.service';

type HeadersLike = Record<string, string | string[] | undefined>;
type BusinessModule = 'RETAIL' | 'RESTAURANT';

type Scope = {
  businessId: string;
  module: BusinessModule;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    businessId: string;
    modules: string[];
    lastLogin: string;
  };
};

type Paged<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class InventoryApiService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCurrentUser(headers: HeadersLike) {
    const scope = await this.resolveScope(headers);
    return { user: scope.user };
  }

  async listInventory(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const where = ['i."businessId" = $1'];
    const params: unknown[] = [scope.businessId];

    if (query.itemType) {
      params.push(query.itemType);
      where.push(`i."itemType" = $${params.length}::"InventoryItemType"`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR i.barcode ILIKE $${params.length})`);
    }

    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT
          i.id, i.name, i.description, i."itemType", i.sku, i.barcode, i.category,
          i."targetCustomer", i.subcategory, i.size, i.condition,
          i.quantity, i.price, i."costPrice", i."imageUrl", i.unit,
          i."minStock", i."maxStock", i."reorderPoint", i."expiryDate",
          i."storageTemperature", i."dateAdded", i."locationId",
          i."createdAt", i."updatedAt",
          json_build_object(
            'id', l.id,
            'name', l.name,
            'address', l.address,
            'manager', l.manager,
            'phone', l.phone,
            'itemCount', l."itemCount"
          ) AS location
        FROM "InventoryItem" i
        LEFT JOIN "Location" l ON l.id = i."locationId"
        WHERE ${where.join(' AND ')}
        ORDER BY i."createdAt" DESC
      `,
      params,
    );

    return this.paged(rows);
  }

  async createInventoryItem(headers: HeadersLike, body: Record<string, unknown>) {
    const scope = await this.resolveScope(headers);
    const locationId = String(body.locationId ?? (await this.getDefaultLocationId(scope.businessId)));
    const id = randomUUID();

    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        INSERT INTO "InventoryItem" (
          id, name, description, "itemType", sku, barcode, category, "targetCustomer",
          subcategory, size, condition, quantity, price, "costPrice",
          "imageUrl", unit, "minStock", "maxStock", "reorderPoint",
          "expiryDate", "storageTemperature", "locationId", "businessId"
        )
        VALUES (
          $1, $2, $3, $4::"InventoryItemType", $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23
        )
        RETURNING *
      `,
      [
        id,
        String(body.name ?? 'Untitled Item'),
        body.description ?? null,
        String(body.itemType ?? 'RETAIL_ITEM'),
        body.sku ?? null,
        body.barcode ?? null,
        String(body.category ?? 'Uncategorized'),
        body.targetCustomer ?? null,
        body.subcategory ?? null,
        body.size ?? null,
        body.condition ?? null,
        Number(body.quantity ?? 0),
        Number(body.price ?? 0),
        body.costPrice === undefined ? null : Number(body.costPrice),
        body.imageUrl ?? null,
        body.unit ?? null,
        body.minStock === undefined ? null : Number(body.minStock),
        body.maxStock === undefined ? null : Number(body.maxStock),
        body.reorderPoint === undefined ? null : Number(body.reorderPoint),
        body.expiryDate ?? null,
        body.storageTemperature ?? null,
        locationId,
        scope.businessId,
      ],
    );
    await this.syncInventoryItemToPos(id);
    return rows[0];
  }

  async updateInventoryItem(id: string, body: Record<string, unknown>) {
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        UPDATE "InventoryItem"
        SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          category = COALESCE($4, category),
          quantity = COALESCE($5, quantity),
          price = COALESCE($6, price),
          "costPrice" = COALESCE($7, "costPrice"),
          "imageUrl" = COALESCE($8, "imageUrl"),
          unit = COALESCE($9, unit),
          "minStock" = COALESCE($10, "minStock"),
          "maxStock" = COALESCE($11, "maxStock"),
          "reorderPoint" = COALESCE($12, "reorderPoint"),
          sku = COALESCE($13, sku),
          barcode = COALESCE($14, barcode),
          subcategory = COALESCE($15, subcategory),
          "targetCustomer" = COALESCE($16, "targetCustomer"),
          size = COALESCE($17, size),
          condition = COALESCE($18, condition),
          "locationId" = COALESCE($19, "locationId"),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        body.name ?? null,
        body.description ?? null,
        body.category ?? null,
        body.quantity === undefined ? null : Number(body.quantity),
        body.price === undefined ? null : Number(body.price),
        body.costPrice === undefined ? null : Number(body.costPrice),
        body.imageUrl ?? null,
        body.unit ?? null,
        body.minStock === undefined ? null : Number(body.minStock),
        body.maxStock === undefined ? null : Number(body.maxStock),
        body.reorderPoint === undefined ? null : Number(body.reorderPoint),
        body.sku ?? null,
        body.barcode ?? null,
        body.subcategory ?? null,
        body.targetCustomer ?? null,
        body.size ?? null,
        body.condition ?? null,
        body.locationId ?? null,
      ],
    );

    if (!rows[0]) throw new NotFoundException('Inventory item was not found.');
    await this.syncInventoryItemToPos(id);
    return rows[0];
  }

  async listLocations(headers: HeadersLike) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT l.*, json_build_object('items', COUNT(i.id)::int) AS "_count"
        FROM "Location" l
        LEFT JOIN "InventoryItem" i ON i."locationId" = l.id
        WHERE l."businessId" = $1
        GROUP BY l.id
        ORDER BY l.name ASC
      `,
      [scope.businessId],
    );
    return this.paged(rows);
  }

  async listUsers(headers: HeadersLike) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT id, name, email, role, status, "lastLogin"
        FROM "User"
        WHERE "businessId" = $1
        ORDER BY name ASC
      `,
      [scope.businessId],
    );
    return this.paged(rows);
  }

  async listCategories(headers: HeadersLike, module?: string) {
    const scope = await this.resolveScope(headers);
    return this.safeQuery<Record<string, unknown>>(
      `
        SELECT id, name, description, module, "createdAt", "updatedAt"
        FROM "Category"
        WHERE "businessId" = $1
          AND ($2::text IS NULL OR module = $2::"BusinessModule")
        ORDER BY name ASC
      `,
      [scope.businessId, module ?? scope.module],
    );
  }

  async createCategory(headers: HeadersLike, body: Record<string, unknown>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        INSERT INTO "Category" (id, name, description, module, "businessId")
        VALUES ($1, $2, $3, $4::"BusinessModule", $5)
        ON CONFLICT ("businessId", name, module)
        DO UPDATE SET description = EXCLUDED.description, "updatedAt" = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [
        randomUUID(),
        String(body.name ?? 'Uncategorized'),
        body.description ?? null,
        String(body.module ?? scope.module),
        scope.businessId,
      ],
    );
    return rows[0];
  }

  async listRecipes(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT
          r.*,
          COALESCE(ingredients.items, '[]'::json) AS ingredients,
          row_to_json(menu_item.*) AS "menuItem"
        FROM "Recipe" r
        LEFT JOIN "InventoryItem" menu_item ON menu_item.id = r."menuItemId"
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'id', ri.id,
              'itemId', ri."itemId",
              'quantity', ri.quantity,
              'unit', ri.unit,
              'unitCost', ri."unitCost",
              'totalCost', ri."totalCost",
              'item', row_to_json(item.*)
            )
            ORDER BY item.name
          ) AS items
          FROM "RecipeIngredient" ri
          JOIN "InventoryItem" item ON item.id = ri."itemId"
          WHERE ri."recipeId" = r.id
        ) ingredients ON TRUE
        WHERE r."businessId" = $1
          AND ($2::text IS NULL OR r."isActive" = ($2::boolean))
        ORDER BY r.name ASC
      `,
      [scope.businessId, query.active ?? null],
    );
    return this.paged(rows);
  }

  async createRecipe(headers: HeadersLike, body: Record<string, unknown>) {
    const scope = await this.resolveScope(headers);
    if (scope.module !== 'RESTAURANT') {
      throw new BadRequestException('Recipes are only available for restaurant businesses.');
    }
    return this.saveRecipe(scope, undefined, body);
  }

  async updateRecipe(headers: HeadersLike, id: string, body: Record<string, unknown>) {
    const scope = await this.resolveScope(headers);
    return this.saveRecipe(scope, id, body);
  }

  async deleteRecipe(headers: HeadersLike, id: string) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<{ id: string; menuItemId: string | null }>(
      `DELETE FROM "Recipe" WHERE id = $1 AND "businessId" = $2 RETURNING id, "menuItemId"`,
      [id, scope.businessId],
    );
    if (!rows[0]) throw new NotFoundException('Recipe was not found.');

    if (rows[0].menuItemId) {
      await this.safeQuery(
        `UPDATE products SET is_available = FALSE, updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = $1`,
        [rows[0].menuItemId],
      );
      await this.safeQuery(
        `DELETE FROM "InventoryItem" WHERE id = $1 AND "businessId" = $2`,
        [rows[0].menuItemId, scope.businessId],
      );
    }
    return rows[0];
  }

  private async saveRecipe(scope: Scope, recipeId: string | undefined, body: Record<string, unknown>) {
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients as Record<string, unknown>[] : [];
    if (!String(body.name ?? '').trim() || !String(body.category ?? '').trim()) {
      throw new BadRequestException('Recipe name and category are required.');
    }
    if (ingredients.length === 0) {
      throw new BadRequestException('A recipe must have at least one ingredient.');
    }

    const defaultLocationId = await this.getDefaultLocationId(scope.businessId);
    const result = await this.databaseService.withTransaction(async (client) => {
      const current = recipeId
        ? await client.query<{ menuItemId: string | null }>(
            `SELECT "menuItemId" FROM "Recipe" WHERE id = $1 AND "businessId" = $2`,
            [recipeId, scope.businessId],
          )
        : null;
      if (recipeId && !current?.rows[0]) throw new NotFoundException('Recipe was not found.');

      const menuItemId = current?.rows[0]?.menuItemId ?? randomUUID();
      const locationId = String(body.locationId ?? defaultLocationId);
      await client.query(
        `
          INSERT INTO "InventoryItem" (
            id, name, description, "itemType", category, quantity, price, "imageUrl",
            unit, "locationId", "businessId", "updatedAt"
          ) VALUES ($1, $2, $3, 'MENU_ITEM', $4, 0, $5, $6, 'serving', $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            "imageUrl" = EXCLUDED."imageUrl",
            "updatedAt" = CURRENT_TIMESTAMP
        `,
        [
          menuItemId,
          String(body.name).trim(),
          body.description ?? null,
          String(body.category).trim(),
          Number(body.sellingPrice ?? 0),
          body.imageUrl ?? null,
          locationId,
          scope.businessId,
        ],
      );

      const savedId = recipeId ?? randomUUID();
      const recipeRows = await client.query<Record<string, unknown>>(
        `
          INSERT INTO "Recipe" (
            id, name, category, servings, "yieldPercentage", "prepTimeMinutes",
            instructions, "targetFoodCost", "sellingPrice", "isActive", "imageUrl",
            modifiers, "menuItemId", "businessId", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, category = EXCLUDED.category, servings = EXCLUDED.servings,
            "yieldPercentage" = EXCLUDED."yieldPercentage", "prepTimeMinutes" = EXCLUDED."prepTimeMinutes",
            instructions = EXCLUDED.instructions, "targetFoodCost" = EXCLUDED."targetFoodCost",
            "sellingPrice" = EXCLUDED."sellingPrice", "isActive" = EXCLUDED."isActive",
            "imageUrl" = EXCLUDED."imageUrl", modifiers = EXCLUDED.modifiers,
            "menuItemId" = EXCLUDED."menuItemId", "updatedAt" = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [
          savedId, String(body.name).trim(), String(body.category).trim(), Number(body.servings ?? 1),
          Number(body.yieldPercentage ?? 100), body.prepTimeMinutes == null ? null : Number(body.prepTimeMinutes),
          body.instructions ?? null, body.targetFoodCost == null ? null : Number(body.targetFoodCost),
          body.sellingPrice == null ? null : Number(body.sellingPrice), body.isActive !== false,
          body.imageUrl ?? null, JSON.stringify(body.modifiers ?? []), menuItemId, scope.businessId,
        ],
      );

      await client.query(`DELETE FROM "RecipeIngredient" WHERE "recipeId" = $1`, [savedId]);
      for (const ingredient of ingredients) {
        const itemId = String(ingredient.itemId ?? '');
        if (!itemId) throw new BadRequestException('Every recipe ingredient must link to an inventory item.');
        const quantity = Number(ingredient.quantity ?? 0);
        const unitCost = ingredient.unitCost == null ? null : Number(ingredient.unitCost);
        await client.query(
          `INSERT INTO "RecipeIngredient" (id, "recipeId", "itemId", quantity, unit, "unitCost", "totalCost", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
          [randomUUID(), savedId, itemId, quantity, ingredient.unit ?? null, unitCost, unitCost == null ? null : quantity * unitCost],
        );
      }
      return { recipe: recipeRows.rows[0], menuItemId, recipeId: savedId };
    });

    await this.syncInventoryItemToPos(result.menuItemId, result.recipeId, body.isActive !== false);
    return result.recipe;
  }

  /** Keep the inventory catalog and the numeric-ID POS compatibility catalog in lockstep. */
  private async syncInventoryItemToPos(itemId: string, recipeId?: string, isAvailable = true) {
    await this.databaseService.withTransaction(async (client) => {
      const itemResult = await client.query<{
        id: string; businessId: string; itemType: string; name: string; description: string | null;
        category: string; price: number; imageUrl: string | null; sku: string | null; barcode: string | null;
        unit: string | null; size: string | null; quantity: number; minStock: number | null;
      }>(`SELECT * FROM "InventoryItem" WHERE id = $1`, [itemId]);
      const item = itemResult.rows[0];
      if (!item || !['RETAIL_ITEM', 'MENU_ITEM'].includes(item.itemType)) return;

      const storeResult = await client.query<{ id: number; store_type: string }>(
        `
          SELECT DISTINCT s.id, CASE WHEN s.store_type = 'RETAIL' THEN 'RETAIL_STORE' ELSE s.store_type END AS store_type
          FROM stores s
          LEFT JOIN users pu ON pu.store_id = s.id
          LEFT JOIN "User" iu ON lower(iu.email) = lower(pu.email)
          WHERE iu."businessId" = $1
             OR (iu.id IS NULL AND s.store_type = CASE WHEN $2 = 'RETAIL_ITEM' THEN 'RETAIL_STORE' ELSE 'RESTAURANT' END)
          ORDER BY CASE WHEN iu."businessId" = $1 THEN 0 ELSE 1 END, s.id
          LIMIT 1
        `,
        [item.businessId, item.itemType],
      );
      const store = storeResult.rows[0];
      if (!store) return;

      const categoryResult = await client.query<{ id: number }>(
        `
          INSERT INTO product_categories (store_id, store_type, name)
          SELECT $1, $2, $3
          WHERE NOT EXISTS (
            SELECT 1 FROM product_categories WHERE store_id = $1 AND store_type = $2 AND lower(name) = lower($3)
          )
          RETURNING id
        `,
        [store.id, store.store_type, item.category],
      );
      const existingCategory = categoryResult.rows[0] ?? (await client.query<{ id: number }>(
        `SELECT id FROM product_categories WHERE store_id = $1 AND store_type = $2 AND lower(name) = lower($3) LIMIT 1`,
        [store.id, store.store_type, item.category],
      )).rows[0];

      const productResult = await client.query<{ id: number }>(
        `
          INSERT INTO products (
            store_id, category_id, store_type, name, description, price, image_url, sku, barcode,
            unit, size, stock_quantity, low_stock_limit, is_available, inventory_item_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (store_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL DO UPDATE SET
            category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
            price = EXCLUDED.price, image_url = EXCLUDED.image_url, sku = EXCLUDED.sku,
            barcode = EXCLUDED.barcode, unit = EXCLUDED.unit, size = EXCLUDED.size,
            stock_quantity = EXCLUDED.stock_quantity, low_stock_limit = EXCLUDED.low_stock_limit,
            is_available = EXCLUDED.is_available, updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `,
        [store.id, existingCategory?.id ?? null, store.store_type, item.name, item.description, item.price,
          item.imageUrl, item.sku, item.barcode, item.unit, item.size, item.quantity, item.minStock,
          isAvailable, item.id],
      );
      const productId = productResult.rows[0].id;

      if (item.itemType === 'RETAIL_ITEM') {
        await client.query(
          `
            INSERT INTO product_variants (
              product_id, size, sku, barcode, image_url, price, stock_quantity, low_stock_limit,
              is_active, inventory_item_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (product_id, inventory_item_id) WHERE inventory_item_id IS NOT NULL DO UPDATE SET
              size = EXCLUDED.size, sku = EXCLUDED.sku, barcode = EXCLUDED.barcode,
              image_url = EXCLUDED.image_url, price = EXCLUDED.price,
              stock_quantity = EXCLUDED.stock_quantity, low_stock_limit = EXCLUDED.low_stock_limit,
              is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
          `,
          [productId, item.size, item.sku, item.barcode, item.imageUrl, item.price, item.quantity, item.minStock, isAvailable, item.id],
        );
      } else if (recipeId) {
        await client.query(`DELETE FROM product_ingredients WHERE product_id = $1`, [productId]);
        await client.query(
          `
            INSERT INTO product_ingredients (
              store_id, product_id, ingredient_id, ingredient_name, quantity_required,
              default_quantity, unit, additional_cost, is_required, is_removable, recipe_ingredient_id
            )
            SELECT $1, $2, ii.id, inv.name, ri.quantity, ri.quantity,
                   COALESCE(ri.unit, inv.unit, 'unit'), COALESCE(ri."unitCost", 0), TRUE, TRUE, ri.id
            FROM "RecipeIngredient" ri
            JOIN "InventoryItem" inv ON inv.id = ri."itemId"
            JOIN ingredients_inventory ii ON ii.store_id = $1 AND ii.inventory_item_id = inv.id
            WHERE ri."recipeId" = $3
          `,
          [store.id, productId, recipeId],
        );
      }
    });
  }

  async listKitchenOrders(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT
          ko.*,
          row_to_json(r.*) AS recipe,
          row_to_json(l.*) AS location,
          row_to_json(t.*) AS table
        FROM "KitchenOrder" ko
        JOIN "Recipe" r ON r.id = ko."recipeId"
        LEFT JOIN "Location" l ON l.id = ko."locationId"
        LEFT JOIN "DiningTable" t ON t.id = ko."tableId"
        WHERE ko."businessId" = $1
          AND ($2::text IS NULL OR ko.status = $2::"KitchenOrderStatus")
        ORDER BY ko."createdAt" DESC
      `,
      [scope.businessId, query.status ?? null],
    );
    return this.paged(rows);
  }

  async listSuppliers(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT *
        FROM "Supplier"
        WHERE "businessId" = $1
          AND module = $2::"BusinessModule"
          AND ($3::text IS NULL OR "isActive" = $3::boolean)
        ORDER BY name ASC
      `,
      [scope.businessId, query.module ?? scope.module, query.isActive ?? null],
    );
    return this.paged(rows);
  }

  async listPurchaseOrders(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT
          po.*,
          row_to_json(s.*) AS supplier,
          COALESCE(items.items, '[]'::json) AS items
        FROM "PurchaseOrder" po
        LEFT JOIN "Supplier" s ON s.id = po."supplierId"
        LEFT JOIN LATERAL (
          SELECT json_agg(poi.* ORDER BY poi."createdAt") AS items
          FROM "PurchaseOrderItem" poi
          WHERE poi."purchaseOrderId" = po.id
        ) items ON TRUE
        WHERE po."businessId" = $1
          AND po.module = $2::"BusinessModule"
          AND ($3::text IS NULL OR po.status = $3::"PurchaseOrderStatus")
        ORDER BY po."createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module, query.status ?? null],
    );
    return this.paged(rows);
  }

  async listGoodsReceipts(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT gr.*, COALESCE(items.items, '[]'::json) AS items
        FROM "GoodsReceipt" gr
        LEFT JOIN LATERAL (
          SELECT json_agg(gri.* ORDER BY gri."createdAt") AS items
          FROM "GoodsReceiptItem" gri
          WHERE gri."goodsReceiptId" = gr.id
        ) items ON TRUE
        WHERE gr."businessId" = $1
          AND gr.module = $2::"BusinessModule"
          AND ($3::text IS NULL OR gr."purchaseOrderId" = $3)
        ORDER BY gr."createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module, query.purchaseOrderId ?? null],
    );
    return this.paged(rows);
  }

  async listTransfers(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT tr.*, row_to_json(fl.*) AS "fromLocation", row_to_json(tl.*) AS "toLocation"
        FROM "Transfer" tr
        LEFT JOIN "Location" fl ON fl.id = tr."fromLocationId"
        LEFT JOIN "Location" tl ON tl.id = tr."toLocationId"
        WHERE tr."businessId" = $1
          AND tr.module = $2::"BusinessModule"
          AND ($3::text IS NULL OR tr.status = $3::"TransferStatus")
        ORDER BY tr."createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module, query.status ?? null],
    );
    return this.paged(rows);
  }

  async listSales(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT s.*, COALESCE(items.items, '[]'::json) AS items
        FROM "Sale" s
        LEFT JOIN LATERAL (
          SELECT json_agg(si.* ORDER BY si."createdAt") AS items
          FROM "SaleItem" si
          WHERE si."saleId" = s.id
        ) items ON TRUE
        WHERE s."businessId" = $1
          AND s.module = $2::"BusinessModule"
        ORDER BY s."createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module],
    );
    return this.paged(rows);
  }

  async listStockMovements(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT sm.*, row_to_json(i.*) AS item, row_to_json(l.*) AS location
        FROM "StockMovement" sm
        LEFT JOIN "InventoryItem" i ON i.id = sm."itemId"
        LEFT JOIN "Location" l ON l.id = sm."locationId"
        WHERE sm."businessId" = $1
          AND sm.module = $2::"BusinessModule"
          AND ($3::text IS NULL OR sm.type = $3::"StockMovementType")
        ORDER BY sm."createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module, query.type ?? null],
    );
    return this.paged(rows);
  }

  async createStockMovement(headers: HeadersLike, body: Record<string, unknown>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        INSERT INTO "StockMovement" (
          id, type, quantity, "previousQuantity", "newQuantity", unit,
          reason, "referenceType", "referenceId", notes, "itemId",
          "locationId", "businessId", module, "createdById"
        )
        VALUES ($1, $2::"StockMovementType", $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::"BusinessModule", $15)
        RETURNING *
      `,
      [
        randomUUID(),
        String(body.type ?? 'ADJUSTMENT'),
        Number(body.quantity ?? 0),
        Number(body.previousQuantity ?? 0),
        Number(body.newQuantity ?? body.quantity ?? 0),
        body.unit ?? null,
        body.reason ?? null,
        body.referenceType ?? null,
        body.referenceId ?? null,
        body.notes ?? null,
        String(body.itemId ?? ''),
        String(body.locationId ?? (await this.getDefaultLocationId(scope.businessId))),
        scope.businessId,
        String(body.module ?? scope.module),
        scope.user.id,
      ],
    );
    return rows[0];
  }

  async listBundles(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT bp.*, COALESCE(items.items, '[]'::json) AS items
        FROM "BundlePackage" bp
        LEFT JOIN LATERAL (
          SELECT json_agg(bi.* ORDER BY bi."createdAt") AS items
          FROM "BundleItem" bi
          WHERE bi."bundleId" = bp.id
        ) items ON TRUE
        WHERE bp."businessId" = $1
          AND ($2::text IS NULL OR bp.status = $2::"BundleStatus")
        ORDER BY bp."createdAt" DESC
      `,
      [scope.businessId, query.status ?? null],
    );
    return this.paged(rows);
  }

  async listAdjustments(headers: HeadersLike, query: Record<string, string | undefined>) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        SELECT *
        FROM "StockAdjustment"
        WHERE "businessId" = $1
          AND module = $2::"BusinessModule"
          AND ($3::text IS NULL OR status = $3::"AdjustmentStatus")
        ORDER BY "createdAt" DESC
      `,
      [scope.businessId, query.module ?? scope.module, query.status ?? null],
    );
    return this.paged(rows);
  }

  async listRestaurantSettings(headers: HeadersLike) {
    const scope = await this.resolveScope(headers);
    return this.safeQuery<Record<string, unknown>>(
      `
        SELECT key, value
        FROM "RestaurantSetting"
        WHERE "businessId" = $1
        ORDER BY key ASC
      `,
      [scope.businessId],
    );
  }

  async upsertRestaurantSetting(headers: HeadersLike, key: string, value: unknown) {
    const scope = await this.resolveScope(headers);
    const rows = await this.safeQuery<Record<string, unknown>>(
      `
        INSERT INTO "RestaurantSetting" (id, key, value, "businessId")
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT ("businessId", key)
        DO UPDATE SET value = EXCLUDED.value, "updatedAt" = CURRENT_TIMESTAMP
        RETURNING key, value
      `,
      [randomUUID(), key, JSON.stringify(value ?? null), scope.businessId],
    );
    return rows[0];
  }

  async deleteById(tableName: string, id: string) {
    const rows = await this.safeQuery<Record<string, unknown>>(
      `DELETE FROM "${tableName}" WHERE id = $1 RETURNING *`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException(`${tableName} row was not found.`);
    return rows[0];
  }

  private async getDefaultLocationId(businessId: string) {
    const rows = await this.safeQuery<{ id: string }>(
      `
        SELECT id
        FROM "Location"
        WHERE "businessId" = $1
        ORDER BY "createdAt" ASC
        LIMIT 1
      `,
      [businessId],
    );
    if (!rows[0]) throw new NotFoundException('No inventory location exists for this business.');
    return rows[0].id;
  }

  private async resolveScope(headers: HeadersLike): Promise<Scope> {
    const storeType = this.headerValue(headers['x-pos-store-type']);
    const module: BusinessModule = storeType === 'RESTAURANT' ? 'RESTAURANT' : 'RETAIL';
    const bridgedEmail = this.headerValue(headers['x-pos-bridge-email']);
    const fallbackEmail = module === 'RESTAURANT' ? 'admin@restaurant.com' : 'admin@retail.com';
    const email = bridgedEmail || fallbackEmail;

    const userRows = await this.safeQuery<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      businessId: string;
      modules: BusinessModule[];
      lastLogin: string;
    }>(
      `
        SELECT
          u.id, u.name, u.email, u.role, u.status,
          u."businessId" AS "businessId",
          b.modules,
          u."lastLogin" AS "lastLogin"
        FROM "User" u
        JOIN "Business" b ON b.id = u."businessId"
        WHERE lower(u.email) = lower($1)
          AND u.status = 'Active'
        LIMIT 1
      `,
      [email],
    );

    let user = userRows[0];
    if (!user && email !== fallbackEmail) {
      const fallbackRows = await this.safeQuery<typeof userRows[number]>(
        `
          SELECT
            u.id, u.name, u.email, u.role, u.status,
            u."businessId" AS "businessId",
            b.modules,
            u."lastLogin" AS "lastLogin"
          FROM "User" u
          JOIN "Business" b ON b.id = u."businessId"
          WHERE lower(u.email) = lower($1)
            AND u.status = 'Active'
          LIMIT 1
        `,
        [fallbackEmail],
      );
      user = fallbackRows[0];
    }

    if (user) {
      return {
        businessId: user.businessId,
        module,
        user: {
          ...user,
          modules: user.modules ?? [module],
        },
      };
    }

    const businessRows = await this.safeQuery<{ id: string; modules: BusinessModule[] }>(
      `
        SELECT id, modules
        FROM "Business"
        WHERE $1::"BusinessModule" = ANY(modules)
        ORDER BY "createdAt" ASC
        LIMIT 1
      `,
      [module],
    );
    const business = businessRows[0];
    if (!business) throw new NotFoundException('No inventory business exists for this POS store type.');

    return {
      businessId: business.id,
      module,
      user: {
        id: 'pos-bridge',
        name: 'POS Bridge',
        email,
        role: 'Admin',
        status: 'Active',
        businessId: business.id,
        modules: business.modules ?? [module],
        lastLogin: new Date().toISOString(),
      },
    };
  }

  private async safeQuery<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      return await this.databaseService.query<T>(sql, params);
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  private paged<T>(data: T[]): Paged<T> {
    return {
      data,
      total: data.length,
      page: 1,
      limit: data.length || 50,
      totalPages: 1,
    };
  }

  private headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
