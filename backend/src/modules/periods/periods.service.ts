import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePeriodDto } from './dto/period.dto';

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.evaluationPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { objectives: true, selfEvaluations: true, results: true } },
      },
    });
  }

  async create(dto: CreatePeriodDto) {
    const existing = await this.prisma.evaluationPeriod.findUnique({
      where: { year_month: { year: dto.year, month: dto.month } },
    });
    if (existing) throw new BadRequestException('El periodo ya existe');
    return this.prisma.evaluationPeriod.create({
      data: { year: dto.year, month: dto.month, status: PeriodStatus.DRAFT },
    });
  }

  async activate(id: string) {
    const period = await this.findOrFail(id);
    if (period.status !== PeriodStatus.DRAFT) {
      throw new BadRequestException('Solo se puede activar un periodo en borrador');
    }
    // Solo puede haber un periodo activo: los activos previos se cierran.
    await this.prisma.evaluationPeriod.updateMany({
      where: { status: PeriodStatus.ACTIVE },
      data: { status: PeriodStatus.CLOSED },
    });
    return this.prisma.evaluationPeriod.update({
      where: { id },
      data: { status: PeriodStatus.ACTIVE },
    });
  }

  async close(id: string) {
    const period = await this.findOrFail(id);
    if (period.status !== PeriodStatus.ACTIVE) {
      throw new BadRequestException('Solo se puede cerrar un periodo activo');
    }
    return this.prisma.evaluationPeriod.update({
      where: { id },
      data: { status: PeriodStatus.CLOSED },
    });
  }

  async findActive() {
    return this.prisma.evaluationPeriod.findFirst({
      where: { status: PeriodStatus.ACTIVE },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  private async findOrFail(id: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    return period;
  }
}
