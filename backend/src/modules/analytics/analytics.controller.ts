import { Controller, Get, Header, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@Roles(Role.RRHH)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('heatmap')
  heatmap(@Query('periodId') periodId: string) {
    return this.analyticsService.heatmap(periodId);
  }

  @Get('leaderboard')
  leaderboard(
    @Query('bossId') bossId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.leaderboard({ bossId, branchId, from, to });
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="evaluacion-periodo.csv"')
  async exportCsv(@Query('periodId') periodId: string): Promise<string> {
    return this.analyticsService.exportCsv(periodId);
  }
}
