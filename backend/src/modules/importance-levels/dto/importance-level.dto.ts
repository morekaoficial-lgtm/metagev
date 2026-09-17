import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateImportanceLevelDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  label: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  relativeWeight: number;

  @IsHexColor()
  colorHex: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateImportanceLevelDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  relativeWeight?: number;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
