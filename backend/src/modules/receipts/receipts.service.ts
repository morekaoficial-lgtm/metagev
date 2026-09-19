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
   * `force` re-renderiza el PDF aunque ya exista recibo (p. ej. cuando se
   * sustituyó un stub AUTO_CLOSED por el resultado validado real).
   */
  async generateForResult(resultId: string, opts?: { force?: boolean }) {
    const result = await this.prisma.evaluationResult.findUnique({
      where: { id: resultId },
      include: {
        period: true,
        employee: { include: { profile: true } },
        receipt: true,
      },
    });
    if (!result) throw new NotFoundException('Resultado no encontrado');
    if (result.receipt && !opts?.force) return result.receipt;
    if (!result.employee.profile) throw new NotFoundException('Perfil del colaborador no encontrado');
    const profile = result.employee.profile;

    await this.prisma.$transaction(async (tx) => {
      // Bloqueo pesimista sobre el periodo para serializar la numeración del folio.
      await tx.$queryRaw`SELECT id FROM evaluation_periods WHERE id = ${result.periodId}::uuid FOR UPDATE`;

      if (result.receipt && opts?.force) {
        // Recibo existente (stub): se conserva el folio y se reescribe el PDF.
        await this.pdfService.generateReceiptPdf({
          folio: result.receipt.folio,
          employeeName: result.employee.fullName,
          officialPosition: profile.officialPosition,
          periodLabel: `${result.period.year}-${String(result.period.month).padStart(2, '0')}`,
          amount: Number(result.finalAmount),
        });
        await tx.receipt.update({
          where: { resultId },
          data: { generatedAt: new Date() },
        });
        return;
      }

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
    const errors: string[] = [];
    for (const r of results) {
      // Un recibo que falle (p. ej. Chromium en el contenedor) no debe tumbar
      // la generación del resto del periodo.
      try {
        await this.generateForResult(r.id);
        generated += 1;
      } catch (e) {
        errors.push(`${r.id}: ${(e as Error).message}`);
      }
    }
    // El lote (recibos por hoja + concentrado) se regenera siempre con todo el periodo.
    let batch: string | null = null;
    try {
      batch = await this.buildBatch(periodId);
    } catch (e) {
      errors.push(`lote: ${(e as Error).message}`);
    }
    return { generated, batch, errors };
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
