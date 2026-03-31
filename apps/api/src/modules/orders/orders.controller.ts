import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  createFromCart(@Body() dto: CreateOrderDto) {
    return this.service.createOrderFromCart(dto.cartId);
  }

  @Get()
  getAll() {
    return this.service.getAllOrders();
  }

  @Get(':orderId')
  getOrder(@Param('orderId') orderId: string) {
    return this.service.getOrder(orderId);
  }

  @Patch(':orderId/status')
  updateStatus(@Param('orderId') orderId: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(orderId, dto.status);
  }
}
