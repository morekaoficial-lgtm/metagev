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
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ImportanceLevelsService } from './importance-levels.service';
import { CreateImportanceLevelDto, UpdateImportanceLevelDto } from './dto/importance-level.dto';

@Controller('importance-levels')
export class ImportanceLevelsController {
  constructor(private readonly service: ImportanceLevelsService) {}

  @Get()
  list(@Query('all') all?: string) {
    return this.service.list(all === 'true');
  }

  @Post()
  @Roles(Role.RRHH)
  create(@Body() dto: CreateImportanceLevelDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.RRHH)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateImportanceLevelDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.RRHH)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
