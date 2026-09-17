import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateObjectiveDto {
  @IsUUID()
  periodId: string;

  @IsUUID()
  employeeId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  metric?: string;

  @IsUUID()
  importanceLevelId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  relativeWeight: number;
}

export class UpdateObjectiveDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  metric?: string;

  @IsOptional()
  @IsUUID()
  importanceLevelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  relativeWeight?: number;
}

export class DuplicateObjectivesDto {
  @IsUUID()
  periodId: string;

  @IsUUID()
  employeeId: string;
}

export class RecalculateObjectivesDto {
  @IsUUID()
  periodId: string;

  @IsUUID()
  employeeId: string;
}
