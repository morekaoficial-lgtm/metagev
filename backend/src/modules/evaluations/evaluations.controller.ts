import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { EvaluationsService } from './evaluations.service';
import { SaveItemDto } from './dto/evaluation.dto';

@Controller('evaluations')
@Roles(Role.COLABORADOR, Role.JEFE, Role.RRHH)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('my-current')
  myCurrent(
    @CurrentUser() user: AuthUser,
    @Query('periodId') periodId?: string,
  ) {
    return this.evaluationsService.myCurrent(user.id, periodId);
  }

  @Put('my-current/items/:objectiveId')
  saveItem(
    @CurrentUser() user: AuthUser,
    @Param('objectiveId', ParseUUIDPipe) objectiveId: string,
    @Body() dto: SaveItemDto,
  ) {
    return this.evaluationsService.saveDraftItem(user.id, objectiveId, dto);
  }

  @Post('my-current/submit')
  submit(@CurrentUser() user: AuthUser, @Body() dto: { periodId: string }) {
    return this.evaluationsService.submit(user.id, dto.periodId);
  }

  /** Histórico anual de cumplimiento (porcentajes y posición en plantilla, sin dinero). */
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    const parsed = year ? Number(year) : undefined;
    return this.evaluationsService.history(user.id, Number.isFinite(parsed) ? parsed : undefined);
  }

  /** Detalle mensual: objetivos con la calificación recibida (agrupable por escala). */
  @Get('team-history')
  @Roles(Role.JEFE, Role.RRHH, Role.DUENO)
  teamHistory(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    const parsed = Number(year);
    return this.evaluationsService.teamHistory(user, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Get('history/:year/:month')
  historyDetail(
    @CurrentUser() user: AuthUser,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.evaluationsService.historyDetail(user.id, Number(year), Number(month));
  }
}
