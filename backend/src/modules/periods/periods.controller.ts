import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/period.dto';

@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  list() {
    return this.periodsService.list();
  }

  @Post()
  @Roles(Role.RRHH)
  create(@Body() dto: CreatePeriodDto) {
    return this.periodsService.create(dto);
  }

  @Post(':id/activate')
  @Roles(Role.RRHH)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.activate(id);
  }

  @Post(':id/close')
  @Roles(Role.RRHH)
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.close(id);
  }
}
