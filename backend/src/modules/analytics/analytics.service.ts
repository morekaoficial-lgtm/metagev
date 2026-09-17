import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ResultItem {
  objectiveId: string;
  percent?: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Heatmap de cumplimiento: promedio de % por nivel de importancia × sucursal.
   * Usa la versión del validador si existe; si no, la del colaborador.
   */
  async heatmap(periodId: string) {
    const results = await this.prisma.evaluationResult.findMany({
      where: { periodId },
      include: { employee: { include: { profile: { include: { branch: true } } } } },
    });

    const objectives = await this.prisma.objective.findMany({
      where: { periodId },
      include: { importanceLevel: true },
    });
    const levelByObjective = new Map(objectives.map((o) => [o.id, o.importanceLevel]));
    const branchName = (employee: { profile?: { branch?: { name: string } | null } | null }) =>
      employee.profile?.branch?.name ?? 'Sin sucursal';

    // acum[levelLabel][branchName] = { sum, count }
    const acc = new Map<string, Map<string, { sum: number; count: number; color: string }>>();

    for (const result of results) {
      const items = ((result.validatorVersion as unknown as ResultItem[] | null) ??
        (result.employeeVersion as unknown as ResultItem[])) as ResultItem[];
      for (const item of items) {
        const level = levelByObjective.get(item.objectiveId);
        if (!level || item.percent === undefined) continue;
        const bName = branchName(result.employee);
        if (!acc.has(level.label)) acc.set(level.label, new Map());
        const branchMap = acc.get(level.label)!;
        if (!branchMap.has(bName)) {
          branchMap.set(bName, { sum: 0, count: 0, color: level.colorHex });
        }
        const cell = branchMap.get(bName)!;
        cell.sum += item.percent;
        cell.count += 1;
      }
    }

    const levels = [...acc.keys()];
    const branches = [
      ...new Set(levels.flatMap((l) => [...acc.get(l)!.keys()])),
    ].sort();

    return {
      branches,
      rows: levels.map((level) => ({
        level,
        color: acc.get(level)!.values().next().value?.color ?? '#6B7280',
        cells: branches.map((b) => {
          const cell = acc.get(level)!.get(b);
          return cell && cell.count > 0
            ? Math.round((cell.sum / cell.count) * 100) / 100
            : null;
        }),
      })),
    };
  }

  /** Leaderboard de colaboradores por puntaje promedio con filtros. */
  async leaderboard(filters: { bossId?: string; branchId?: string; from?: string; to?: string }) {
    const where: Prisma.EvaluationResultWhereInput = {};
    const employeeWhere: Prisma.UserWhereInput = {};
    if (filters.bossId) employeeWhere.directBossId = filters.bossId;
    if (filters.branchId) employeeWhere.profile = { branchId: filters.branchId };
    if (Object.keys(employeeWhere).length > 0) where.employee = employeeWhere;
    if (filters.from || filters.to) {
      where.period = {
        AND: [
          filters.from ? { year: { gte: Number(filters.from.slice(0, 4)) } } : {},
          filters.to ? { year: { lte: Number(filters.to.slice(0, 4)) } } : {},
        ],
      };
    }

    const results = await this.prisma.evaluationResult.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            profile: { select: { officialPosition: true, branch: { select: { name: true } } } },
          },
        },
      },
    });

    const byEmployee = new Map<
      string,
      { employee: (typeof results)[number]['employee']; total: number; count: number }
    >();
    for (const r of results) {
      const entry = byEmployee.get(r.employeeId) ?? { employee: r.employee, total: 0, count: 0 };
      entry.total += Number(r.totalPointsEarned);
      entry.count += 1;
      byEmployee.set(r.employeeId, entry);
    }

    return [...byEmployee.entries()]
      .map(([employeeId, e]) => ({
        employeeId,
        fullName: e.employee.fullName,
        officialPosition: e.employee.profile?.officialPosition ?? '',
        branch: e.employee.profile?.branch?.name ?? '',
        average: Math.round((e.total / e.count) * 100) / 100,
        periods: e.count,
      }))
      .sort((a, b) => b.average - a.average);
  }

  /** Export CSV del periodo: ID, Nombre, Puesto, Monto Final. */
  async exportCsv(periodId: string): Promise<string> {
    const results = await this.prisma.evaluationResult.findMany({
      where: { periodId },
      orderBy: { employee: { fullName: 'asc' } },
      include: { employee: { include: { profile: true } } },
    });

    const header = 'ID,Nombre,Puesto,Monto Final';
    const lines = results.map((r) =>
      [
        r.employeeId,
        `"${r.employee.fullName.replace(/"/g, '""')}"`,
        `"${(r.employee.profile?.officialPosition ?? '').replace(/"/g, '""')}"`,
        Number(r.finalAmount).toFixed(2),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}
