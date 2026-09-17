/* Delta del seed: agrega Dueño, perfiles GEV de jefes/RRHH y sus objetivos en sep-2026.
   Idempotente: no duplica si ya existe la autoevaluación del periodo. */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const SCALE_PERCENT = { EXCELENTE: 100, BUENO: 80, REGULAR: 50, NO_CUMPLIDO: 0 };

function calculatePoints(weights) {
  const total = weights.reduce((a, w) => a + w, 0);
  const raw = weights.map((w) => (100 * w) / total);
  const points = raw.map((r) => Math.floor(r));
  let remainder = 100 - points.reduce((a, p) => a + p, 0);
  const order = raw
    .map((r, index) => ({ index, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    points[order[k % order.length].index] += 1;
    remainder -= 1;
    k += 1;
  }
  return points;
}

async function main() {
  const password = await bcrypt.hash('Demo1234', 10);

  const dueno = await prisma.user.upsert({
    where: { email: 'dueno@demo.gev' },
    update: { role: 'DUENO' },
    create: {
      fullName: 'Ricardo Fuentes', email: 'dueno@demo.gev', phone: '555 010 0001',
      passwordHash: password, role: 'DUENO',
    },
  });

  const rrhh = await prisma.user.findUnique({ where: { email: 'admin@demo.gev' } });
  const jefeCarlos = await prisma.user.findUnique({ where: { email: 'carlos.mendoza@demo.gev' } });
  const jefeAna = await prisma.user.findUnique({ where: { email: 'ana.torres@demo.gev' } });
  const matriz = await prisma.branch.findUnique({ where: { name: 'Matriz' } });
  const sep = await prisma.evaluationPeriod.findUnique({ where: { year_month: { year: 2026, month: 9 } } });

  await prisma.user.update({ where: { id: rrhh.id }, data: { directBossId: dueno.id } });

  for (const p of [
    { userId: jefeCarlos.id, monto: 8000 },
    { userId: jefeAna.id, monto: 8000 },
    { userId: rrhh.id, monto: 10000 },
  ]) {
    await prisma.employeeProfile.upsert({
      where: { userId: p.userId },
      update: { gratificationMaxMonthly: p.monto },
      create: {
        userId: p.userId, gratificationMaxMonthly: p.monto,
        programStartDate: new Date('2026-01-15'), branchId: matriz.id,
      },
    });
  }

  const niveles = {};
  for (const l of await prisma.importanceLevel.findMany()) niveles[l.label] = l;

  const DEFS_JEFE = [
    { description: 'Cumplimiento de metas del equipo asignado', metric: '% objetivos del equipo cumplidos', nivel: 'Crítico', peso: 4 },
    { description: 'Supervisión y retroalimentación semanal al personal', metric: 'Sesiones de retroalimentación realizadas', nivel: 'Alto', peso: 3 },
    { description: 'Control de ausentismo y puntualidad del área', metric: '% asistencia del equipo', nivel: 'Alto', peso: 3 },
    { description: 'Reportes operativos semanales a RRHH', metric: 'Reportes entregados antes del cierre', nivel: 'Medio', peso: 2 },
    { description: 'Cumplimiento del presupuesto de operación del área', metric: '% gasto vs presupuesto', nivel: 'Medio', peso: 2 },
  ];
  const DEFS_RRHH = [
    { description: 'Oportunidad en la validación de evaluaciones', metric: '% evaluaciones validadas antes del día 11', nivel: 'Crítico', peso: 4 },
    { description: 'Captura y actualización de objetivos del personal', metric: '% personal con objetivos a tiempo', nivel: 'Crítico', peso: 4 },
    { description: 'Atención de solicitudes del personal', metric: 'Solicitudes atendidas en 48h', nivel: 'Alto', peso: 3 },
    { description: 'Conciliación de recibos de gratificación', metric: 'Recibos emitidos sin error', nivel: 'Alto', peso: 3 },
    { description: 'Mejora continua del programa de gratificación', metric: 'Propuestas de mejora documentadas', nivel: 'Bajo', peso: 1 },
  ];

  async function crearObjetivos(periodId, empleadoId, defs) {
    const points = calculatePoints(defs.map((d) => d.peso));
    const objs = [];
    for (let i = 0; i < defs.length; i++) {
      objs.push(await prisma.objective.create({
        data: {
          periodId, employeeId: empleadoId,
          description: defs[i].description, metric: defs[i].metric,
          importanceLevelId: niveles[defs[i].nivel].id,
          relativeWeight: defs[i].peso, points: points[i], createdById: rrhh.id,
        },
      }));
    }
    return objs;
  }

  async function crearAutoeval(periodId, empleadoId, scales, status, objectives) {
    return prisma.selfEvaluation.create({
      data: {
        periodId, employeeId: empleadoId, status,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
        items: {
          create: objectives.map((o, i) => ({
            objectiveId: o.id, scale: scales[i], percent: SCALE_PERCENT[scales[i]],
            comment: scales[i] === 'NO_CUMPLIDO' ? 'Pendiente por alcance del programa' : null,
          })),
        },
      },
    });
  }

  // Carlos (jefe): enviada → bandeja de RRHH
  const existCarlos = await prisma.selfEvaluation.findUnique({
    where: { periodId_employeeId: { periodId: sep.id, employeeId: jefeCarlos.id } },
  });
  if (!existCarlos) {
    const objs = await crearObjetivos(sep.id, jefeCarlos.id, DEFS_JEFE);
    await crearAutoeval(sep.id, jefeCarlos.id, ['EXCELENTE', 'BUENO', 'BUENO', 'EXCELENTE', 'REGULAR'], 'SUBMITTED', objs);
    console.log('jefeCarlos: objetivos + autoeval SUBMITTED');
  }

  // Ana (jefe): en progreso
  const existAna = await prisma.selfEvaluation.findUnique({
    where: { periodId_employeeId: { periodId: sep.id, employeeId: jefeAna.id } },
  });
  if (!existAna) {
    const objs = await crearObjetivos(sep.id, jefeAna.id, DEFS_JEFE);
    await prisma.selfEvaluation.create({
      data: {
        periodId: sep.id, employeeId: jefeAna.id, status: 'IN_PROGRESS',
        items: { create: [{ objectiveId: objs[0].id, scale: 'BUENO', percent: 80 }] },
      },
    });
    console.log('jefeAna: objetivos + autoeval IN_PROGRESS');
  }

  // RRHH (admin): enviada → bandeja del Dueño
  const existRRHH = await prisma.selfEvaluation.findUnique({
    where: { periodId_employeeId: { periodId: sep.id, employeeId: rrhh.id } },
  });
  if (!existRRHH) {
    const objs = await crearObjetivos(sep.id, rrhh.id, DEFS_RRHH);
    await crearAutoeval(sep.id, rrhh.id, ['BUENO', 'EXCELENTE', 'BUENO', 'EXCELENTE', 'BUENO'], 'SUBMITTED', objs);
    console.log('rrhh: objetivos + autoeval SUBMITTED');
  }

  console.log('[delta] Dueño listo: dueno@demo.gev / Demo1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
