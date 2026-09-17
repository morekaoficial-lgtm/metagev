import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ValidationsService } from './validations.service';
import { DecideValidationDto } from './dto/validation.dto';

@Controller('validations')
@Roles(Role.JEFE, Role.RRHH, Role.DUENO)
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Get('pending')
  pending(@CurrentUser() user: AuthUser) {
    return this.validationsService.pending(user);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.validationsService.detail(id);
  }

  @Post(':id/decide')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideValidationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.validationsService.decide(id, { id: user.id, role: user.role }, dto);
  }
}
