import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async validateUser(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: User) {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
      user: this.toProfile(user),
    };
  }

  signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>) {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '12h',
      },
    );
  }

  signRefreshToken(user: Pick<User, 'id' | 'email' | 'role'>) {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      },
    );
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token incorrecto');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
      user: this.toProfile(user),
    };
  }

  toProfile(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role as Role,
    };
  }

  /**
   * Recuperación de contraseña: genera token de un solo uso (válido 1 hora),
   * lo guarda hasheado y envía el enlace por correo. Responde siempre igual
   * para no revelar si el correo existe en el sistema.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Respuesta neutra aunque no exista el correo (anti-enumeración).
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
          passwordResetExpires: expires,
        },
      });
      const base =
        this.config.get<string>('FRONTEND_URL') ??
        this.config.get<string>('APP_URL') ??
        'http://localhost:5173';
      const resetUrl = `${base.replace(/\/$/, '')}/reset-password?token=${token}`;
      await this.notificationsService.sendPasswordReset(user.email, user.fullName, resetUrl);
    }
    return { ok: true, message: 'Si el correo existe, enviamos un enlace para restablecer tu contraseña' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new UnauthorizedException('El enlace es inválido o ya expiró. Solicita uno nuevo.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return { ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }
}
