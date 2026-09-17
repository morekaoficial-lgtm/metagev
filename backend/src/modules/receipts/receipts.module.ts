import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { PdfService } from './pdf.service';

@Module({
  controllers: [ReceiptsController],
  providers: [ReceiptsService, PdfService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
