import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrintSide } from '@prisma/client';

export class AddDesignSideDto {
  @IsEnum(PrintSide)
  @IsNotEmpty()
  side: PrintSide;

  @IsInt()
  canvasWidth: number;

  @IsInt()
  canvasHeight: number;

  @IsNotEmpty()
  jsonData: any;

  @IsOptional()
  @IsString()
  previewImageBase64?: string;

  @IsOptional()
  @IsInt()
  dpi?: number;
}
