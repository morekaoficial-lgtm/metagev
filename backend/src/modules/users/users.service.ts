import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const DEFAULT_PASSWORD = 'Cambiar123!';

/** Roles que reciben Gratificación Extraordinaria Variable (tienen perfil, objetivos y evaluación). */
export const EVALUABLE_ROLES: Array<'COLABORADOR' | 'JEFE' | 'RRHH'> = [
  'COLABORADOR',
  'JEFE',
  'RRHH',
];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { role?: string; branchId?: string; active?: string; evaluable?: string }) {
    const where: Prisma.UserWhereInput = {};
    if (filters.evaluable === 'true') {
      where.role = { in: EVALUABLE_ROLES };
    } else if (filters.role) {
      where.role = filters.role as never;
    }
    if (filters.active !== undefined) where.isActive = filters.active === 'true';
    if (filters.branchId) where.profile = { branchId: filters.branchId };

    return this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        directBossId: true,
        directBoss: { select: { id: true, fullName: true } },
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            officialPosition: true,
            gratificationMaxMonthly: true,
            programStartDate: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async bosses() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { in: ['JEFE', 'RRHH', 'DUENO'] } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('El correo ya está registrado');

    const password = dto.password ?? process.env.DEFAULT_USER_PASSWORD ?? DEFAULT_PASSWORD;
    const programStartDate = dto.programStartDate ? new Date(dto.programStartDate) : undefined;

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(password, 10),
        role: dto.role,
        directBossId: dto.directBossId,
        isActive: dto.isActive ?? true,
        profile:
          dto.role === 'COLABORADOR' || dto.role === 'JEFE' || dto.role === 'RRHH'
            ? {
                create: {
                  officialPosition: dto.officialPosition ?? 'Ayudante General',
                  gratificationMaxMonthly: dto.gratificationMaxMonthly ?? 0,
                  programStartDate: programStartDate ?? new Date(),
                  branchId: dto.branchId,
                },
              }
            : undefined,
      },
      select: this.selectWithProfile(),
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const programStartDate = dto.programStartDate ? new Date(dto.programStartDate) : undefined;
    const role = dto.role ?? user.role;
    const evaluable = role === 'COLABORADOR' || role === 'JEFE' || role === 'RRHH';

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        directBossId: dto.directBossId,
        isActive: dto.isActive,
        // El Dueño no recibe gratificación: solo roles evaluables llevan perfil.
        ...(evaluable
          ? {
              profile: {
                upsert: {
                  create: {
                    officialPosition: dto.officialPosition ?? 'Ayudante General',
                    gratificationMaxMonthly: dto.gratificationMaxMonthly ?? 0,
                    programStartDate: programStartDate ?? new Date(),
                    branchId: dto.branchId,
                  },
                  update: {
                    ...(dto.officialPosition !== undefined
                      ? { officialPosition: dto.officialPosition }
                      : {}),
                    ...(dto.gratificationMaxMonthly !== undefined
                      ? { gratificationMaxMonthly: dto.gratificationMaxMonthly }
                      : {}),
                    ...(programStartDate !== undefined ? { programStartDate } : {}),
                    ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
                  },
                },
              },
            }
          : {}),
      },
      select: this.selectWithProfile(),
    });
  }

  private selectWithProfile() {
    return {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      directBossId: true,
      directBoss: { select: { id: true, fullName: true } },
      isActive: true,
      createdAt: true,
      profile: {
        select: {
          officialPosition: true,
          gratificationMaxMonthly: true,
          programStartDate: true,
          branchId: true,
          branch: { select: { id: true, name: true } },
        },
      },
    } as const;
  }
}
