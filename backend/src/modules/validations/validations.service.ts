import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloseReason, Prisma, Scale, SelfEvaluationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ResultItemSnapshot,
  SCALE_PERCENT,
  prorationFactor,
  round2,
  totalPoints,
} from '../../common/business/calculation';
import { DecideValidationDto } from './dto/validation.dto';
import { ReceiptsService } from '../receipts/receipts.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ValidationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptsService: ReceiptsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Bandeja de evaluaciones enviadas pendientes de validación (incluye tardías post-día-11),
   * filtrada por el alcance del validador:
   * - JEFE: solo sus subordinados directos.
   * - RRHH: colaboradores y jefes (toda la operación).
   * - DUENO: todo, incluidos RRHH.
   */
  async pending(validator: { id: string; role: string }) {
    const where: Prisma.SelfEvaluationWhereInput = {
      status: SelfEvaluationStatus.SUBMITTED,
      validation: null,
    };
    if (validator.role === 'RRHH') {
      where.employee = { role: { in: ['COLABORADOR', 'JEFE'] } };
    } else if (validator.role === 'JEFE') {
      where.employee = { directBossId: validator.id };
    }
    // DUENO: sin filtro adicional, ve todo.

    return this.prisma.selfEvaluation.findMany({
      where,
      orderBy: { submittedAt: 'asc' },
      include: {
        period: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            profile: { select: { officialPosition: true, branch: true } },
          },
        },
      },
    });
  }

  async detail(selfEvaluationId: string) {
    const selfEvaluation = await this.prisma.selfEvaluation.findUnique({
      where: { id: selfEvaluationId },
      include: {
        period: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            directBossId: true,
            profile: {
              select: {
                officialPosition: true,
                gratificationMaxMonthly: true,
                programStartDate: true,
                branch: true,
              },
            },
          },
        },
        items: true,
        validation: { include: { items: true } },
      },
    });
    if (!selfEvaluation) throw new NotFoundException('Evaluación no encontrada');

    const objectives = await this.prisma.objective.findMany({
      where: { periodId: selfEvaluation.periodId, employeeId: selfEvaluation.employeeId },
      orderBy: { createdAt: 'asc' },
      include: { importanceLevel: true },
    });

    return { selfEvaluation, objectives };
  }

  /**
   * El primer validador que decide cierra el ciclo.
   * Aprobar sin cambios no requiere justificación; modificar calificaciones la hace obligatoria.
   */
  async decide(
    selfEvaluationId: string,
    validator: { id: string; role: string },
    dto: DecideValidationDto,
  ) {
    const { selfEvaluation, objectives } = await this.detail(selfEvaluationId);

    if (selfEvaluation.status !== SelfEvaluationStatus.SUBMITTED) {
      throw new BadRequestException('La evaluación no está enviada');
    }
    if (selfEvaluation.validation) {
      throw new ConflictException('Esta evaluación ya fue validada por otro usuario');
    }
    this.assertCanValidate(validator, selfEvaluation.employee);

    const objectiveMap = new Map(objectives.map((o) => [o.id, o]));
    const employeeItems = new Map(selfEvaluation.items.map((i) => [i.objectiveId, i]));

    for (const item of dto.items) {
      if (!objectiveMap.has(item.objectiveId)) {
        throw new BadRequestException('Hay objetivos que no pertenecen a la evaluación');
      }
    }

    let modified = false;
    const validatorVersion: ResultItemSnapshot[] = [];
    const employeeVersion: ResultItemSnapshot[] = [];

    for (const [objectiveId, objective] of objectiveMap) {
      const employeeItem = employeeItems.get(objectiveId);
      const validatorItem = dto.items.find((i) => i.objectiveId === objectiveId);
      const employeeScale: Scale = employeeItem?.scale ?? 'NO_CUMPLIDO';
      const validatorScale: Scale = validatorItem?.scale ?? employeeScale;

      if (validatorScale !== employeeScale) modified = true;

      employeeVersion.push({
        objectiveId,
        description: objective.description,
        scale: employeeScale,
        percent: SCALE_PERCENT[employeeScale],
        points: Number(objective.points),
        weighted: round2((Number(objective.points) * SCALE_PERCENT[employeeScale]) / 100),
      });
      validatorVersion.push({
        objectiveId,
        description: objective.description,
        scale: validatorScale,
        percent: SCALE_PERCENT[validatorScale],
        points: Number(objective.points),
        weighted: round2((Number(objective.points) * SCALE_PERCENT[validatorScale]) / 100),
      });
    }

    if (modified && (!dto.justification || dto.justification.trim().length === 0)) {
      throw new BadRequestException(
        'La justificación es obligatoria cuando se modifican calificaciones',
      );
    }

    const totals = totalPoints(validatorVersion);
    const profile = selfEvaluation.employee.profile;
    if (!profile) throw new BadRequestException('El colaborador no tiene perfil configurado');

    const factor = prorationFactor(
      profile.programStartDate,
      selfEvaluation.period.year,
      selfEvaluation.period.month,
    );
    const proratedMax = round2(Number(profile.gratificationMaxMonthly) * factor);
    // totalPoints es escala 0–100 (porcentaje de cumplimiento) → % del máximo prorrateado.
    const finalAmount = round2((totals / 100) * proratedMax);

    const result = await this.prisma.$transaction(async (tx) => {
      const validation = await tx.validation.create({
        data: {
          selfEvaluationId,
          validatorId: validator.id,
          justification: dto.justification ?? (modified ? '' : 'Aprobado sin cambios'),
        },
      });
      await tx.validationItem.createMany({
        data: validatorVersion.map((i) => ({
          validationId: validation.id,
          objectiveId: i.objectiveId,
          scale: i.scale,
          percent: i.percent,
        })),
      });

      try {
        return await tx.evaluationResult.create({
          data: {
            periodId: selfEvaluation.periodId,
            employeeId: selfEvaluation.employeeId,
            employeeVersion: employeeVersion as unknown as Prisma.InputJsonValue,
            validatorVersion: validatorVersion as unknown as Prisma.InputJsonValue,
            validatedById: validator.id,
            totalPointsEarned: totals,
            prorationFactor: factor,
            proratedMax,
            finalAmount,
            closeReason: CloseReason.MANUAL,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Esta evaluación ya fue validada por otro usuario');
        }
        throw e;
      }
    });

    // Fuera de la transacción: generación de recibo y correo.
    const receipt = await this.receiptsService.generateForResult(result.id);
    await this.notificationsService.sendReceiptReady(
      selfEvaluation.employee.email,
      selfEvaluation.employee.fullName,
      receipt.folio,
    );

    return { result, receipt };
  }

  /**
   * Cadena de validación:
   * - El Dueño valida a cualquiera (máxima figura).
   * - RRHH valida a colaboradores y jefes.
   * - El jefe valida a sus subordinados directos (cualquier rol con su directBossId).
   */
  private assertCanValidate(
    validator: { id: string; role: string },
    employee: { id: string; role: string; directBossId: string | null },
  ) {
    if (validator.role === 'DUENO') return;
    if (employee.directBossId && employee.directBossId === validator.id) return;
    if (
      validator.role === 'RRHH' &&
      (employee.role === 'COLABORADOR' || employee.role === 'JEFE')
    ) {
      return;
    }
    throw new ForbiddenException('No puede validar la evaluación de este empleado');
  }
}
