import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const LEGAL_CLAUSE =
  'Por medio del presente documento, reconozco haber recibido la cantidad señalada por concepto de Gratificación Extraordinaria Variable correspondiente a la evaluación de métricas del periodo. Ambas partes reconocen expresamente que este importe es de carácter extraordinario, variable y está estrictamente condicionado a los resultados del sistema de evaluación. Por su naturaleza condicional, este pago no constituye una prestación fija, permanente, ni un derecho adquirido.';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface ReceiptData {
  folio: string;
  employeeName: string;
  officialPosition: string;
  periodLabel: string;
  amount: number;
  currency?: string;
}

export interface BatchReceiptItem {
  folio: string;
  employeeName: string;
  officialPosition: string;
  points: number | null;
  amount: number;
}

const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  // En contenedores Docker /dev/shm es de 64MB por defecto: sin esto Chromium
  // se mata al renderizar el PDF (oom del renderer).
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly storageDir: string;

  constructor(config: ConfigService) {
    this.storageDir = config.get<string>('STORAGE_DIR') ?? join(process.cwd(), 'storage');
  }

  async generateReceiptPdf(data: ReceiptData): Promise<string> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: PUPPETEER_ARGS,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(this.doc(`<div class="page">${this.receiptHtml(data)}</div>`), {
        waitUntil: 'networkidle0',
      });
      const pdf = await page.pdf({ format: 'Letter', printBackground: true });
      const dir = join(this.storageDir, 'receipts');
      await mkdir(dir, { recursive: true });
      const fileName = `${data.folio}.pdf`;
      const filePath = join(dir, fileName);
      await writeFile(filePath, pdf);
      return filePath;
    } finally {
      await browser.close();
    }
  }

  /**
   * Lote completo del periodo: DOS recibos por hoja (media carta, para recortar
   * por la línea punteada) y al final el concentrado de pagos con columna en
   * blanco para el monto pagado real (redondeos) y firmas de Encargado y Cajero.
   */
  async generateBatchPdf(
    items: BatchReceiptItem[],
    year: number,
    month: number,
    currency: string,
  ): Promise<string> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: PUPPETEER_ARGS,
    });
    try {
      const periodLabel = `${year}-${String(month).padStart(2, '0')}`;
      const toData = (it: BatchReceiptItem): ReceiptData => ({
        folio: it.folio,
        employeeName: it.employeeName,
        officialPosition: it.officialPosition,
        periodLabel,
        amount: it.amount,
        currency,
      });

      const pageDivs: string[] = [];
      for (let i = 0; i < items.length; i += 2) {
        const first = this.receiptHalfHtml(toData(items[i]));
        const second = items[i + 1]
          ? `<div class="cut"></div>\n${this.receiptHalfHtml(toData(items[i + 1]))}`
          : '';
        pageDivs.push(`<div class="page2">\n${first}\n${second}\n</div>`);
      }
      pageDivs.push(`<div class="page2">\n${this.summaryHtml(items, year, month, currency)}\n</div>`);

      const page = await browser.newPage();
      await page.setContent(this.doc(pageDivs.join('\n')), { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      const dir = join(this.storageDir, 'receipts');
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, `GEV-${year}-${String(month).padStart(2, '0')}-lote.pdf`);
      await writeFile(filePath, pdf);
      return filePath;
    } finally {
      await browser.close();
    }
  }

  /**
   * Resuelve un archivo de lote dentro del directorio de recibos.
   * Valida el nombre (evita path traversal) y verifica que exista.
   */
  resolveBatchFile(fileName: string): string | null {
    if (!/^GEV-\d{4}-\d{2}-lote\.pdf$/.test(fileName)) return null;
    const filePath = join(this.storageDir, 'receipts', fileName);
    return existsSync(filePath) ? filePath : null;
  }

  private money(n: number, currency: string): string {
    return `${currency} ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Documento HTML completo con estilos. */
  private doc(inner: string): string {
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 13px; }
  .page { padding: 48px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .folio { color: #6B7280; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td, th { border: 1px solid #D1D5DB; padding: 8px; text-align: left; }
  th { background: #F3F4F6; }
  .legal { margin-top: 24px; padding: 12px; border: 1px solid #D1D5DB; background: #FAFAFA; font-size: 11.5px; line-height: 1.5; text-align: justify; }
  .signatures { margin-top: 64px; display: flex; justify-content: space-between; gap: 32px; }
  .sig { flex: 1; border-top: 1px solid #111827; padding-top: 6px; font-size: 11px; color: #374151; }
  .sig div { margin-bottom: 14px; }
  /* Lote: hoja compartida por 2 recibos */
  .page2 { padding: 32px 48px; page-break-after: always; }
  .page2:last-child { page-break-after: auto; }
  .cut { border-top: 2px dashed #9CA3AF; margin: 10px 0; }
  .half { page-break-inside: avoid; min-height: 4.7in; }
  .half h1 { font-size: 15px; margin-bottom: 2px; }
  .half .folio { font-size: 11px; margin-bottom: 12px; }
  .half p { font-size: 12px; margin: 8px 0; }
  .half table { margin-top: 8px; font-size: 12px; }
  .half td, .half th { padding: 6px 8px; }
  .half .legal { margin-top: 12px; padding: 8px; font-size: 10px; line-height: 1.4; }
  .half .signatures { margin-top: 28px; gap: 24px; }
  .half .sig { font-size: 10px; }
  .half .sig div { margin-bottom: 8px; }
  /* Concentrado */
  .brand { font-size: 12px; font-weight: bold; color: #374151; letter-spacing: .5px; }
  .period { color: #6B7280; font-size: 13px; margin-bottom: 8px; }
  .paid-col { width: 130px; }
  td.paid { height: 26px; }
  .total-row td { font-weight: bold; background: #F9FAFB; }
  .note { margin-top: 12px; font-size: 11px; color: #6B7280; }
  .sig2 { margin-top: 72px; display: flex; justify-content: space-between; gap: 48px; }
  .sig2 .box { flex: 1; text-align: center; font-size: 12px; }
  .sig2 .line { border-top: 1px solid #111827; margin-top: 48px; padding-top: 6px; font-weight: bold; }
  .sig2 .sub { color: #6B7280; font-size: 11px; margin-top: 4px; }
</style>
</head>
<body>
${inner}
</body>
</html>`;
  }

  private receiptHtml(d: ReceiptData): string {
    const currency = d.currency ?? 'MXN';
    return `
  <h1>Recibo de Gratificación Extraordinaria Variable</h1>
  <div class="folio">MetaGEV · Folio: ${d.folio} · Periodo: ${d.periodLabel}</div>

  <p>Se hace constar que el colaborador <strong>${d.employeeName}</strong>, con puesto de
  <strong>${d.officialPosition}</strong>, ha recibido la siguiente cantidad:</p>

  <table>
    <tr><th>Concepto</th><th>Importe</th></tr>
    <tr>
      <td>Gratificación Extraordinaria Variable — ${d.periodLabel}</td>
      <td>${this.money(d.amount, currency)}</td>
    </tr>
  </table>

  <p class="legal">${LEGAL_CLAUSE}</p>

  <div class="signatures">
    <div class="sig">
      <div>Nombre: ${d.employeeName}</div>
      <div>Firma: ____________________________</div>
      <div>Fecha: ____ / ____ / ________</div>
    </div>
    <div class="sig">
      <div>Nombre (RRHH / Jefe):</div>
      <div>Firma: ____________________________</div>
      <div>Fecha: ____ / ____ / ________</div>
    </div>
  </div>`;
  }

  /** Versión compacta del recibo: media hoja carta (2 por hoja en el lote). */
  private receiptHalfHtml(d: ReceiptData): string {
    return `<div class="half">${this.receiptHtml(d)}\n</div>`;
  }

  private summaryHtml(
    items: BatchReceiptItem[],
    year: number,
    month: number,
    currency: string,
  ): string {
    const monthName = MONTHS_ES[month - 1] ?? String(month);
    const total = items.reduce((acc, it) => acc + it.amount, 0);
    const rows = items
      .map(
        (it, i) => `<tr>
      <td>${i + 1}</td>
      <td>${it.employeeName}</td>
      <td>${it.points !== null ? `${Number(it.points).toFixed(1)}%` : '—'}</td>
      <td>${this.money(it.amount, currency)}</td>
      <td class="paid"></td>
    </tr>`,
      )
      .join('\n    ');
    return `
  <div class="brand">MetaGEV</div>
  <h1>Concentrado de Gratificación Extraordinaria Variable</h1>
  <div class="period">Periodo: ${monthName} ${year}</div>

  <table>
    <tr>
      <th>#</th>
      <th>Colaborador</th>
      <th>Puntaje alcanzado</th>
      <th>Monto calculado</th>
      <th class="paid-col">Monto pagado</th>
    </tr>
    ${rows}
    <tr class="total-row">
      <td colspan="3">TOTAL</td>
      <td>${this.money(total, currency)}</td>
      <td class="paid"></td>
    </tr>
  </table>

  <p class="note">Nota: el monto pagado puede diferir del calculado por redondeo o ajuste de caja;
  anotar en la columna <strong>"Monto pagado"</strong> la cantidad realmente entregada a cada colaborador
  y el total pagado al final, para su anexión al corte de caja.</p>

  <div class="sig2">
    <div class="box">
      <div class="line">Encargado</div>
      <div class="sub">Nombre y firma</div>
    </div>
    <div class="box">
      <div class="line">Cajero</div>
      <div class="sub">Nombre y firma</div>
    </div>
  </div>`;
  }
}
