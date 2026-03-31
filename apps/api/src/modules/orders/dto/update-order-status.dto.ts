import { IsString, IsEnum } from 'class-validator';

enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  IN_PRODUCTION = 'IN_PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: string;
}
