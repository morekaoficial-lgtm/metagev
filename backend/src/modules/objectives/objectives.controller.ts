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
@Roles(Role.RRHH, Role.JEFE, Role.DUENO)
export class ObjectivesController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @Get()
  list(
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.objectivesService.list(periodId, employeeId, user);
  }

  @Get('audit')
  audit(
    @Query('periodId', ParseUUIDPipe) periodId: string,
    @Query('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.objectivesService.audit(periodId, employeeId, user);
  }

  @Post()
  create(@Body() dto: CreateObjectiveDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObjectiveDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.objectivesService.remove(id, user);
  }

  @Post('duplicate-from-last-month')
  duplicate(@Body() dto: DuplicateObjectivesDto, @CurrentUser() user: AuthUser) {
    return this.objectivesService.duplicateFromLastMonth(dto, user);
  }

  @Post('recalculate')
  recalculate(
    @Body() dto: RecalculateObjectivesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.objectivesService.recalculate(dto.periodId, dto.employeeId, user);
  }
}
