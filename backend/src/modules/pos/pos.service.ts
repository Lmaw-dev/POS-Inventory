import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';

@Injectable()
export class PosService {
  constructor(private readonly databaseService: DatabaseService) {}

  getMenu(userId: number) {
    return this.databaseService.listPosProducts(userId);
  }

  getProductRecipe(input: { userId: number; productId: number }) {
    return this.databaseService.getPosProductRecipe(input);
  }

  createOrder(input: any) {
    return this.databaseService.createPaidPosOrder(input);
  }
}
