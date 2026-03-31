import { Controller, Post, Body } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@Controller('pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Post('calculate')
  calculate(@Body() dto: CalculatePriceDto) {
    return this.service.calculate(dto);
  }
}
