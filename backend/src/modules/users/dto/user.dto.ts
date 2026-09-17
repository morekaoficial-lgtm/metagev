import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password?: string;

  @IsIn(['RRHH', 'JEFE', 'COLABORADOR', 'DUENO'])
  role: 'RRHH' | 'JEFE' | 'COLABORADOR' | 'DUENO';

  @IsOptional()
  @IsUUID()
  directBossId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  officialPosition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gratificationMaxMonthly?: number;

  @IsOptional()
  programStartDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsIn(['RRHH', 'JEFE', 'COLABORADOR', 'DUENO'])
  role?: 'RRHH' | 'JEFE' | 'COLABORADOR' | 'DUENO';

  @IsOptional()
  @IsUUID()
  directBossId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  officialPosition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gratificationMaxMonthly?: number;

  @IsOptional()
  programStartDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
