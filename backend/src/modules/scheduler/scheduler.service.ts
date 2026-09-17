import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CloseReason, PeriodStatus, Prisma, SelfEvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { prorationFactor, round2 } from '../../common/business/calculation';
import { ReceiptsService } from '../receipts/receipts.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Auto-cierre diario 00:05 (America/Mexico_City).
 * - Día 7 del mes siguiente al periodo: recordatorio (3 días para cierre).
 * - Día 11: colaboradores activos con evaluación PENDING/IN_PROGRESS → AUTO_CLOSED al 0%,
 *   con recibo generado y vista bloqueada. Los enviados sin validar quedan PENDING en bandeja.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptsService: ReceiptsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('5 0 * * *', { timeZone: 'America/Mexico_City' })
  async dailyAutoClose() {
    this.logger.log('Ejecutando revisión diaria de auto-cierre...');
    const periods = await this.prisma.evaluationPeriod.findMany({
      where: { status: { in: [PeriodStatus.ACTIVE, PeriodStatus.CLOSED, PeriodStatus.AUTO_CLOSED] } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const period of periods) {
      // Mes siguiente al periodo (period.month es 1-based).
      const reminderDate = new Date(period.year, period.month, 7);
      const closeDate = new Date(period.year, period.month, 11);

      if (this.sameDay(today, reminderDate)) {
        await this.sendReminders(period.id);
      }
      if (this.sameDay(today, closeDate) && period.status === PeriodStatus.ACTIVE) {
        await this.autoClose(period.id);
      }
    }
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private async sendReminders(periodId: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period) return;
    const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;

    const employees = await this.activeEligibleEmployees(period);
    for (const employee of employees) {
      const selfEvaluation = await this.prisma.selfEvaluation.findUnique({
        where: { periodId_employeeId: { periodId, employeeId: employee.id } },
      });
      const pending =
        !selfEvaluation ||
        selfEvaluation.status === SelfEvaluationStatus.PENDING ||
        selfEvaluation.status === SelfEvaluationStatus.IN_PROGRESS;
      if (pending) {
        await this.notificationsService.sendReminder(
          employee.email,
          employee.fullName,
          periodLabel,
          3,
        );
      }
    }
    this.logger.log(`Recordatorios enviados para el periodo ${periodLabel}`);
  }

  private async autoClose(periodId: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.status !== PeriodStatus.ACTIVE) return;
    const periodLabel = `${period.year}-${String(period.month).padStart(2, '0')}`;

    const employees = await this.activeEligibleEmployees(period);
    let closed = 0;

    for (const employee of employees) {
      const existing = await this.prisma.evaluationResult.findUnique({
        where: { periodId_employeeId: { periodId, employeeId: employee.id } },
      });
      if (existing) continue;

      const selfEvaluation = await this.prisma.selfEvaluation.findUnique({
        where: { periodId_employeeId: { periodId, employeeId: employee.id } },
        include: { items: true },
      });
      const isPending =
        !selfEvaluation ||
        selfEvaluation.status === SelfEvaluationStatus.PENDING ||
        selfEvaluation.status === SelfEvaluationStatus.IN_PROGRESS;

      if (!isPending) continue; // SUBMITTED sin validar: queda PENDING en bandeja de validación.

      const profile = await this.prisma.employeeProfile.findUnique({
        where: { userId: employee.id },
      });
      if (!profile) continue;

      const factor = prorationFactor(profile.programStartDate, period.year, period.month);
      const proratedMax = round2(Number(profile.gratificationMaxMonthly) * factor);

      const result = await this.prisma.evaluationResult.create({
        data: {
          periodId,
          employeeId: employee.id,
          employeeVersion:
            (selfEvaluation?.items.map((i) => ({
              objectiveId: i.objectiveId,
              scale: i.scale,
              percent: i.percent,
            })) as unknown as Prisma.InputJsonValue) ?? [],
          validatorVersion: [],
          totalPointsEarned: 0,
          prorationFactor: factor,
          proratedMax,
          finalAmount: 0,
          closeReason: CloseReason.AUTO_CLOSED,
        },
      });

      const receipt = await this.receiptsService.generateForResult(result.id);
      await this.notificationsService.sendReceiptReady(employee.email, employee.fullName, receipt.folio);
      closed += 1;
    }

    await this.prisma.evaluationPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.AUTO_CLOSED },
    });
    this.logger.log(`Auto-cierre completado para ${periodLabel}: ${closed} colaborador(es) al 0%.`);
  }

  /** Empleados activos y elegibles (rol evaluable + alta al programa a más tardar el último día del periodo). */
  private async activeEligibleEmployees(period: { id: string; year: number; month: number }) {
    const periodEnd = new Date(period.year, period.month, 0); // último día del periodo
    return this.prisma.user.findMany({
      where: {
        role: { in: ['COLABORADOR', 'JEFE', 'RRHH'] },
        isActive: true,
        profile: { programStartDate: { lte: periodEnd } },
      },
      select: { id: true, fullName: true, email: true },
    });
  }
}
