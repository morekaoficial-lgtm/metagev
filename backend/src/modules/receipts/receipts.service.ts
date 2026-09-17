import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfService } from './pdf.service';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Genera el recibo PDF de un resultado con folio secuencial GEV-AAAA-MM-####
   * por periodo. El bloqueo a nivel fila del periodo evita folios duplicados.
   */
  async generateForResult(resultId: string) {
    const result = await this.prisma.evaluationResult.findUnique({
      where: { id: resultId },
      include: {
        period: true,
        employee: { include: { profile: true } },
        receipt: true,
      },
    });
    if (!result) throw new NotFoundException('Resultado no encontrado');
    if (result.receipt) return result.receipt;
    if (!result.employee.profile) throw new NotFoundException('Perfil del colaborador no encontrado');
    const profile = result.employee.profile;

    const pdfPath = await this.prisma.$transaction(async (tx) => {
      // Bloqueo pesimista sobre el periodo para serializar la numeración del folio.
      await tx.$queryRaw`SELECT id FROM evaluation_periods WHERE id = ${result.periodId}::uuid FOR UPDATE`;

      const count = await tx.receipt.count({
        where: { result: { periodId: result.periodId } },
      });
      const seq = String(count + 1).padStart(4, '0');
      const folio = `GEV-${result.period.year}-${String(result.period.month).padStart(2, '0')}-${seq}`;

      const filePath = await this.pdfService.generateReceiptPdf({
        folio,
        employeeName: result.employee.fullName,
        officialPosition: profile.officialPosition,
        periodLabel: `${result.period.year}-${String(result.period.month).padStart(2, '0')}`,
        amount: Number(result.finalAmount),
      });

      await tx.receipt.create({
        data: { resultId, folio, pdfPath: filePath },
      });
      return filePath;
    });

    return this.prisma.receipt.findUniqueOrThrow({ where: { resultId } });
  }

  async listResults(periodId: string) {
    return this.prisma.evaluationResult.findMany({
      where: periodId ? { periodId } : {},
      orderBy: { employee: { fullName: 'asc' } },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        period: true,
        receipt: { select: { id: true, folio: true } },
      },
    });
  }

  async generateAllForPeriod(periodId: string) {
    const results = await this.prisma.evaluationResult.findMany({
      where: { periodId, receipt: null },
      select: { id: true },
    });
    let generated = 0;
    for (const r of results) {
      await this.generateForResult(r.id);
      generated += 1;
    }
    // El lote (recibos por hoja + concentrado) se regenera siempre con todo el periodo.
    const batch = await this.buildBatch(periodId);
    return { generated, batch };
  }

  /** Construye el PDF del lote completo del periodo: un recibo por hoja + concentrado. */
  async buildBatch(periodId: string): Promise<string | null> {
    const period = await this.prisma.evaluationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Periodo no encontrado');
    const results = await this.prisma.evaluationResult.findMany({
      where: { periodId, receipt: { isNot: null } },
      orderBy: { receipt: { folio: 'asc' } },
      include: {
        employee: { include: { profile: true } },
        receipt: true,
      },
    });
    if (!results.length) return null;

    const items = results.map((r) => ({
      folio: r.receipt!.folio,
      employeeName: r.employee.fullName,
      officialPosition: r.employee.profile?.officialPosition ?? 'Colaborador',
      points: Number(r.totalPointsEarned),
      amount: Number(r.finalAmount),
    }));
    const filePath = await this.pdfService.generateBatchPdf(
      items,
      period.year,
      period.month,
      'MXN',
    );
    return filePath.split('/').pop() ?? null;
  }

  /** Resuelve el archivo del lote validando el nombre (evita path traversal). */
  async downloadBatch(fileName: string) {
    const path = this.pdfService.resolveBatchFile(fileName);
    return path ? { path, name: fileName } : null;
  }

  async list(periodId?: string) {
    return this.prisma.receipt.findMany({
      where: periodId ? { result: { periodId } } : {},
      orderBy: { folio: 'asc' },
      include: {
        result: {
          include: {
            employee: { select: { id: true, fullName: true, email: true } },
            period: true,
          },
        },
      },
    });
  }

  async download(id: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Recibo no encontrado');
    return receipt;
  }
}
