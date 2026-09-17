import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveItemDto {
  @IsIn(['EXCELENTE', 'BUENO', 'REGULAR', 'NO_CUMPLIDO'])
  scale: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NO_CUMPLIDO';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
