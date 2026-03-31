import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { CustomizationModule } from './modules/customization/customization.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AdminProductsModule } from './modules/admin-products/admin-products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductionModule } from './modules/production/production.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'uploads'),
        serveRoot: '/uploads',
      },
      {
        rootPath: join(__dirname, '..', 'public'),
        serveRoot: '/',
        exclude: ['/api/(.*)', '/uploads/(.*)', '/designs/(.*)', '/admin/(.*)', '/pricing/(.*)', '/cart/(.*)', '/orders/(.*)', '/production/(.*)', '/api/health'],
      },
    ),
    PrismaModule,
    CustomizationModule,
    PricingModule,
    AdminProductsModule,
    CartModule,
    OrdersModule,
    ProductionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
