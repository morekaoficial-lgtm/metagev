import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { calculatePoints } from '../../common/business/calculation';
import { CreateObjectiveDto, DuplicateObjectivesDto, UpdateObjectiveDto } from './dto/objective.dto';

const MIN_OBJECTIVES = 5;
const MAX_OBJECTIVES = 30;

@Injectable()
export class ObjectivesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(periodId: string, employeeId: string) {
    const objectives = await this.prisma.objective.findMany({
      where: { periodId, employeeId },
      orderBy: { createdAt: 'asc' },
      include: { importanceLevel: true },
    });
    return objectives.map((o) => ({
      ...o,
      relativeWeight: Number(o.relativeWeight),
      points: Number(o.points),
    }));
  }

  async create(dto: CreateObjectiveDto, createdById: string) {
    await this.assertEditablePeriod(dto.periodId);
    const count = await this.prisma.objective.count({
      where: { periodId: dto.periodId, employeeId: dto.employeeId },
    });
    if (count >= MAX_OBJECTIVES) {
      throw new BadRequestException(`Máximo ${MAX_OBJECTIVES} objetivos por periodo`);
    }
    await this.assertEmployee(dto.employeeId);
    await this.assertLevel(dto.importanceLevelId);

    const created = await this.prisma.$transaction(async (tx) => {
      const objective = await tx.objective.create({
        data: {
          periodId: dto.periodId,
          employeeId: dto.employeeId,
          description: dto.description,
          metric: dto.metric,
          importanceLevelId: dto.importanceLevelId,
          relativeWeight: dto.relativeWeight,
          points: 0,
          createdById,
        },
      });
      await tx.objectiveAuditLog.create({
        data: {
          objectiveId: objective.id,
          changedById: createdById,
          field: 'created',
          newValue: dto.description,
        },
      });
      await this.recalculatePoints(tx, dto.periodId, dto.employeeId);
      return objective;
    });
    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateObjectiveDto, changedById: string) {
    const objective = await this.prisma.objective.findUnique({ where: { id } });
    if (!objective) throw new NotFoundException('Objetivo no encontrado');
    await this.assertEditablePeriod(objective.periodId);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ObjectiveUpdateInput = {};
      const auditEntries: Prisma.ObjectiveAuditLogCreateManyInput[] = [];

      if (dto.description !== undefined && dto.description !== objective.description) {
        data.description = dto.description;
        auditEntries.push({
          objectiveId: id,
          changedById,
          field: 'description',
          oldValue: objective.description,
          newValue: dto.description,
        });
      }
      if (dto.metric !== undefined && dto.metric !== objective.metric) {
        data.metric = dto.metric;
        auditEntries.push({
          objectiveId: id,
          changedById,
          field: 'metric',
          oldValue: objective.metric,
          newValue: dto.metric,
        });
      }
      if (dto.importanceLevelId !== undefined && dto.importanceLevelId !== objective.importanceLevelId) {
        await this.assertLevel(dto.importanceLevelId);
        data.importanceLevel = { connect: { id: dto.importanceLevelId } };
        auditEntries.push({
          objectiveId: id,
          changedById,
          field: 'importance_level_id',
          oldValue: objective.importanceLevelId,
          newValue: dto.importanceLevelId,
        });
      }
      const newWeight = dto.relativeWeight !== undefined ? dto.relativeWeight : Number(objective.relativeWeight);
      if (dto.relativeWeight !== undefined && dto.relativeWeight !== Number(objective.relativeWeight)) {
        data.relativeWeight = dto.relativeWeight;
        auditEntries.push({
          objectiveId: id,
          changedById,
          field: 'relative_weight',
          oldValue: String(Number(objective.relativeWeight)),
          newValue: String(dto.relativeWeight),
        });
      }

      await tx.objective.update({ where: { id }, data });
      if (auditEntries.length > 0) {
        await tx.objectiveAuditLog.createMany({ data: auditEntries });
      }
      await this.recalculatePoints(tx, objective.periodId, objective.employeeId);
    });
    return this.findById(id);
  }

  async remove(id: string, changedById: string) {
    const objective = await this.prisma.objective.findUnique({ where: { id } });
    if (!objective) throw new NotFoundException('Objetivo no encontrado');
    await this.assertEditablePeriod(objective.periodId);

    const count = await this.prisma.objective.count({
      where: { periodId: objective.periodId, employeeId: objective.employeeId },
    });
    if (count - 1 < MIN_OBJECTIVES) {
      throw new BadRequestException(`Deben permanecer al menos ${MIN_OBJECTIVES} objetivos`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.objectiveAuditLog.create({
        data: {
          objectiveId: id,
          changedById,
          field: 'deleted',
          oldValue: objective.description,
        },
      });
      await tx.objective.delete({ where: { id } });
      await this.recalculatePoints(tx, objective.periodId, objective.employeeId);
    });
    return { ok: true };
  }

  async duplicateFromLastMonth(dto: DuplicateObjectivesDto, createdById: string) {
    await this.assertEditablePeriod(dto.periodId);
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: dto.periodId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    const prevMonth = period.month === 1 ? 12 : period.month - 1;
    const prevYear = period.month === 1 ? period.year - 1 : period.year;
    const previous = await this.prisma.evaluationPeriod.findUnique({
      where: { year_month: { year: prevYear, month: prevMonth } },
    });
    if (!previous) {
      throw new NotFoundException('No existe el periodo del mes anterior');
    }

    const existingCount = await this.prisma.objective.count({
      where: { periodId: dto.periodId, employeeId: dto.employeeId },
    });
    if (existingCount > 0) {
      throw new BadRequestException('El empleado ya tiene objetivos en este periodo');
    }

    const source = await this.prisma.objective.findMany({
      where: { periodId: previous.id, employeeId: dto.employeeId },
    });
    if (source.length < MIN_OBJECTIVES) {
      throw new BadRequestException(
        `El mes anterior tiene menos de ${MIN_OBJECTIVES} objetivos para este empleado`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const obj of source) {
        const created = await tx.objective.create({
          data: {
            periodId: dto.periodId,
            employeeId: dto.employeeId,
            description: obj.description,
            metric: obj.metric,
            importanceLevelId: obj.importanceLevelId,
            relativeWeight: Number(obj.relativeWeight),
            points: 0,
            createdById,
          },
        });
        await tx.objectiveAuditLog.create({
          data: {
            objectiveId: created.id,
            changedById: createdById,
            field: 'created',
            newValue: `Duplicado del periodo ${prevYear}-${prevMonth}: ${obj.description}`,
          },
        });
      }
      await this.recalculatePoints(tx, dto.periodId, dto.employeeId);
    });

    return this.list(dto.periodId, dto.employeeId);
  }

  async audit(periodId: string, employeeId: string) {
    return this.prisma.objectiveAuditLog.findMany({
      where: { objective: { periodId, employeeId } },
      orderBy: { changedAt: 'desc' },
      include: {
        objective: { select: { id: true, description: true } },
        changedBy: { select: { id: true, fullName: true } },
      },
      take: 200,
    });
  }

  /** Recalcula los puntos de todos los objetivos de un empleado en un periodo (largest remainder).
   * El peso efectivo de cada objetivo = peso propio × peso relativo de su nivel de importancia. */
  private async recalculatePoints(
    tx: Prisma.TransactionClient,
    periodId: string,
    employeeId: string,
  ) {
    const objectives = await tx.objective.findMany({
      where: { periodId, employeeId },
      orderBy: { createdAt: 'asc' },
      include: { importanceLevel: true },
    });
    if (objectives.length === 0) return;
    const points = calculatePoints(
      objectives.map((o) => Number(o.relativeWeight) * Number(o.importanceLevel.relativeWeight)),
    );
    for (let i = 0; i < objectives.length; i++) {
      await tx.objective.update({
        where: { id: objectives[i].id },
        data: { points: points[i] },
      });
    }
  }

  /** Recálculo explícito solicitado desde la UI (botón "Guardar ponderación"). */
  async recalculate(periodId: string, employeeId: string) {
    await this.assertEditablePeriod(periodId);
    await this.assertEmployee(employeeId);
    await this.prisma.$transaction(async (tx) => {
      await this.recalculatePoints(tx, periodId, employeeId);
    });
    const objectives = await this.list(periodId, employeeId);
    const total = objectives.reduce((acc, o) => acc + Number(o.points), 0);
    return { count: objectives.length, totalPoints: total, objectives };
  }

  private async findById(id: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
      include: { importanceLevel: true },
    });
    if (!objective) throw new NotFoundException('Objetivo no encontrado');
    return { ...objective, relativeWeight: Number(objective.relativeWeight), points: Number(objective.points) };
  }

  private async assertEditablePeriod(periodId: string) {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    if (period.status !== PeriodStatus.DRAFT && period.status !== PeriodStatus.ACTIVE) {
      throw new ForbiddenException('El periodo ya está cerrado y no admite cambios');
    }
  }

  /** Empleados evaluables: colaboradores, jefes y RRHH (todos reciben GEV). El Dueño no. */
  private async assertEmployee(employeeId: string) {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: { in: ['COLABORADOR', 'JEFE', 'RRHH'] }, isActive: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'El empleado no existe, no está activo o no es evaluable (colaborador, jefe o RRHH)',
      );
    }
  }

  private async assertLevel(levelId: string) {
    const level = await this.prisma.importanceLevel.findFirst({
      where: { id: levelId, isActive: true },
    });
    if (!level) throw new BadRequestException('El nivel de importancia no existe o está inactivo');
  }
}
