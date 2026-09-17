import { Module } from '@nestjs/common';
import { ImportanceLevelsService } from './importance-levels.service';
import { ImportanceLevelsController } from './importance-levels.controller';

@Module({
  controllers: [ImportanceLevelsController],
  providers: [ImportanceLevelsService],
  exports: [ImportanceLevelsService],
})
export class ImportanceLevelsModule {}
