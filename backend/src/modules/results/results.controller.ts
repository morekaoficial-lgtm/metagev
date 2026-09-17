import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ResultsService } from './results.service';

@Controller('results')
@Roles(Role.COLABORADOR, Role.JEFE, Role.RRHH)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('my-current')
  myCurrent(@CurrentUser() user: AuthUser) {
    return this.resultsService.myCurrent(user.id);
  }
}
