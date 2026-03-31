import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Post('add')
  add(@Body() dto: AddToCartDto) {
    return this.service.addToCart(dto);
  }

  @Get(':cartId')
  getCart(@Param('cartId') cartId: string) {
    return this.service.getCart(cartId);
  }
}
