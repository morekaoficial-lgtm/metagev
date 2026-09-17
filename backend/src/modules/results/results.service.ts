import { Injectable } from '@nestjs/common';
import { PeriodStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resumen del periodo en curso para el colaborador autenticado. */
  async myCurrent(employeeId: string) {
    const period = await this.prisma.evaluationPeriod.findFirst({
      where: { status: { in: [PeriodStatus.ACTIVE, PeriodStatus.CLOSED, PeriodStatus.AUTO_CLOSED] } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    if (!period) return { period: null };

    const result = await this.prisma.evaluationResult.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
      include: { receipt: true },
    });

    const selfEvaluation = await this.prisma.selfEvaluation.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
    });

    const closeDate = new Date(period.year, period.month, 11);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToClose = Math.max(0, Math.ceil((closeDate.getTime() - today.getTime()) / 86400000));

    return {
      period: { id: period.id, year: period.year, month: period.month, status: period.status },
      result,
      selfEvaluationStatus: selfEvaluation?.status ?? null,
      daysToClose,
    };
  }
}
