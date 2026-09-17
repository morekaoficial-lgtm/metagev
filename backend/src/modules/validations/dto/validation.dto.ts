import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ValidationItemDto {
  @IsUUID()
  objectiveId: string;

  @IsIn(['EXCELENTE', 'BUENO', 'REGULAR', 'NO_CUMPLIDO'])
  scale: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NO_CUMPLIDO';
}

export class DecideValidationDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ValidationItemDto)
  items: ValidationItemDto[];

  @IsOptional()
  @IsString()
  justification?: string;
}
