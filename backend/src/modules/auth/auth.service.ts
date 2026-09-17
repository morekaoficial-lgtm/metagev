import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
}
