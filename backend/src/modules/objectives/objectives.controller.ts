import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ObjectivesService } from './objectives.service';
import {
  CreateObjectiveDto,
  DuplicateObjectivesDto,
  RecalculateObjectivesDto,
  UpdateObjectiveDto,
} from './dto/objective.dto';

@Controller('objectives')
@Roles(Role.RRHH)
export class ObjectivesController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @Get()
  list(
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.objectivesService.list(periodId, employeeId);
  }

  @Get('audit')
  audit(
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.objectivesService.audit(periodId, employeeId);
  }

  @Post()
  create(@Body() dto: CreateObjectiveDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObjectiveDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.objectivesService.remove(id, user.id);
  }

  @Post('duplicate-from-last-month')
  duplicate(@Body() dto: DuplicateObjectivesDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.duplicateFromLastMonth(dto, user.id);
  }

  @Post('recalculate')
  recalculate(
    @Body() dto: RecalculateObjectivesDto,
  ) {
    return this.objectivesService.recalculate(dto.periodId, dto.employeeId);
  }
}
