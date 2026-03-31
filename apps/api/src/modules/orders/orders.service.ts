import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CartItemData {
  productId: string;
  colorId: string;
  sides: unknown;
  quantity: number;
  designData: unknown;
  lockedPrice: number;
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrderFromCart(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.items.length === 0) throw new NotFoundException('Cart is empty');

    let total = 0;
    cart.items.forEach((item: CartItemData) => {
      total += item.lockedPrice;
    });

    const order = await this.prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        totalAmount: total,
        items: {
          create: cart.items.map((item: CartItemData) => ({
            productId: item.productId,
            colorId: item.colorId,
            sides: item.sides as object,
            quantity: item.quantity,
            designData: item.designData as object,
            lockedPrice: item.lockedPrice,
          })),
        },
      },
      include: { items: true },
    });

    // Clean up the cart after order creation
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    await this.prisma.cart.delete({ where: { id: cartId } });

    return order;
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getAllOrders() {
    return this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(orderId: string, status: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as any },
      include: { items: true },
    });
  }
}
