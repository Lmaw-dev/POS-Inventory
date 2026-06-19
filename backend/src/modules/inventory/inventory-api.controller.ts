import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { InventoryApiService } from './inventory-api.service';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

@Controller('api')
export class InventoryApiController {
  constructor(private readonly inventoryApiService: InventoryApiService) {}

  @Get()
  health() {
    return { message: 'Unified POS + Inventory API' };
  }

  @Get('auth/me')
  getCurrentUser(@Req() request: RequestLike) {
    return this.inventoryApiService.getCurrentUser(request.headers);
  }

  @Post('auth/logout')
  logout() {
    return { message: 'Logged out' };
  }

  @Get('inventory')
  listInventory(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listInventory(request.headers, query);
  }

  @Post('inventory')
  createInventoryItem(@Req() request: RequestLike, @Body() body: Record<string, unknown>) {
    return this.inventoryApiService.createInventoryItem(request.headers, body);
  }

  @Patch('inventory/:id')
  updateInventoryItem(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryApiService.updateInventoryItem(id, body);
  }

  @Delete('inventory/:id')
  deleteInventoryItem(@Param('id') id: string) {
    return this.inventoryApiService.deleteById('InventoryItem', id);
  }

  @Get('locations')
  listLocations(@Req() request: RequestLike) {
    return this.inventoryApiService.listLocations(request.headers);
  }

  @Get('categories')
  listCategories(@Req() request: RequestLike, @Query('module') module?: string) {
    return this.inventoryApiService.listCategories(request.headers, module);
  }

  @Post('categories')
  createCategory(@Req() request: RequestLike, @Body() body: Record<string, unknown>) {
    return this.inventoryApiService.createCategory(request.headers, body);
  }

  @Get('users')
  listUsers(@Req() request: RequestLike) {
    return this.inventoryApiService.listUsers(request.headers);
  }

  @Get('recipes')
  listRecipes(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listRecipes(request.headers, query);
  }

  @Post('recipes')
  createRecipe(@Req() request: RequestLike, @Body() body: Record<string, unknown>) {
    return this.inventoryApiService.createRecipe(request.headers, body);
  }

  @Patch('recipes/:id')
  updateRecipe(
    @Req() request: RequestLike,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.inventoryApiService.updateRecipe(request.headers, id, body);
  }

  @Delete('recipes/:id')
  deleteRecipe(@Req() request: RequestLike, @Param('id') id: string) {
    return this.inventoryApiService.deleteRecipe(request.headers, id);
  }

  @Get('kitchen-orders')
  listKitchenOrders(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listKitchenOrders(request.headers, query);
  }

  @Get('suppliers')
  listSuppliers(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listSuppliers(request.headers, query);
  }

  @Get('purchase-orders')
  listPurchaseOrders(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listPurchaseOrders(request.headers, query);
  }

  @Get('purchase-orders/goods-receipts')
  listGoodsReceipts(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listGoodsReceipts(request.headers, query);
  }

  @Get('transfers')
  listTransfers(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listTransfers(request.headers, query);
  }

  @Get('sales')
  listSales(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listSales(request.headers, query);
  }

  @Get('stock-movements')
  listStockMovements(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listStockMovements(request.headers, query);
  }

  @Post('stock-movements')
  createStockMovement(@Req() request: RequestLike, @Body() body: Record<string, unknown>) {
    return this.inventoryApiService.createStockMovement(request.headers, body);
  }

  @Get('bundles')
  listBundles(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listBundles(request.headers, query);
  }

  @Get('adjustments')
  listAdjustments(@Req() request: RequestLike, @Query() query: Record<string, string | undefined>) {
    return this.inventoryApiService.listAdjustments(request.headers, query);
  }

  @Get('restaurant-settings')
  listRestaurantSettings(@Req() request: RequestLike) {
    return this.inventoryApiService.listRestaurantSettings(request.headers);
  }

  @Put('restaurant-settings/:key')
  upsertRestaurantSetting(
    @Req() request: RequestLike,
    @Param('key') key: string,
    @Body() body: { value?: unknown },
  ) {
    return this.inventoryApiService.upsertRestaurantSetting(request.headers, key, body.value);
  }
}
