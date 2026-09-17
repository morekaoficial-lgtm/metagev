import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateImportanceLevelDto, UpdateImportanceLevelDto } from './dto/importance-level.dto';

@Injectable()
export class ImportanceLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  list(all = false) {
    return this.prisma.importanceLevel.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { relativeWeight: 'desc' },
    });
  }

  async create(dto: CreateImportanceLevelDto, createdById: string) {
    const dup = await this.prisma.importanceLevel.findFirst({ where: { label: dto.label } });
    if (dup) throw new ConflictException('Ya existe un nivel con esa etiqueta');
    return this.prisma.importanceLevel.create({
      data: { ...dto, createdById },
    });
  }

  async update(id: string, dto: UpdateImportanceLevelDto) {
    const level = await this.prisma.importanceLevel.findUnique({ where: { id } });
    if (!level) throw new NotFoundException('Nivel no encontrado');
    return this.prisma.importanceLevel.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const level = await this.prisma.importanceLevel.findUnique({
      where: { id },
      include: { _count: { select: { objectives: true } } },
    });
    if (!level) throw new NotFoundException('Nivel no encontrado');
    if (level._count.objectives > 0) {
      // Baja lógica para preservar el historial de objetivos existentes.
      return this.prisma.importanceLevel.update({ where: { id }, data: { isActive: false } });
    }
    await this.prisma.importanceLevel.delete({ where: { id } });
    return { ok: true };
  }
}
