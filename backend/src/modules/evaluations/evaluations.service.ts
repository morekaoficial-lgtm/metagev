import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EvaluationPeriod, PeriodStatus, SelfEvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SCALE_PERCENT, prorationFactor, round2 } from '../../common/business/calculation';
import { SaveItemDto } from './dto/evaluation.dto';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * La evaluación del colaborador. Si se pasa periodId se muestra ese periodo
   * (debe estar ACTIVE); si no, el periodo activo más reciente. Además devuelve
   * `pendingPeriods`: otros periodos activos con objetivos asignados pendientes
   * de evaluar (para poder sacar evaluaciones de meses anteriores).
   */
  async myCurrent(employeeId: string, periodId?: string) {
    let period: EvaluationPeriod | null = null;
    if (periodId) {
      period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new NotFoundException('Periodo no encontrado');
    } else {
      period = await this.prisma.evaluationPeriod.findFirst({
        where: { status: PeriodStatus.ACTIVE },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      // Sin activos: mostrar el más reciente (solo lectura) para que vea su evaluación enviada.
      period ??= await this.prisma.evaluationPeriod.findFirst({
        where: { status: { in: [PeriodStatus.CLOSED, PeriodStatus.AUTO_CLOSED] } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    }
    if (!period) return { period: null };

    const objectives = await this.prisma.objective.findMany({
      where: { periodId: period.id, employeeId },
      orderBy: { createdAt: 'asc' },
      include: { importanceLevel: true },
    });

    const selfEvaluation = await this.prisma.selfEvaluation.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
      include: { items: true },
    });

    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeId },
      include: { branch: true },
    });

    const result = await this.prisma.evaluationResult.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
    });

    const projected = this.projectedAmount(objectives, selfEvaluation, profile, period, result);

    // Otros periodos activos con objetivos asignados (evaluaciones pendientes de meses anteriores).
    const activePeriods = await this.prisma.evaluationPeriod.findMany({
      where: { status: PeriodStatus.ACTIVE, id: { not: period.id } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { id: true, year: true, month: true },
    });
    const pendingPeriods: { id: string; year: number; month: number; status: string }[] = [];
    for (const p of activePeriods) {
      const [count, selfEval] = await Promise.all([
        this.prisma.objective.count({ where: { periodId: p.id, employeeId } }),
        this.prisma.selfEvaluation.findUnique({
          where: { periodId_employeeId: { periodId: p.id, employeeId } },
          select: { status: true },
        }),
      ]);
      if (count > 0 && selfEval?.status !== SelfEvaluationStatus.SUBMITTED) {
        pendingPeriods.push({ ...p, status: selfEval?.status ?? 'PENDING' });
      }
    }

    return {
      period: {
        id: period.id,
        year: period.year,
        month: period.month,
        status: period.status,
      },
      pendingPeriods,
      profile,
      objectives: objectives.map((o) => ({
        id: o.id,
        description: o.description,
        metric: o.metric,
        points: Number(o.points),
        relativeWeight: Number(o.relativeWeight),
        importanceLevel: o.importanceLevel,
      })),
      selfEvaluation: selfEvaluation
        ? {
            id: selfEvaluation.id,
            status: selfEvaluation.status,
            submittedAt: selfEvaluation.submittedAt,
            items: selfEvaluation.items.map((i) => ({
              objectiveId: i.objectiveId,
              scale: i.scale,
              percent: i.percent,
              comment: i.comment,
            })),
          }
        : null,
      result,
      projected,
    };
  }

  private projectedAmount(
    objectives: { id: string; points: unknown }[],
    selfEvaluation: { status: SelfEvaluationStatus; items: { objectiveId: string; percent: number }[] } | null,
    profile: { gratificationMaxMonthly: unknown; programStartDate: Date } | null,
    period: { year: number; month: number },
    result: { finalAmount: unknown; totalPointsEarned?: unknown; proratedMax?: unknown } | null,
  ) {
    const daysToClose = this.daysToClose(period);
    if (result) {
      return {
        amount: Number(result.finalAmount),
        potentialMax: result.proratedMax !== undefined ? Number(result.proratedMax) : null,
        totalPoints: result.totalPointsEarned !== undefined ? Number(result.totalPointsEarned) : null,
        isFinal: true,
        daysToClose: 0,
      };
    }
    if (!profile) {
      return { amount: null, potentialMax: null, totalPoints: null, isFinal: false, daysToClose };
    }
    const factor = prorationFactor(profile.programStartDate, period.year, period.month);
    const proratedMax = round2(Number(profile.gratificationMaxMonthly) * factor);
    // Proyección en vivo con los items capturados (borrador o enviada sin validar).
    if (selfEvaluation && selfEvaluation.items.length > 0) {
      const percentByObjective = new Map<string, number>(
        selfEvaluation.items.map((i) => [i.objectiveId, i.percent]),
      );
      const total = round2(
        objectives.reduce(
          (acc, o) => acc + (Number(o.points) * (percentByObjective.get(o.id) ?? 0)) / 100,
          0,
        ),
      );
      return {
        amount: round2((total / 100) * proratedMax),
        potentialMax: proratedMax,
        totalPoints: total,
        isFinal: false,
        daysToClose,
      };
    }
    // Sin captura aún: mostrar el 100% potencial (monto si cumple todos los objetivos).
    return {
      amount: null,
      potentialMax: proratedMax,
      totalPoints: null,
      isFinal: false,
      daysToClose,
    };
  }

  private daysToClose(_period: { year: number; month: number }): number | null {
    // Sin auto-cierre: no hay fecha límite de captura.
    return null;
  }

  async saveDraftItem(employeeId: string, objectiveId: string, dto: SaveItemDto) {
    const objective = await this.prisma.objective.findUnique({ where: { id: objectiveId } });
    if (!objective) throw new NotFoundException('Objetivo no encontrado');
    if (objective.employeeId !== employeeId) {
      throw new ForbiddenException('El objetivo no pertenece al colaborador');
    }
    const period = await this.prisma.evaluationPeriod.findUnique({
      where: { id: objective.periodId },
    });
    if (!period || period.status !== PeriodStatus.ACTIVE) {
      throw new ForbiddenException('No hay un periodo activo para evaluar');
    }

    const selfEvaluation = await this.getOrCreateSelfEvaluation(period.id, employeeId);
    if (selfEvaluation.status !== SelfEvaluationStatus.PENDING &&
        selfEvaluation.status !== SelfEvaluationStatus.IN_PROGRESS) {
      throw new ForbiddenException('La evaluación ya fue enviada y no admite cambios');
    }

    await this.prisma.selfEvaluationItem.upsert({
      where: {
        selfEvaluationId_objectiveId: {
          selfEvaluationId: selfEvaluation.id,
          objectiveId,
        },
      },
      create: {
        selfEvaluationId: selfEvaluation.id,
        objectiveId,
        scale: dto.scale,
        percent: SCALE_PERCENT[dto.scale],
        comment: dto.comment,
      },
      update: {
        scale: dto.scale,
        percent: SCALE_PERCENT[dto.scale],
        comment: dto.comment,
      },
    });

    if (selfEvaluation.status === SelfEvaluationStatus.PENDING) {
      await this.prisma.selfEvaluation.update({
        where: { id: selfEvaluation.id },
        data: { status: SelfEvaluationStatus.IN_PROGRESS },
      });
    }

    return this.myCurrent(employeeId);
  }

  async submit(employeeId: string, periodId: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.status !== PeriodStatus.ACTIVE) {
      throw new BadRequestException('No hay un periodo activo');
    }

    const selfEvaluation = await this.getOrCreateSelfEvaluation(period.id, employeeId);
    if (selfEvaluation.status === SelfEvaluationStatus.SUBMITTED) {
      throw new BadRequestException('La evaluación ya fue enviada');
    }

    const objectives = await this.prisma.objective.findMany({
      where: { periodId: period.id, employeeId },
    });
    if (objectives.length < 5) {
      throw new BadRequestException('Aún no se han asignado los objetivos del periodo');
    }

    const itemsCount = await this.prisma.selfEvaluationItem.count({
      where: { selfEvaluationId: selfEvaluation.id },
    });
    if (itemsCount < objectives.length) {
      throw new BadRequestException('Debe evaluar todos los objetivos antes de enviar');
    }

    return this.prisma.selfEvaluation.update({
      where: { id: selfEvaluation.id },
      data: { status: SelfEvaluationStatus.SUBMITTED, submittedAt: new Date() },
    });
  }

  private async getOrCreateSelfEvaluation(periodId: string, employeeId: string) {
    return this.prisma.selfEvaluation.upsert({
      where: { periodId_employeeId: { periodId, employeeId } },
      create: { periodId, employeeId, status: SelfEvaluationStatus.PENDING },
      update: {},
    });
  }

  /**
   * Histórico anual de cumplimiento (solo porcentajes, sin dinero).
   * Devuelve los 12 meses con puntos (0–100), posición dentro de la plantilla evaluada ese mes,
   * y la posición anual basada en el promedio de cumplimiento del año.
   */
  async history(employeeId: string, yearParam?: number) {
    const myResults = await this.prisma.evaluationResult.findMany({
      where: { employeeId },
      include: { period: { select: { year: true } } },
    });
    const availableYears = [...new Set(myResults.map((r) => r.period.year))].sort((a, b) => a - b);
    const year = yearParam ?? availableYears[availableYears.length - 1] ?? new Date().getFullYear();

    const periods = await this.prisma.evaluationPeriod.findMany({
      where: { year },
      include: { results: { select: { employeeId: true, totalPointsEarned: true } } },
      orderBy: { month: 'asc' },
    });

    const months: { month: number; points: number | null; rank: number | null; total: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const period = periods.find((p) => p.month === m);
      const results = period?.results ?? [];
      const mine = results.find((r) => r.employeeId === employeeId);
      const rank = mine
        ? results.filter((r) => Number(r.totalPointsEarned) > Number(mine.totalPointsEarned)).length + 1
        : null;
      months.push({
        month: m,
        points: mine ? Number(mine.totalPointsEarned) : null,
        rank,
        total: results.length,
      });
    }

    // Promedio anual por empleado (solo meses con resultado) → posición en la plantilla.
    const sums = new Map<string, { sum: number; n: number }>();
    for (const p of periods) {
      for (const r of p.results) {
        const e = sums.get(r.employeeId) ?? { sum: 0, n: 0 };
        e.sum += Number(r.totalPointsEarned);
        e.n += 1;
        sums.set(r.employeeId, e);
      }
    }
    const averages = [...sums.entries()].map(([id, e]) => ({ id, avg: e.sum / e.n }));
    const myAverage = averages.find((a) => a.id === employeeId)?.avg ?? null;
    const yearRank = myAverage !== null ? averages.filter((a) => a.avg > myAverage).length + 1 : null;

    return {
      year,
      availableYears,
      months,
      yearAverage: myAverage !== null ? round2(myAverage) : null,
      yearRank,
      yearTotal: averages.length,
    };
  }

  /**
   * Histórico de cumplimiento del equipo: para JEFE son sus subordinados directos
   * (directBossId); para RRHH/DUENO toda la plantilla evaluada. Desglose mensual
   * del año + promedio anual por miembro.
   */
  async teamHistory(user: { id: string; role: string }, yearParam?: number) {
    const isBossScoped = user.role === 'JEFE';
    const employees = await this.prisma.user.findMany({
      where: isBossScoped
        ? { isActive: true, directBossId: user.id }
        : { isActive: true, role: { in: ['COLABORADOR', 'JEFE'] } },
      select: {
        id: true,
        fullName: true,
        profile: { select: { officialPosition: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const periodsWithResults = await this.prisma.evaluationPeriod.findMany({
      where: { results: { some: {} } },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'asc' },
    });
    const availableYears = periodsWithResults.map((p) => p.year);
    const year = yearParam ?? availableYears[availableYears.length - 1] ?? new Date().getFullYear();

    const periods = await this.prisma.evaluationPeriod.findMany({
      where: { year },
      include: { results: { select: { employeeId: true, totalPointsEarned: true } } },
      orderBy: { month: 'asc' },
    });

    const members = employees.map((e) => {
      const months: { month: number; points: number | null }[] = [];
      let sum = 0;
      let n = 0;
      for (let m = 1; m <= 12; m++) {
        const period = periods.find((p) => p.month === m);
        const mine = period?.results.find((r) => r.employeeId === e.id);
        const points = mine ? Number(mine.totalPointsEarned) : null;
        if (points !== null) {
          sum += points;
          n += 1;
        }
        months.push({ month: m, points });
      }
      return {
        employeeId: e.id,
        fullName: e.fullName,
        position: e.profile?.officialPosition ?? '',
        months,
        yearAverage: n > 0 ? round2(sum / n) : null,
      };
    });

    return { year, availableYears, members };
  }

  /**
   * Detalle mensual del histórico: objetivos con la calificación recibida,
   * agrupables por escala (NO_CUMPLIDO → REGULAR → BUENO → EXCELENTE).
   * Prioriza la calificación del validador si existe; si no, la autoevaluación.
   */
  async historyDetail(employeeId: string, year: number, month: number) {
    const period = await this.prisma.evaluationPeriod.findFirst({ where: { year, month } });
    if (!period) return null;

    const objectives = await this.prisma.objective.findMany({
      where: { periodId: period.id, employeeId },
      select: { id: true, description: true },
    });
    const descriptionById = new Map(objectives.map((o) => [o.id, o.description]));

    const self = await this.prisma.selfEvaluation.findUnique({
      where: { periodId_employeeId: { periodId: period.id, employeeId } },
      include: { items: true, validation: { include: { items: true } } },
    });

    let rawItems: { objectiveId: string; scale: unknown; comment: string | null }[] = [];
    let source: 'VALIDATOR' | 'SELF' | null = null;
    if (self?.validation && self.validation.items.length > 0) {
      rawItems = self.validation.items.map((i) => ({
        objectiveId: i.objectiveId,
        scale: i.scale,
        comment: null,
      }));
      source = 'VALIDATOR';
    } else if (self && self.items.length > 0) {
      rawItems = self.items.map((i) => ({
        objectiveId: i.objectiveId,
        scale: i.scale,
        comment: i.comment,
      }));
      source = 'SELF';
    }

    const items = rawItems
      .filter((i) => descriptionById.has(i.objectiveId))
      .map((i) => ({
        objectiveId: i.objectiveId,
        description: descriptionById.get(i.objectiveId) as string,
        scale: i.scale as 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NO_CUMPLIDO',
        comment: i.comment,
      }));

    return { year, month, periodStatus: period.status, source, items };
  }
}
