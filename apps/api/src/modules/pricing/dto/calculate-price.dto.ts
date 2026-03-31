import { IsNotEmpty, IsString, IsArray, IsNumber, Min, ArrayMinSize } from 'class-validator';

export class CalculatePriceDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sides: string[];

  @IsNumber()
  @Min(1)
  quantity: number;
}
