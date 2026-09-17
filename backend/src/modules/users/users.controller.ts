import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
@Roles(Role.RRHH)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Query('role') role?: string,
    @Query('branchId') branchId?: string,
    @Query('active') active?: string,
    @Query('evaluable') evaluable?: string,
  ) {
    return this.usersService.list({ role, branchId, active, evaluable });
  }

  @Get('bosses')
  bosses() {
    return this.usersService.bosses();
  }

  /**
   * Empleados a los que el usuario actual puede asignar objetivos
   * (selector en la pantalla de Objetivos): RRHH/Dueño ven toda la operación;
   * el Jefe solo a sus subordinados directos.
   */
  @Get('assignable')
  @Roles(Role.JEFE, Role.RRHH, Role.DUENO)
  assignable(@CurrentUser() user: AuthUser) {
    return this.usersService.assignable(user);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }
}
