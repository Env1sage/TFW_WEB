import { IsString, IsNotEmpty, IsArray, IsNumber, Min, ArrayMinSize, IsObject } from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  colorId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  sides: string[];

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsObject()
  designData: Record<string, unknown>;
}
