import { IsString, IsNotEmpty } from 'class-validator';

export class AddColorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  hexCode: string;
}
