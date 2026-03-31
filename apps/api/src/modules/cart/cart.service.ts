import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private pricingService: PricingService,
  ) {}

  async addToCart(dto: AddToCartDto) {
    // Backend recalculates price — never trust frontend
    const pricing = await this.pricingService.calculate({
      productId: dto.productId,
      sides: dto.sides,
      quantity: dto.quantity,
    });

    const cart = await this.prisma.cart.create({
      data: {
        items: {
          create: {
            productId: dto.productId,
            colorId: dto.colorId,
            sides: dto.sides,
            quantity: dto.quantity,
            designData: dto.designData as any,
            lockedPrice: pricing.finalPrice,
          },
        },
      },
      include: { items: true },
    });

    return cart;
  }

  async getCart(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }
}
