import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PosService } from './pos.service';

@Controller()
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('pos/menu')
  getMenu(@Query('user_id') userId: string) {
    return this.posService.getMenu(Number(userId));
  }

  @Get('products/:id/recipe')
  getProductRecipe(@Param('id') id: string, @Query('user_id') userId: string) {
    return this.posService.getProductRecipe({
      userId: Number(userId),
      productId: Number(id),
    });
  }

  @Post('pos/orders')
  createOrder(@Body() body: any) {
    return this.posService.createOrder({
      ...body,
      userId: Number(body.user_id),
    });
  }
}
