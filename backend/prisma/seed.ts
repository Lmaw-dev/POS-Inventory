import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
} as any);

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const staffPasswordHash = await bcrypt.hash('staff123', 12);

  const business = await prisma.business.upsert({
    where: { name: 'Retail + Restaurant Demo' },
    update: {
      modules: ['RETAIL', 'RESTAURANT'],
    },
    create: {
      name: 'Retail + Restaurant Demo',
      modules: ['RETAIL', 'RESTAURANT'],
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@retaildemo.com' },
    update: {
      name: 'Admin User',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: business.id,
    },
    create: {
      name: 'Admin User',
      email: 'admin@retaildemo.com',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: business.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@retaildemo.com' },
    update: {
      name: 'Staff User',
      role: 'Staff',
      status: 'Active',
      passwordHash: staffPasswordHash,
      businessId: business.id,
    },
    create: {
      name: 'Staff User',
      email: 'staff@retaildemo.com',
      role: 'Staff',
      status: 'Active',
      passwordHash: staffPasswordHash,
      businessId: business.id,
    },
  });

  const mainStore = await prisma.location.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Main Store' } },
    update: {
      address: 'Downtown Branch',
      manager: 'Admin User',
      phone: '+63 900 000 0001',
    },
    create: {
      name: 'Main Store',
      address: 'Downtown Branch',
      manager: 'Admin User',
      phone: '+63 900 000 0001',
      businessId: business.id,
    },
  });

  const warehouse = await prisma.location.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Warehouse' } },
    update: {
      address: 'Storage Facility',
      manager: 'Warehouse Manager',
      phone: '+63 900 000 0002',
    },
    create: {
      name: 'Warehouse',
      address: 'Storage Facility',
      manager: 'Warehouse Manager',
      phone: '+63 900 000 0002',
      businessId: business.id,
    },
  });

  await prisma.location.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Branch 1' } },
    update: {
      address: 'Branch Location',
      manager: 'Branch Manager',
      phone: '+63 900 000 0003',
    },
    create: {
      name: 'Branch 1',
      address: 'Branch Location',
      manager: 'Branch Manager',
      phone: '+63 900 000 0003',
      businessId: business.id,
    },
  });

  const coldStorage = await prisma.location.upsert({
    where: {
      businessId_name: { businessId: business.id, name: 'Cold Storage' },
    },
    update: {
      address: 'Restaurant cold storage',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0004',
    },
    create: {
      name: 'Cold Storage',
      address: 'Restaurant cold storage',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0004',
      businessId: business.id,
    },
  });

  const dryStorage = await prisma.location.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Dry Storage' } },
    update: {
      address: 'Restaurant dry storage',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0005',
    },
    create: {
      name: 'Dry Storage',
      address: 'Restaurant dry storage',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0005',
      businessId: business.id,
    },
  });

  const kitchen = await prisma.location.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Kitchen' } },
    update: {
      address: 'Restaurant kitchen',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0006',
    },
    create: {
      name: 'Kitchen',
      address: 'Restaurant kitchen',
      manager: 'Kitchen Manager',
      phone: '+63 900 000 0006',
      businessId: business.id,
    },
  });

  const existingItems = await prisma.inventoryItem.count({
    where: { businessId: business.id },
  });
  if (existingItems === 0) {
    await prisma.inventoryItem.createMany({
      data: [
        {
          name: 'Vintage Band T-Shirt',
          itemType: 'RETAIL_ITEM',
          sku: 'RTL-TEE-001',
          category: 'Tops',
          targetCustomer: 'Unisex',
          subcategory: 'T-Shirts',
          size: 'M',
          condition: 'Good',
          quantity: 8,
          price: 180,
          unit: 'pcs',
          minStock: 1,
          reorderPoint: 3,
          locationId: mainStore.id,
          businessId: business.id,
        },
        {
          name: 'Classic Denim Jeans',
          itemType: 'RETAIL_ITEM',
          sku: 'RTL-JEANS-001',
          category: 'Bottoms',
          targetCustomer: 'Unisex',
          subcategory: 'Jeans',
          size: '30',
          condition: 'Excellent',
          quantity: 5,
          price: 250,
          unit: 'pcs',
          minStock: 1,
          reorderPoint: 3,
          locationId: mainStore.id,
          businessId: business.id,
        },
        {
          name: 'Mixed Clothing Lot',
          itemType: 'RETAIL_ITEM',
          sku: 'RTL-MIX-001',
          category: 'Mixed Lots',
          targetCustomer: 'Unisex',
          subcategory: 'Mixed Clothing',
          size: 'Assorted',
          condition: 'Good',
          quantity: 20,
          price: 120,
          unit: 'pcs',
          minStock: 2,
          reorderPoint: 5,
          locationId: warehouse.id,
          businessId: business.id,
        },
      ],
    });
  }

  const romaine = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'REST-ING-001' } },
    update: {
      name: 'Romaine Lettuce',
      itemType: 'INGREDIENT',
      category: 'Vegetables',
      quantity: 15,
      price: 45,
      unit: 'kg',
      minStock: 3,
      reorderPoint: 5,
      expiryDate: new Date('2026-06-10T00:00:00.000Z'),
      storageTemperature: 'Chilled',
      locationId: coldStorage.id,
    },
    create: {
      name: 'Romaine Lettuce',
      itemType: 'INGREDIENT',
      sku: 'REST-ING-001',
      category: 'Vegetables',
      quantity: 15,
      price: 45,
      unit: 'kg',
      minStock: 3,
      reorderPoint: 5,
      expiryDate: new Date('2026-06-10T00:00:00.000Z'),
      storageTemperature: 'Chilled',
      locationId: coldStorage.id,
      businessId: business.id,
    },
  });

  const chicken = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'REST-ING-002' } },
    update: {
      name: 'Chicken Breast',
      itemType: 'INGREDIENT',
      category: 'Meat & Poultry',
      quantity: 20,
      price: 185,
      unit: 'kg',
      minStock: 4,
      reorderPoint: 8,
      expiryDate: new Date('2026-06-09T00:00:00.000Z'),
      storageTemperature: 'Frozen',
      locationId: coldStorage.id,
    },
    create: {
      name: 'Chicken Breast',
      itemType: 'INGREDIENT',
      sku: 'REST-ING-002',
      category: 'Meat & Poultry',
      quantity: 20,
      price: 185,
      unit: 'kg',
      minStock: 4,
      reorderPoint: 8,
      expiryDate: new Date('2026-06-09T00:00:00.000Z'),
      storageTemperature: 'Frozen',
      locationId: coldStorage.id,
      businessId: business.id,
    },
  });

  const oliveOil = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'REST-ING-003' } },
    update: {
      name: 'Olive Oil',
      itemType: 'INGREDIENT',
      category: 'Condiments',
      quantity: 10,
      price: 320,
      unit: 'L',
      minStock: 2,
      reorderPoint: 3,
      storageTemperature: 'Dry storage',
      locationId: dryStorage.id,
    },
    create: {
      name: 'Olive Oil',
      itemType: 'INGREDIENT',
      sku: 'REST-ING-003',
      category: 'Condiments',
      quantity: 10,
      price: 320,
      unit: 'L',
      minStock: 2,
      reorderPoint: 3,
      storageTemperature: 'Dry storage',
      locationId: dryStorage.id,
      businessId: business.id,
    },
  });

  const caesarMenuItem = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'REST-MENU-001' } },
    update: {
      name: 'Chicken Caesar Salad',
      itemType: 'MENU_ITEM',
      category: 'Salads',
      quantity: 0,
      price: 220,
      unit: 'serving',
      locationId: kitchen.id,
    },
    create: {
      name: 'Chicken Caesar Salad',
      itemType: 'MENU_ITEM',
      sku: 'REST-MENU-001',
      category: 'Salads',
      quantity: 0,
      price: 220,
      unit: 'serving',
      locationId: kitchen.id,
      businessId: business.id,
    },
  });

  const caesarRecipe = await prisma.recipe.upsert({
    where: {
      businessId_name: {
        businessId: business.id,
        name: 'Chicken Caesar Salad',
      },
    },
    update: {
      category: 'Salads',
      servings: 4,
      yieldPercentage: 100,
      prepTimeMinutes: 15,
      sellingPrice: 220,
      targetFoodCost: 35,
      isActive: true,
      menuItemId: caesarMenuItem.id,
      instructions: 'Prepare greens, grill chicken, toss, and plate.',
    },
    create: {
      name: 'Chicken Caesar Salad',
      category: 'Salads',
      servings: 4,
      yieldPercentage: 100,
      prepTimeMinutes: 15,
      sellingPrice: 220,
      targetFoodCost: 35,
      isActive: true,
      menuItemId: caesarMenuItem.id,
      instructions: 'Prepare greens, grill chicken, toss, and plate.',
      businessId: business.id,
    },
  });

  await prisma.recipeIngredient.deleteMany({
    where: { recipeId: caesarRecipe.id },
  });

  await prisma.recipeIngredient.createMany({
    data: [
      {
        recipeId: caesarRecipe.id,
        itemId: romaine.id,
        quantity: 0.3,
        unit: 'kg',
        unitCost: 45,
        totalCost: 13.5,
      },
      {
        recipeId: caesarRecipe.id,
        itemId: chicken.id,
        quantity: 0.4,
        unit: 'kg',
        unitCost: 185,
        totalCost: 74,
      },
      {
        recipeId: caesarRecipe.id,
        itemId: oliveOil.id,
        quantity: 0.05,
        unit: 'L',
        unitCost: 320,
        totalCost: 16,
      },
    ],
  });

  // --- Retail-only business ---
  const ukayBusiness = await prisma.business.upsert({
    where: { name: 'Retail-Only Demo' },
    update: { modules: ['RETAIL'] },
    create: { name: 'Retail-Only Demo', modules: ['RETAIL'] },
  });

  const legacyRetailAdmin = await prisma.user.findUnique({
    where: { email: 'admin@ukay.com' },
    select: { id: true },
  });
  const currentRetailAdmin = await prisma.user.findUnique({
    where: { email: 'admin@retail.com' },
    select: { id: true },
  });

  if (legacyRetailAdmin && !currentRetailAdmin) {
    await prisma.user.update({
      where: { id: legacyRetailAdmin.id },
      data: { email: 'admin@retail.com' },
    });
  }

  await prisma.user.upsert({
    where: { email: 'admin@retail.com' },
    update: {
      name: 'Retail Admin',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: ukayBusiness.id,
    },
    create: {
      name: 'Retail Admin',
      email: 'admin@retail.com',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: ukayBusiness.id,
    },
  });

  await prisma.location.upsert({
    where: { businessId_name: { businessId: ukayBusiness.id, name: 'Main Store' } },
    update: { address: 'Downtown', manager: 'Retail Admin', phone: '+63 900 100 0001' },
    create: {
      name: 'Main Store',
      address: 'Downtown',
      manager: 'Retail Admin',
      phone: '+63 900 100 0001',
      businessId: ukayBusiness.id,
    },
  });

  // --- Restaurant-only business ---
  const restaurantBusiness = await prisma.business.upsert({
    where: { name: 'Restaurant-Only Demo' },
    update: { modules: ['RESTAURANT'] },
    create: { name: 'Restaurant-Only Demo', modules: ['RESTAURANT'] },
  });

  await prisma.user.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {
      name: 'Restaurant Admin',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: restaurantBusiness.id,
    },
    create: {
      name: 'Restaurant Admin',
      email: 'admin@restaurant.com',
      role: 'Admin',
      status: 'Active',
      passwordHash: adminPasswordHash,
      businessId: restaurantBusiness.id,
    },
  });

  const restKitchen = await prisma.location.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Kitchen' } },
    update: { address: 'Main Kitchen', manager: 'Restaurant Admin', phone: '+63 900 200 0001' },
    create: {
      name: 'Kitchen',
      address: 'Main Kitchen',
      manager: 'Restaurant Admin',
      phone: '+63 900 200 0001',
      businessId: restaurantBusiness.id,
    },
  });

  const restColdStorage = await prisma.location.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Cold Storage' } },
    update: { address: 'Cold Storage Room', manager: 'Restaurant Admin', phone: '+63 900 200 0002' },
    create: {
      name: 'Cold Storage',
      address: 'Cold Storage Room',
      manager: 'Restaurant Admin',
      phone: '+63 900 200 0002',
      businessId: restaurantBusiness.id,
    },
  });

  const restDryStorage = await prisma.location.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Dry Storage' } },
    update: { address: 'Dry Storage Room', manager: 'Restaurant Admin', phone: '+63 900 200 0003' },
    create: {
      name: 'Dry Storage',
      address: 'Dry Storage Room',
      manager: 'Restaurant Admin',
      phone: '+63 900 200 0003',
      businessId: restaurantBusiness.id,
    },
  });

  const restChicken = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-001' } },
    update: { name: 'Chicken Breast', itemType: 'INGREDIENT', category: 'Meat > Poultry', quantity: 15, price: 185, unit: 'kg', minStock: 3, reorderPoint: 5, storageTemperature: 'Frozen', locationId: restKitchen.id },
    create: { name: 'Chicken Breast', itemType: 'INGREDIENT', sku: 'REST2-ING-001', category: 'Meat > Poultry', quantity: 15, price: 185, unit: 'kg', minStock: 3, reorderPoint: 5, storageTemperature: 'Frozen', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const restRice = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-002' } },
    update: { name: 'White Rice', itemType: 'INGREDIENT', category: 'Grains > Rice', quantity: 50, price: 48, unit: 'kg', minStock: 10, reorderPoint: 20, storageTemperature: 'Dry storage', locationId: restKitchen.id },
    create: { name: 'White Rice', itemType: 'INGREDIENT', sku: 'REST2-ING-002', category: 'Grains > Rice', quantity: 50, price: 48, unit: 'kg', minStock: 10, reorderPoint: 20, storageTemperature: 'Dry storage', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const chickenRiceMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-001' } },
    update: { name: 'Chicken Rice Bowl', itemType: 'MENU_ITEM', category: 'Menu Items > Main Course', quantity: 0, price: 150, unit: 'serving', locationId: restKitchen.id },
    create: { name: 'Chicken Rice Bowl', itemType: 'MENU_ITEM', sku: 'REST2-MENU-001', category: 'Menu Items > Main Course', quantity: 0, price: 150, unit: 'serving', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const chickenRiceRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Chicken Rice Bowl' } },
    update: { category: 'Main Course', servings: 2, yieldPercentage: 100, prepTimeMinutes: 20, sellingPrice: 150, targetFoodCost: 40, isActive: true, menuItemId: chickenRiceMenu.id, instructions: 'Cook rice, grill chicken, plate together.' },
    create: { name: 'Chicken Rice Bowl', category: 'Main Course', servings: 2, yieldPercentage: 100, prepTimeMinutes: 20, sellingPrice: 150, targetFoodCost: 40, isActive: true, menuItemId: chickenRiceMenu.id, instructions: 'Cook rice, grill chicken, plate together.', businessId: restaurantBusiness.id },
  });

  await prisma.recipeIngredient.deleteMany({ where: { recipeId: chickenRiceRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: chickenRiceRecipe.id, itemId: restChicken.id, quantity: 0.3, unit: 'kg', unitCost: 185, totalCost: 55.5 },
      { recipeId: chickenRiceRecipe.id, itemId: restRice.id, quantity: 0.2, unit: 'kg', unitCost: 48, totalCost: 9.6 },
    ],
  });

  // ─── Restaurant-Only: Dining Area + Extra Staff ───────────────────────────
  const diningArea = await prisma.location.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Dining Area' } },
    update: { address: 'Main Dining Floor', manager: 'Restaurant Admin', phone: '+63 900 200 0004' },
    create: { name: 'Dining Area', address: 'Main Dining Floor', manager: 'Restaurant Admin', phone: '+63 900 200 0004', businessId: restaurantBusiness.id },
  });

  await prisma.user.upsert({
    where: { email: 'kitchen@restaurant.com' },
    update: { name: 'Kitchen Staff', role: 'KitchenStaff', status: 'Active', passwordHash: staffPasswordHash, businessId: restaurantBusiness.id },
    create: { name: 'Kitchen Staff', email: 'kitchen@restaurant.com', role: 'KitchenStaff', status: 'Active', passwordHash: staffPasswordHash, businessId: restaurantBusiness.id },
  });

  await prisma.user.upsert({
    where: { email: 'manager@restaurant.com' },
    update: { name: 'Floor Manager', role: 'Manager', status: 'Active', passwordHash: staffPasswordHash, businessId: restaurantBusiness.id },
    create: { name: 'Floor Manager', email: 'manager@restaurant.com', role: 'Manager', status: 'Active', passwordHash: staffPasswordHash, businessId: restaurantBusiness.id },
  });

  // ─── Restaurant-Only: More Ingredients ───────────────────────────────────
  const restTomatoes = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-003' } },
    update: { name: 'Tomatoes', itemType: 'INGREDIENT', category: 'Vegetables > Nightshades', quantity: 10, price: 60, unit: 'kg', minStock: 2, reorderPoint: 4, expiryDate: new Date('2026-06-18T00:00:00.000Z'), storageTemperature: 'Chilled', locationId: restColdStorage.id },
    create: { name: 'Tomatoes', itemType: 'INGREDIENT', sku: 'REST2-ING-003', category: 'Vegetables > Nightshades', quantity: 10, price: 60, unit: 'kg', minStock: 2, reorderPoint: 4, expiryDate: new Date('2026-06-18T00:00:00.000Z'), storageTemperature: 'Chilled', locationId: restColdStorage.id, businessId: restaurantBusiness.id },
  });

  const restOnions = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-004' } },
    update: { name: 'Onions', itemType: 'INGREDIENT', category: 'Vegetables > Root Vegetables', quantity: 8, price: 70, unit: 'kg', minStock: 2, reorderPoint: 3, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Onions', itemType: 'INGREDIENT', sku: 'REST2-ING-004', category: 'Vegetables > Root Vegetables', quantity: 8, price: 70, unit: 'kg', minStock: 2, reorderPoint: 3, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restGarlic = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-005' } },
    update: { name: 'Garlic', itemType: 'INGREDIENT', category: 'Vegetables > Root Vegetables', quantity: 0.4, price: 150, unit: 'kg', minStock: 0.5, reorderPoint: 1, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Garlic', itemType: 'INGREDIENT', sku: 'REST2-ING-005', category: 'Vegetables > Root Vegetables', quantity: 0.4, price: 150, unit: 'kg', minStock: 0.5, reorderPoint: 1, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restPorkBelly = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-006' } },
    update: { name: 'Pork Belly', itemType: 'INGREDIENT', category: 'Meat > Pork', quantity: 12, price: 250, unit: 'kg', minStock: 3, reorderPoint: 5, expiryDate: new Date('2026-06-15T00:00:00.000Z'), storageTemperature: 'Frozen', locationId: restColdStorage.id },
    create: { name: 'Pork Belly', itemType: 'INGREDIENT', sku: 'REST2-ING-006', category: 'Meat > Pork', quantity: 12, price: 250, unit: 'kg', minStock: 3, reorderPoint: 5, expiryDate: new Date('2026-06-15T00:00:00.000Z'), storageTemperature: 'Frozen', locationId: restColdStorage.id, businessId: restaurantBusiness.id },
  });

  const restSoySauce = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-007' } },
    update: { name: 'Soy Sauce', itemType: 'INGREDIENT', category: 'Oils & Condiments > Sauces', quantity: 6, price: 85, unit: 'L', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Soy Sauce', itemType: 'INGREDIENT', sku: 'REST2-ING-007', category: 'Oils & Condiments > Sauces', quantity: 6, price: 85, unit: 'L', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restVinegar = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-008' } },
    update: { name: 'Vinegar', itemType: 'INGREDIENT', category: 'Oils & Condiments > Vinegars', quantity: 4, price: 65, unit: 'L', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Vinegar', itemType: 'INGREDIENT', sku: 'REST2-ING-008', category: 'Oils & Condiments > Vinegars', quantity: 4, price: 65, unit: 'L', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restShrimp = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-009' } },
    update: { name: 'Tiger Shrimp', itemType: 'INGREDIENT', category: 'Seafood > Crustaceans', quantity: 5, price: 380, unit: 'kg', minStock: 1, reorderPoint: 2, expiryDate: new Date('2026-06-14T00:00:00.000Z'), storageTemperature: 'Frozen', locationId: restColdStorage.id },
    create: { name: 'Tiger Shrimp', itemType: 'INGREDIENT', sku: 'REST2-ING-009', category: 'Seafood > Crustaceans', quantity: 5, price: 380, unit: 'kg', minStock: 1, reorderPoint: 2, expiryDate: new Date('2026-06-14T00:00:00.000Z'), storageTemperature: 'Frozen', locationId: restColdStorage.id, businessId: restaurantBusiness.id },
  });

  const restTamarind = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-010' } },
    update: { name: 'Tamarind', itemType: 'INGREDIENT', category: 'Oils & Condiments > Spices', quantity: 0.8, price: 120, unit: 'kg', minStock: 0.5, reorderPoint: 1, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Tamarind', itemType: 'INGREDIENT', sku: 'REST2-ING-010', category: 'Oils & Condiments > Spices', quantity: 0.8, price: 120, unit: 'kg', minStock: 0.5, reorderPoint: 1, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restEggs = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-011' } },
    update: { name: 'Eggs', itemType: 'INGREDIENT', category: 'Dairy > Eggs', quantity: 120, price: 8, unit: 'pcs', minStock: 24, reorderPoint: 48, expiryDate: new Date('2026-06-22T00:00:00.000Z'), storageTemperature: 'Chilled', locationId: restColdStorage.id },
    create: { name: 'Eggs', itemType: 'INGREDIENT', sku: 'REST2-ING-011', category: 'Dairy > Eggs', quantity: 120, price: 8, unit: 'pcs', minStock: 24, reorderPoint: 48, expiryDate: new Date('2026-06-22T00:00:00.000Z'), storageTemperature: 'Chilled', locationId: restColdStorage.id, businessId: restaurantBusiness.id },
  });

  const restCondensedMilk = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-012' } },
    update: { name: 'Condensed Milk', itemType: 'INGREDIENT', category: 'Dairy > Milk Products', quantity: 24, price: 45, unit: 'cans', minStock: 6, reorderPoint: 12, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Condensed Milk', itemType: 'INGREDIENT', sku: 'REST2-ING-012', category: 'Dairy > Milk Products', quantity: 24, price: 45, unit: 'cans', minStock: 6, reorderPoint: 12, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restSugar = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-013' } },
    update: { name: 'Sugar', itemType: 'INGREDIENT', category: 'Oils & Condiments > Seasonings', quantity: 10, price: 55, unit: 'kg', minStock: 2, reorderPoint: 4, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Sugar', itemType: 'INGREDIENT', sku: 'REST2-ING-013', category: 'Oils & Condiments > Seasonings', quantity: 10, price: 55, unit: 'kg', minStock: 2, reorderPoint: 4, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  const restIcedTeaMix = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-ING-014' } },
    update: { name: 'Iced Tea Mix', itemType: 'INGREDIENT', category: 'Beverages > Mixes', quantity: 5, price: 180, unit: 'kg', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id },
    create: { name: 'Iced Tea Mix', itemType: 'INGREDIENT', sku: 'REST2-ING-014', category: 'Beverages > Mixes', quantity: 5, price: 180, unit: 'kg', minStock: 1, reorderPoint: 2, storageTemperature: 'Dry storage', locationId: restDryStorage.id, businessId: restaurantBusiness.id },
  });

  // ─── Restaurant-Only: More Menu Items ────────────────────────────────────
  const porkAdoboMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-002' } },
    update: { name: 'Pork Adobo', itemType: 'MENU_ITEM', category: 'Menu Items > Main Course', quantity: 0, price: 165, unit: 'serving', locationId: restKitchen.id },
    create: { name: 'Pork Adobo', itemType: 'MENU_ITEM', sku: 'REST2-MENU-002', category: 'Menu Items > Main Course', quantity: 0, price: 165, unit: 'serving', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const sinigangMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-003' } },
    update: { name: 'Sinigang na Baboy', itemType: 'MENU_ITEM', category: 'Menu Items > Soups', quantity: 0, price: 185, unit: 'serving', locationId: restKitchen.id },
    create: { name: 'Sinigang na Baboy', itemType: 'MENU_ITEM', sku: 'REST2-MENU-003', category: 'Menu Items > Soups', quantity: 0, price: 185, unit: 'serving', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const shrimpMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-004' } },
    update: { name: 'Garlic Butter Shrimp', itemType: 'MENU_ITEM', category: 'Menu Items > Main Course', quantity: 0, price: 280, unit: 'serving', locationId: restKitchen.id },
    create: { name: 'Garlic Butter Shrimp', itemType: 'MENU_ITEM', sku: 'REST2-MENU-004', category: 'Menu Items > Main Course', quantity: 0, price: 280, unit: 'serving', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const lecheFlanMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-005' } },
    update: { name: 'Leche Flan', itemType: 'MENU_ITEM', category: 'Menu Items > Desserts', quantity: 0, price: 95, unit: 'serving', locationId: restKitchen.id },
    create: { name: 'Leche Flan', itemType: 'MENU_ITEM', sku: 'REST2-MENU-005', category: 'Menu Items > Desserts', quantity: 0, price: 95, unit: 'serving', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  const icedTeaMenu = await prisma.inventoryItem.upsert({
    where: { businessId_sku: { businessId: restaurantBusiness.id, sku: 'REST2-MENU-006' } },
    update: { name: 'Iced Tea', itemType: 'MENU_ITEM', category: 'Menu Items > Beverages', quantity: 0, price: 55, unit: 'glass', locationId: restKitchen.id },
    create: { name: 'Iced Tea', itemType: 'MENU_ITEM', sku: 'REST2-MENU-006', category: 'Menu Items > Beverages', quantity: 0, price: 55, unit: 'glass', locationId: restKitchen.id, businessId: restaurantBusiness.id },
  });

  // ─── Restaurant-Only: More Recipes ───────────────────────────────────────
  const porkAdoboRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Pork Adobo' } },
    update: { category: 'Main Course', servings: 4, prepTimeMinutes: 45, sellingPrice: 165, targetFoodCost: 38, isActive: true, menuItemId: porkAdoboMenu.id, instructions: 'Marinate pork in soy sauce and vinegar. Sauté garlic and onions, add pork, simmer until tender.' },
    create: { name: 'Pork Adobo', category: 'Main Course', servings: 4, prepTimeMinutes: 45, sellingPrice: 165, targetFoodCost: 38, isActive: true, menuItemId: porkAdoboMenu.id, instructions: 'Marinate pork in soy sauce and vinegar. Sauté garlic and onions, add pork, simmer until tender.', businessId: restaurantBusiness.id },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: porkAdoboRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: porkAdoboRecipe.id, itemId: restPorkBelly.id, quantity: 0.5, unit: 'kg', unitCost: 250, totalCost: 125 },
      { recipeId: porkAdoboRecipe.id, itemId: restSoySauce.id, quantity: 0.1, unit: 'L', unitCost: 85, totalCost: 8.5 },
      { recipeId: porkAdoboRecipe.id, itemId: restVinegar.id, quantity: 0.05, unit: 'L', unitCost: 65, totalCost: 3.25 },
      { recipeId: porkAdoboRecipe.id, itemId: restGarlic.id, quantity: 0.05, unit: 'kg', unitCost: 150, totalCost: 7.5 },
      { recipeId: porkAdoboRecipe.id, itemId: restOnions.id, quantity: 0.1, unit: 'kg', unitCost: 70, totalCost: 7 },
    ],
  });

  const sinigangRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Sinigang na Baboy' } },
    update: { category: 'Soups', servings: 4, prepTimeMinutes: 60, sellingPrice: 185, targetFoodCost: 40, isActive: true, menuItemId: sinigangMenu.id, instructions: 'Boil pork until tender. Add tamarind broth, tomatoes, and onions. Simmer and season.' },
    create: { name: 'Sinigang na Baboy', category: 'Soups', servings: 4, prepTimeMinutes: 60, sellingPrice: 185, targetFoodCost: 40, isActive: true, menuItemId: sinigangMenu.id, instructions: 'Boil pork until tender. Add tamarind broth, tomatoes, and onions. Simmer and season.', businessId: restaurantBusiness.id },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: sinigangRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: sinigangRecipe.id, itemId: restPorkBelly.id, quantity: 0.5, unit: 'kg', unitCost: 250, totalCost: 125 },
      { recipeId: sinigangRecipe.id, itemId: restTamarind.id, quantity: 0.1, unit: 'kg', unitCost: 120, totalCost: 12 },
      { recipeId: sinigangRecipe.id, itemId: restTomatoes.id, quantity: 0.2, unit: 'kg', unitCost: 60, totalCost: 12 },
      { recipeId: sinigangRecipe.id, itemId: restOnions.id, quantity: 0.1, unit: 'kg', unitCost: 70, totalCost: 7 },
    ],
  });

  const shrimpRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Garlic Butter Shrimp' } },
    update: { category: 'Main Course', servings: 2, prepTimeMinutes: 20, sellingPrice: 280, targetFoodCost: 42, isActive: true, menuItemId: shrimpMenu.id, instructions: 'Sauté garlic in butter. Add shrimp, toss until pink, season and serve.' },
    create: { name: 'Garlic Butter Shrimp', category: 'Main Course', servings: 2, prepTimeMinutes: 20, sellingPrice: 280, targetFoodCost: 42, isActive: true, menuItemId: shrimpMenu.id, instructions: 'Sauté garlic in butter. Add shrimp, toss until pink, season and serve.', businessId: restaurantBusiness.id },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: shrimpRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: shrimpRecipe.id, itemId: restShrimp.id, quantity: 0.3, unit: 'kg', unitCost: 380, totalCost: 114 },
      { recipeId: shrimpRecipe.id, itemId: restGarlic.id, quantity: 0.03, unit: 'kg', unitCost: 150, totalCost: 4.5 },
    ],
  });

  const lecheFlanRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Leche Flan' } },
    update: { category: 'Desserts', servings: 6, prepTimeMinutes: 90, sellingPrice: 95, targetFoodCost: 30, isActive: true, menuItemId: lecheFlanMenu.id, instructions: 'Caramelize sugar. Mix eggs and condensed milk, pour over caramel, steam until set.' },
    create: { name: 'Leche Flan', category: 'Desserts', servings: 6, prepTimeMinutes: 90, sellingPrice: 95, targetFoodCost: 30, isActive: true, menuItemId: lecheFlanMenu.id, instructions: 'Caramelize sugar. Mix eggs and condensed milk, pour over caramel, steam until set.', businessId: restaurantBusiness.id },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: lecheFlanRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: lecheFlanRecipe.id, itemId: restEggs.id, quantity: 8, unit: 'pcs', unitCost: 8, totalCost: 64 },
      { recipeId: lecheFlanRecipe.id, itemId: restCondensedMilk.id, quantity: 2, unit: 'cans', unitCost: 45, totalCost: 90 },
      { recipeId: lecheFlanRecipe.id, itemId: restSugar.id, quantity: 0.2, unit: 'kg', unitCost: 55, totalCost: 11 },
    ],
  });

  const icedTeaRecipe = await prisma.recipe.upsert({
    where: { businessId_name: { businessId: restaurantBusiness.id, name: 'Iced Tea' } },
    update: { category: 'Beverages', servings: 1, prepTimeMinutes: 2, sellingPrice: 55, targetFoodCost: 20, isActive: true, menuItemId: icedTeaMenu.id, instructions: 'Mix iced tea powder with cold water and sugar. Serve over ice.' },
    create: { name: 'Iced Tea', category: 'Beverages', servings: 1, prepTimeMinutes: 2, sellingPrice: 55, targetFoodCost: 20, isActive: true, menuItemId: icedTeaMenu.id, instructions: 'Mix iced tea powder with cold water and sugar. Serve over ice.', businessId: restaurantBusiness.id },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: icedTeaRecipe.id } });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: icedTeaRecipe.id, itemId: restIcedTeaMix.id, quantity: 0.025, unit: 'kg', unitCost: 180, totalCost: 4.5 },
      { recipeId: icedTeaRecipe.id, itemId: restSugar.id, quantity: 0.02, unit: 'kg', unitCost: 55, totalCost: 1.1 },
    ],
  });

  // ─── Restaurant-Only: Dining Tables ──────────────────────────────────────
  const tableData = [
    { number: 'T01', capacity: 2, status: 'AVAILABLE', floor: 'Ground Floor' },
    { number: 'T02', capacity: 4, status: 'OCCUPIED',  floor: 'Ground Floor' },
    { number: 'T03', capacity: 4, status: 'AVAILABLE', floor: 'Ground Floor' },
    { number: 'T04', capacity: 6, status: 'RESERVED',  floor: 'Ground Floor' },
    { number: 'T05', capacity: 2, status: 'AVAILABLE', floor: 'Ground Floor' },
    { number: 'T06', capacity: 4, status: 'OCCUPIED',  floor: 'Ground Floor' },
    { number: 'T07', capacity: 8, status: 'AVAILABLE', floor: '2nd Floor' },
    { number: 'T08', capacity: 4, status: 'CLEANING',  floor: '2nd Floor' },
    { number: 'T09', capacity: 2, status: 'AVAILABLE', floor: '2nd Floor' },
    { number: 'T10', capacity: 6, status: 'AVAILABLE', floor: '2nd Floor' },
  ];
  for (const t of tableData) {
    await prisma.diningTable.upsert({
      where: { businessId_locationId_tableNumber: { businessId: restaurantBusiness.id, locationId: diningArea.id, tableNumber: t.number } },
      update: { capacity: t.capacity, status: t.status as any, floor: t.floor },
      create: { tableNumber: t.number, capacity: t.capacity, status: t.status as any, floor: t.floor, locationId: diningArea.id, businessId: restaurantBusiness.id },
    });
  }

  // ─── Restaurant-Only: Suppliers ───────────────────────────────────────────
  const freshMarket = await prisma.supplier.upsert({
    where: { businessId_name_module: { businessId: restaurantBusiness.id, name: 'Fresh Market Suppliers', module: 'RESTAURANT' } },
    update: { contactPerson: 'Maria Santos', email: 'maria@freshmarket.ph', phone: '+63 917 000 1001', address: 'Divisoria, Manila', category: 'Vegetables & Seafood', isActive: true },
    create: { name: 'Fresh Market Suppliers', contactPerson: 'Maria Santos', email: 'maria@freshmarket.ph', phone: '+63 917 000 1001', address: 'Divisoria, Manila', category: 'Vegetables & Seafood', isActive: true, businessId: restaurantBusiness.id, module: 'RESTAURANT' },
  });

  const primeMeats = await prisma.supplier.upsert({
    where: { businessId_name_module: { businessId: restaurantBusiness.id, name: 'Prime Meats & Poultry', module: 'RESTAURANT' } },
    update: { contactPerson: 'Jose Reyes', email: 'jose@primemeats.ph', phone: '+63 917 000 1002', address: 'Commonwealth, Quezon City', category: 'Meat & Poultry', isActive: true },
    create: { name: 'Prime Meats & Poultry', contactPerson: 'Jose Reyes', email: 'jose@primemeats.ph', phone: '+63 917 000 1002', address: 'Commonwealth, Quezon City', category: 'Meat & Poultry', isActive: true, businessId: restaurantBusiness.id, module: 'RESTAURANT' },
  });

  const dryGoodsDepot = await prisma.supplier.upsert({
    where: { businessId_name_module: { businessId: restaurantBusiness.id, name: 'Dry Goods Depot', module: 'RESTAURANT' } },
    update: { contactPerson: 'Ana Cruz', email: 'ana@drygoodsdepot.ph', phone: '+63 917 000 1003', address: 'Binondo, Manila', category: 'Grains & Condiments', isActive: true },
    create: { name: 'Dry Goods Depot', contactPerson: 'Ana Cruz', email: 'ana@drygoodsdepot.ph', phone: '+63 917 000 1003', address: 'Binondo, Manila', category: 'Grains & Condiments', isActive: true, businessId: restaurantBusiness.id, module: 'RESTAURANT' },
  });

  // ─── Restaurant-Only: Purchase Orders ────────────────────────────────────
  const restAdmin = await prisma.user.findUnique({ where: { email: 'admin@restaurant.com' }, select: { id: true } });

  const po1 = await prisma.purchaseOrder.upsert({
    where: { businessId_orderNumber: { businessId: restaurantBusiness.id, orderNumber: 'PO-REST-001' } },
    update: { status: 'RECEIVED', supplierId: primeMeats.id, totalAmount: 6750, notes: 'Weekly meat restock', paymentMethod: 'Cash', paymentTerms: 'Net 7', expectedDelivery: new Date('2026-06-11T00:00:00.000Z') },
    create: { orderNumber: 'PO-REST-001', status: 'RECEIVED', supplierId: primeMeats.id, totalAmount: 6750, notes: 'Weekly meat restock', paymentMethod: 'Cash', paymentTerms: 'Net 7', expectedDelivery: new Date('2026-06-11T00:00:00.000Z'), businessId: restaurantBusiness.id, createdById: restAdmin?.id },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { purchaseOrderId: po1.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({
      data: [
        { purchaseOrderId: po1.id, inventoryItemId: restChicken.id, name: 'Chicken Breast', quantity: 20, receivedQty: 20, unitPrice: 185, totalPrice: 3700 },
        { purchaseOrderId: po1.id, inventoryItemId: restPorkBelly.id, name: 'Pork Belly', quantity: 12, receivedQty: 12, unitPrice: 250, totalPrice: 3000 },
      ],
    });
  }

  const po2 = await prisma.purchaseOrder.upsert({
    where: { businessId_orderNumber: { businessId: restaurantBusiness.id, orderNumber: 'PO-REST-002' } },
    update: { status: 'APPROVED', supplierId: freshMarket.id, totalAmount: 2500, notes: 'Fresh produce and seafood', paymentMethod: 'Bank Transfer', paymentTerms: 'COD', expectedDelivery: new Date('2026-06-14T00:00:00.000Z') },
    create: { orderNumber: 'PO-REST-002', status: 'APPROVED', supplierId: freshMarket.id, totalAmount: 2500, notes: 'Fresh produce and seafood', paymentMethod: 'Bank Transfer', paymentTerms: 'COD', expectedDelivery: new Date('2026-06-14T00:00:00.000Z'), businessId: restaurantBusiness.id, createdById: restAdmin?.id },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { purchaseOrderId: po2.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({
      data: [
        { purchaseOrderId: po2.id, inventoryItemId: restTomatoes.id, name: 'Tomatoes', quantity: 10, unitPrice: 60, totalPrice: 600 },
        { purchaseOrderId: po2.id, inventoryItemId: restShrimp.id, name: 'Tiger Shrimp', quantity: 5, unitPrice: 380, totalPrice: 1900 },
      ],
    });
  }

  const po3 = await prisma.purchaseOrder.upsert({
    where: { businessId_orderNumber: { businessId: restaurantBusiness.id, orderNumber: 'PO-REST-003' } },
    update: { status: 'DRAFT', supplierId: dryGoodsDepot.id, totalAmount: 2080, notes: 'Dry goods restock', paymentMethod: 'Cash', paymentTerms: 'Net 30', expectedDelivery: new Date('2026-06-20T00:00:00.000Z') },
    create: { orderNumber: 'PO-REST-003', status: 'DRAFT', supplierId: dryGoodsDepot.id, totalAmount: 2080, notes: 'Dry goods restock', paymentMethod: 'Cash', paymentTerms: 'Net 30', expectedDelivery: new Date('2026-06-20T00:00:00.000Z'), businessId: restaurantBusiness.id, createdById: restAdmin?.id },
  });
  if ((await prisma.purchaseOrderItem.count({ where: { purchaseOrderId: po3.id } })) === 0) {
    await prisma.purchaseOrderItem.createMany({
      data: [
        { purchaseOrderId: po3.id, inventoryItemId: restRice.id, name: 'White Rice', quantity: 25, unitPrice: 48, totalPrice: 1200 },
        { purchaseOrderId: po3.id, inventoryItemId: restSoySauce.id, name: 'Soy Sauce', quantity: 6, unitPrice: 85, totalPrice: 510 },
        { purchaseOrderId: po3.id, inventoryItemId: restVinegar.id, name: 'Vinegar', quantity: 4, unitPrice: 65, totalPrice: 260 },
        { purchaseOrderId: po3.id, inventoryItemId: restSugar.id, name: 'Sugar', quantity: 2, unitPrice: 55, totalPrice: 110 },
      ],
    });
  }

  // ─── Restaurant-Only: Kitchen Orders ─────────────────────────────────────
  const diningTables = await prisma.diningTable.findMany({ where: { businessId: restaurantBusiness.id }, orderBy: { tableNumber: 'asc' } });

  const koData = [
    { receiptNo: 'KO-REST-001', recipeId: chickenRiceRecipe.id,  quantity: 2, status: 'COMPLETED', tIdx: 0 },
    { receiptNo: 'KO-REST-002', recipeId: porkAdoboRecipe.id,    quantity: 1, status: 'COMPLETED', tIdx: 1 },
    { receiptNo: 'KO-REST-003', recipeId: sinigangRecipe.id,     quantity: 2, status: 'COMPLETED', tIdx: 2 },
    { receiptNo: 'KO-REST-004', recipeId: shrimpRecipe.id,       quantity: 1, status: 'READY',     tIdx: 3 },
    { receiptNo: 'KO-REST-005', recipeId: chickenRiceRecipe.id,  quantity: 3, status: 'PREPARING', tIdx: 4 },
    { receiptNo: 'KO-REST-006', recipeId: lecheFlanRecipe.id,    quantity: 4, status: 'PENDING',   tIdx: 5 },
    { receiptNo: 'KO-REST-007', recipeId: icedTeaRecipe.id,      quantity: 5, status: 'COMPLETED', tIdx: 6 },
    { receiptNo: 'KO-REST-008', recipeId: porkAdoboRecipe.id,    quantity: 2, status: 'COMPLETED', tIdx: 7 },
  ];

  for (const ko of koData) {
    await prisma.kitchenOrder.upsert({
      where: { businessId_receiptNo: { businessId: restaurantBusiness.id, receiptNo: ko.receiptNo } },
      update: { status: ko.status as any, quantity: ko.quantity },
      create: { receiptNo: ko.receiptNo, recipeId: ko.recipeId, quantity: ko.quantity, status: ko.status as any, tableId: diningTables[ko.tIdx]?.id ?? null, locationId: restKitchen.id, businessId: restaurantBusiness.id, completedById: restAdmin?.id },
    });
  }

  // ─── Restaurant-Only: Sales ───────────────────────────────────────────────
  const salesData = [
    { txNo: 'TXN-REST-001', items: [{ item: chickenRiceMenu, qty: 2, price: 150 }, { item: icedTeaMenu, qty: 2, price: 55 }], method: 'Cash' },
    { txNo: 'TXN-REST-002', items: [{ item: porkAdoboMenu,   qty: 1, price: 165 }, { item: icedTeaMenu, qty: 1, price: 55 }], method: 'GCash' },
    { txNo: 'TXN-REST-003', items: [{ item: sinigangMenu,    qty: 2, price: 185 }, { item: icedTeaMenu, qty: 3, price: 55 }], method: 'Cash' },
    { txNo: 'TXN-REST-004', items: [{ item: shrimpMenu,      qty: 1, price: 280 }, { item: lecheFlanMenu, qty: 2, price: 95 }], method: 'Card' },
    { txNo: 'TXN-REST-005', items: [{ item: porkAdoboMenu,   qty: 2, price: 165 }, { item: sinigangMenu, qty: 1, price: 185 }], method: 'Cash' },
    { txNo: 'TXN-REST-006', items: [{ item: chickenRiceMenu, qty: 3, price: 150 }, { item: lecheFlanMenu, qty: 1, price: 95 }], method: 'GCash' },
  ];

  for (const sd of salesData) {
    const exists = await prisma.sale.findUnique({ where: { businessId_transactionNumber: { businessId: restaurantBusiness.id, transactionNumber: sd.txNo } } });
    if (!exists) {
      const subtotal = sd.items.reduce((sum, it) => sum + it.qty * it.price, 0);
      await prisma.sale.create({
        data: {
          transactionNumber: sd.txNo,
          locationId: diningArea.id,
          cashierId: restAdmin?.id ?? null,
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          paymentMethod: sd.method,
          amountPaid: subtotal,
          change: 0,
          status: 'COMPLETED',
          businessId: restaurantBusiness.id,
          items: {
            create: sd.items.map(it => ({
              inventoryItemId: it.item.id,
              name: it.item.name,
              quantity: it.qty,
              unitPrice: it.price,
              totalPrice: it.qty * it.price,
            })),
          },
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
