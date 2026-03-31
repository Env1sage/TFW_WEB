import { IsString, IsNumber, IsEnum, Min, IsInt } from 'class-validator';

enum PrintSide {
  FRONT = 'FRONT',
  BACK = 'BACK',
  LEFT_SLEEVE = 'LEFT_SLEEVE',
  RIGHT_SLEEVE = 'RIGHT_SLEEVE',
}

export class AddPrintAreaDto {
  @IsEnum(PrintSide)
  side: string;

  @IsInt()
  @Min(1)
  width: number;

  @IsInt()
  @Min(1)
  height: number;

  @IsInt()
  @Min(0)
  xPosition: number;

  @IsInt()
  @Min(0)
  yPosition: number;

  @IsInt()
  @Min(0)
  safeZone: number;

  @IsInt()
  @Min(0)
  bleed: number;

  @IsNumber()
  @Min(0)
  additionalPrice: number;

  @IsNumber()
  @Min(0.1)
  realWidthInches: number;

  @IsNumber()
  @Min(0.1)
  realHeightInches: number;
}
