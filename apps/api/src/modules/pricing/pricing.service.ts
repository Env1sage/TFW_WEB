import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async calculate(dto: CalculatePriceDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { printAreas: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    const base = product.basePrice;

    let sideTotal = 0;
    for (const side of dto.sides) {
      const area = product.printAreas.find((p: { side: string }) => p.side === side);
      if (area) {
        sideTotal += area.additionalPrice;
      }
    }

    const subtotal = (base + sideTotal) * dto.quantity;

    // Quantity discount tiers
    let discount = 0;
    if (dto.quantity >= 6 && dto.quantity <= 20) {
      discount = 0.05;
    } else if (dto.quantity >= 21 && dto.quantity <= 50) {
      discount = 0.1;
    } else if (dto.quantity > 50) {
      discount = 0.15;
    }

    const finalPrice = subtotal - subtotal * discount;

    return {
      basePrice: base,
      sideTotal,
      quantity: dto.quantity,
      subtotal,
      discountPercentage: discount * 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
    };
  }
}
