import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './shared/database/database.module';
import { SuperadminModule } from './modules/users/superadmin/superadmin.module';
import { AdminModule } from './modules/users/admin/admin.module';
import { InventoryApiModule } from './modules/inventory/inventory-api.module';
import { PosModule } from './modules/pos/pos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    SuperadminModule,
    AdminModule,
    PosModule,
    InventoryApiModule,
  ],
})
export class AppModule {}
