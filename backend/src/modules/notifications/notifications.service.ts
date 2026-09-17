import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') ?? 'no-reply@gev.local';
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get<string>('SMTP_PORT') ?? 587),
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP no configurado: los correos se imprimirán en consola (modo desarrollo).');
    }
  }

  async sendObjectivesAssigned(to: string, employeeName: string, periodLabel: string) {
    return this.deliver(to, 'Asignación de objetivos — Evaluación', {
      type: 'OBJECTIVES_ASSIGNED',
      html: `<p>Hola ${employeeName},</p>
<p>Tus objetivos del periodo <strong>${periodLabel}</strong> han sido asignados.
Ingresa a la plataforma en la sección <strong>Mis Objetivos</strong> para revisarlos.</p>`,
    });
  }

  async sendReminder(to: string, employeeName: string, periodLabel: string, daysLeft: number) {
    return this.deliver(to, 'Recordatorio — Evaluación pendiente', {
      type: 'REMINDER_DAY_7',
      html: `<p>Hola ${employeeName},</p>
<p>Tu evaluación del periodo <strong>${periodLabel}</strong> aún no ha sido enviada.
Quedan <strong>${daysLeft} días para el cierre</strong>. Envíala desde la sección <strong>Evaluación</strong>.</p>`,
    });
  }

  async sendReceiptReady(to: string, employeeName: string, folio: string) {
    return this.deliver(to, 'Recibo generado — Gratificación Extraordinaria Variable', {
      type: 'RECEIPT_READY',
      html: `<p>Hola ${employeeName},</p>
<p>Tu recibo con folio <strong>${folio}</strong> por concepto de <strong>Gratificación Extraordinaria Variable</strong> ha sido generado.</p>`,
    });
  }

  private async deliver(
    to: string,
    subject: string,
    content: { type: string; html: string },
  ) {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({ from: this.from, to, subject, html: content.html });
        await this.log(to, content.type, 'SENT');
        return;
      } catch (e) {
        this.logger.error(`Error enviando correo a ${to}: ${(e as Error).message}`);
        await this.log(to, content.type, 'FAILED');
        return;
      }
    }
    // Fallback desarrollo: consola.
    this.logger.log(`[correo simulado] Para: ${to} | Asunto: ${subject}\n${content.html}`);
    await this.log(to, content.type, 'SIMULATED');
  }

  private async log(to: string, type: string, status: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email: to } });
      if (!user) return;
      await this.prisma.notificationLog.create({
        data: { userId: user.id, type, payload: { to }, status },
      });
    } catch {
      // Nunca romper el flujo principal por el log de notificaciones.
    }
  }
}
