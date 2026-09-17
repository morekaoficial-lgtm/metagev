import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreatePeriodDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
