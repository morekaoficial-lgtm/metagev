/* Seed inicial: admin RRHH, niveles de importancia por defecto y sucursal Matriz. */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gev.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  const branch = await prisma.branch.upsert({
    where: { name: 'Matriz' },
    update: {},
    create: { name: 'Matriz' },
  });

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        fullName: 'Administrador RRHH',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: 'RRHH',
      },
    });
    console.log(`[seed] Usuario RRHH creado: ${adminEmail}`);
  }

  const levels = [
    { label: 'Crítico', relativeWeight: 4, colorHex: '#EF4444' },
    { label: 'Alto', relativeWeight: 3, colorHex: '#F97316' },
    { label: 'Medio', relativeWeight: 2, colorHex: '#EAB308' },
    { label: 'Bajo', relativeWeight: 1, colorHex: '#3B82F6' },
  ];
  for (const level of levels) {
    const found = await prisma.importanceLevel.findFirst({ where: { label: level.label } });
    if (!found) {
      await prisma.importanceLevel.create({ data: level });
    }
  }

  console.log('[seed] Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
