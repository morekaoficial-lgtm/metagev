import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
@Roles(Role.RRHH)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  list(@Query('periodId') periodId?: string) {
    return this.receiptsService.list(periodId);
  }

  @Get('results')
  results(@Query('periodId') periodId: string) {
    return this.receiptsService.listResults(periodId);
  }

  @Post('period/:periodId/generate-all')
  generateAll(@Param('periodId', ParseUUIDPipe) periodId: string) {
    return this.receiptsService.generateAllForPeriod(periodId);
  }

  @Post('result/:resultId/generate')
  generate(@Param('resultId', ParseUUIDPipe) resultId: string) {
    return this.receiptsService.generateForResult(resultId);
  }

  @Get('batch/:fileName/download')
  async downloadBatch(@Param('fileName') fileName: string, @Res() res: Response) {
    const batch = await this.receiptsService.downloadBatch(fileName);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    return res.download(batch.path, batch.name);
  }

  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const receipt = await this.receiptsService.download(id);
    if (!receipt) throw new NotFoundException('Recibo no encontrado');
    return res.download(receipt.pdfPath, `${receipt.folio}.pdf`);
  }
}
