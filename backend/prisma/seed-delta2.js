/* Delta 2: objetivos de jefes/RRHH en oct-2026 (periodo activo actual) */
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

const DEFS_JEFE = [
  { description: 'Cumplimiento de metas del equipo asignado', metric: '% objetivos del equipo cumplidos', nivel: 'Crítico', peso: 4 },
  { description: 'Supervisión y retroalimentación semanal al personal', metric: 'Sesiones realizadas', nivel: 'Alto', peso: 3 },
  { description: 'Control de ausentismo y puntualidad del área', metric: '% asistencia del equipo', nivel: 'Alto', peso: 3 },
  { description: 'Reportes operativos semanales a RRHH', metric: 'Reportes entregados a tiempo', nivel: 'Medio', peso: 2 },
  { description: 'Cumplimiento del presupuesto de operación del área', metric: '% gasto vs presupuesto', nivel: 'Medio', peso: 2 },
];
const DEFS_RRHH = [
  { description: 'Oportunidad en la validación de evaluaciones', metric: '% validadas antes del día 11', nivel: 'Crítico', peso: 4 },
  { description: 'Captura y actualización de objetivos del personal', metric: '% personal con objetivos a tiempo', nivel: 'Crítico', peso: 4 },
  { description: 'Atención de solicitudes del personal', metric: 'Solicitudes atendidas en 48h', nivel: 'Alto', peso: 3 },
  { description: 'Conciliación de recibos de gratificación', metric: 'Recibos emitidos sin error', nivel: 'Alto', peso: 3 },
  { description: 'Mejora continua del programa de gratificación', metric: 'Propuestas documentadas', nivel: 'Bajo', peso: 1 },
];

async function main() {
  const rrhh = await prisma.user.findUnique({ where: { email: 'admin@demo.gev' } });
  const jefeCarlos = await prisma.user.findUnique({ where: { email: 'carlos.mendoza@demo.gev' } });
  const jefeAna = await prisma.user.findUnique({ where: { email: 'ana.torres@demo.gev' } });
  const oct = await prisma.evaluationPeriod.findUnique({ where: { year_month: { year: 2026, month: 10 } } });
  const niveles = {};
  for (const l of await prisma.importanceLevel.findMany()) niveles[l.label] = l;

  async function crearObjetivos(empleadoId, defs) {
    const existing = await prisma.objective.count({ where: { periodId: oct.id, employeeId: empleadoId } });
    if (existing > 0) { console.log(`ya tiene ${existing} objetivos en oct-2026, se omite`); return null; }
    const points = calculatePoints(defs.map((d) => d.peso));
    const objs = [];
    for (let i = 0; i < defs.length; i++) {
      objs.push(await prisma.objective.create({
        data: {
          periodId: oct.id, employeeId: empleadoId,
          description: defs[i].description, metric: defs[i].metric,
          importanceLevelId: niveles[defs[i].nivel].id,
          relativeWeight: defs[i].peso, points: points[i], createdById: rrhh.id,
        },
      }));
    }
    return objs;
  }

  async function autoeval(empleadoId, scales, status, objectives) {
    const exist = await prisma.selfEvaluation.findUnique({
      where: { periodId_employeeId: { periodId: oct.id, employeeId: empleadoId } },
    });
    if (exist) return;
    await prisma.selfEvaluation.create({
      data: {
        periodId: oct.id, employeeId: empleadoId, status,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
        items: {
          create: objectives.map((o, i) => ({
            objectiveId: o.id, scale: scales[i], percent: SCALE_PERCENT[scales[i]],
          })),
        },
      },
    });
  }

  const oCarlos = await crearObjetivos(jefeCarlos.id, DEFS_JEFE);
  if (oCarlos) await autoeval(jefeCarlos.id, ['EXCELENTE', 'BUENO', 'BUENO', 'EXCELENTE', 'REGULAR'], 'SUBMITTED', oCarlos);

  const oAna = await crearObjetivos(jefeAna.id, DEFS_JEFE);
  if (oAna) await autoeval(jefeAna.id, ['BUENO', 'BUENO', 'EXCELENTE', 'BUENO', 'EXCELENTE'], 'IN_PROGRESS', oAna);

  const oRRHH = await crearObjetivos(rrhh.id, DEFS_RRHH);
  if (oRRHH) await autoeval(rrhh.id, ['BUENO', 'EXCELENTE', 'BUENO', 'EXCELENTE', 'BUENO'], 'SUBMITTED', oRRHH);

  console.log('[delta2] oct-2026: jefes y RRHH con objetivos y autoevaluaciones listas');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
