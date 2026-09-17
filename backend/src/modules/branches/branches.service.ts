import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { profiles: true } } },
    });
  }

  async create(dto: CreateBranchDto) {
    const exists = await this.prisma.branch.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('La sucursal ya existe');
    return this.prisma.branch.create({ data: dto });
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return this.prisma.branch.update({ where: { id }, data: { name: dto.name } });
  }

  async remove(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { profiles: true } } },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    if (branch._count.profiles > 0) {
      throw new ConflictException('No se puede eliminar: tiene colaboradores asignados');
    }
    await this.prisma.branch.delete({ where: { id } });
    return { ok: true };
  }
}
