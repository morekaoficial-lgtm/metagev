/* Seed DEMO para el entorno de prueba.
   Crea jefes, colaboradores, 2 periodos (ago-2026 cerrado, sep-2026 activo),
   objetivos ponderados a 100 puntos y evaluaciones en distintos estados.
   Password de todos los usuarios demo: Demo1234 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SCALE_PERCENT = { EXCELENTE: 100, BUENO: 80, REGULAR: 50, NO_CUMPLIDO: 0 };
const round2 = (n) => Math.round(n * 100) / 100;

/* Misma lógica del backend: reparte exactamente 100 puntos (residuo mayor). */
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

function snapshotItems(objectives, scales) {
  return objectives.map((o, i) => {
    const percent = SCALE_PERCENT[scales[i]];
    return {
      objectiveId: o.id,
      description: o.description,
      scale: scales[i],
      percent,
      points: Number(o.points),
      weighted: round2((Number(o.points) * percent) / 100),
    };
  });
}

function totalPoints(items) {
  return round2(items.reduce((a, i) => a + (i.points * i.percent) / 100, 0));
}

async function main() {
  const password = await bcrypt.hash('Demo1234', 10);
  const rrhh = await prisma.user.findUnique({ where: { email: 'admin@demo.gev' } });

  // ---- Sucursales ----
  const matriz = await prisma.branch.findUnique({ where: { name: 'Matriz' } });
  const norte = await prisma.branch.upsert({ where: { name: 'Norte' }, update: {}, create: { name: 'Norte' } });
  const sur = await prisma.branch.upsert({ where: { name: 'Sur' }, update: {}, create: { name: 'Sur' } });

  // ---- Niveles ----
  const niveles = {};
  for (const l of await prisma.importanceLevel.findMany()) niveles[l.label] = l;

  // ---- Jefes ----
  const mkUser = (data) => prisma.user.upsert({ where: { email: data.email }, update: {}, create: data });
  const jefeCarlos = await mkUser({
    fullName: 'Carlos Mendoza', email: 'carlos.mendoza@demo.gev', phone: '555 010 2233',
    passwordHash: password, role: 'JEFE',
  });
  const jefeAna = await mkUser({
    fullName: 'Ana Torres', email: 'ana.torres@demo.gev', phone: '555 010 4477',
    passwordHash: password, role: 'JEFE',
  });

  // ---- Dueño (máxima figura: acceso total y valida a RRHH) ----
  const dueno = await mkUser({
    fullName: 'Ricardo Fuentes', email: 'dueno@demo.gev', phone: '555 010 0001',
    passwordHash: password, role: 'DUENO',
  });
  // RRHH reporta al Dueño (cadena de validación: Dueño → RRHH → Jefes → Colaboradores).
  await prisma.user.update({ where: { id: rrhh.id }, data: { directBossId: dueno.id } });

  // ---- Perfiles de gratificación para jefes y RRHH (también reciben GEV) ----
  for (const p of [
    { userId: jefeCarlos.id, monto: 8000 },
    { userId: jefeAna.id, monto: 8000 },
    { userId: rrhh.id, monto: 10000 },
  ]) {
    await prisma.employeeProfile.upsert({
      where: { userId: p.userId },
      update: {},
      create: {
        userId: p.userId, gratificationMaxMonthly: p.monto,
        programStartDate: new Date('2026-01-15'), branchId: matriz.id,
      },
    });
  }

  // ---- Colaboradores ----
  const colaboradores = [
    { nombre: 'Juan Pérez', email: 'juan.perez@demo.gev', jefe: jefeCarlos, branch: matriz, monto: 5000, alta: '2026-01-15' },
    { nombre: 'María García', email: 'maria.garcia@demo.gev', jefe: jefeCarlos, branch: matriz, monto: 5000, alta: '2026-01-15' },
    { nombre: 'Luis Hernández', email: 'luis.hernandez@demo.gev', jefe: jefeCarlos, branch: norte, monto: 4500, alta: '2026-02-01' },
    { nombre: 'Ana Martínez', email: 'ana.martinez@demo.gev', jefe: jefeCarlos, branch: norte, monto: 4000, alta: '2026-03-10' },
    { nombre: 'Carlos López', email: 'carlos.lopez@demo.gev', jefe: jefeAna, branch: norte, monto: 4000, alta: '2026-01-20' },
    { nombre: 'Sofía Ramírez', email: 'sofia.ramirez@demo.gev', jefe: jefeAna, branch: sur, monto: 6000, alta: '2026-01-15' },
    { nombre: 'Pedro Sánchez', email: 'pedro.sanchez@demo.gev', jefe: jefeAna, branch: sur, monto: 4200, alta: '2026-09-10' },
    { nombre: 'Laura Torres', email: 'laura.torres@demo.gev', jefe: jefeAna, branch: sur, monto: 3800, alta: '2026-04-05' },
  ];
  for (const c of colaboradores) {
    const user = await mkUser({
      fullName: c.nombre, email: c.email, phone: '555 010 5566',
      passwordHash: password, role: 'COLABORADOR', directBossId: c.jefe.id,
    });
    c.id = user.id;
    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id, gratificationMaxMonthly: c.monto,
        programStartDate: new Date(c.alta), branchId: c.branch.id,
      },
    });
  }
  const byEmail = (e) => colaboradores.find((c) => c.email === e);

  // ---- Definiciones de objetivos ----
  const DEFS = [
    { description: 'Cumplimiento del surtido de pedidos según programa diario', metric: '% pedidos surtidos el mismo día', nivel: 'Crítico', peso: 4 },
    { description: 'Precisión en inventario cíclico semanal', metric: '% exactitud de conteo', nivel: 'Alto', peso: 3 },
    { description: 'Orden y limpieza del área asignada', metric: 'Checklist diario sin incidencias', nivel: 'Medio', peso: 2 },
    { description: 'Atención a solicitudes del jefe directo', metric: 'Solicitudes atendidas en 24h', nivel: 'Alto', peso: 3 },
    { description: 'Cuidado del equipo y materiales', metric: 'Sin reportes de daño por mal uso', nivel: 'Medio', peso: 2 },
  ];
  const DEFS_PRORRATEO = [
    { description: 'Cumplimiento del surtido de pedidos según programa diario', metric: '% pedidos surtidos el mismo día', nivel: 'Crítico', peso: 4 },
    { description: 'Precisión en inventario cíclico semanal', metric: '% exactitud de conteo', nivel: 'Alto', peso: 3 },
    { description: 'Orden y limpieza del área asignada', metric: 'Checklist diario sin incidencias', nivel: 'Medio', peso: 2 },
    { description: 'Apoyo en cargas y descargas', metric: 'Asistencia a operaciones programadas', nivel: 'Medio', peso: 2 },
    { description: 'Reporte de incidencias del área', metric: 'Reportes entregados antes del cierre', nivel: 'Bajo', peso: 1 },
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
    const ev = await prisma.selfEvaluation.create({
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
    return ev;
  }

  // ---- Periodo SEP-2026 (activo) ----
  const sep = await prisma.evaluationPeriod.upsert({
    where: { year_month: { year: 2026, month: 9 } },
    update: { status: 'ACTIVE' },
    create: { year: 2026, month: 9, status: 'ACTIVE' },
  });

  const juan = byEmail('juan.perez@demo.gev');
  const maria = byEmail('maria.garcia@demo.gev');
  const luis = byEmail('luis.hernandez@demo.gev');
  const anam = byEmail('ana.martinez@demo.gev');
  const carlosL = byEmail('carlos.lopez@demo.gev');
  const sofia = byEmail('sofia.ramirez@demo.gev');
  const pedro = byEmail('pedro.sanchez@demo.gev');
  const laura = byEmail('laura.torres@demo.gev');

  // Juan: enviada, pendiente de validación
  const objsJuan = await crearObjetivos(sep.id, juan.id, DEFS);
  await crearAutoeval(sep.id, juan.id, ['EXCELENTE', 'EXCELENTE', 'BUENO', 'EXCELENTE', 'REGULAR'], 'SUBMITTED', objsJuan);

  // María: enviada y VALIDADA por el jefe (con modificación justificada)
  const objsMaria = await crearObjetivos(sep.id, maria.id, DEFS);
  const evMaria = await crearAutoeval(sep.id, maria.id, ['EXCELENTE', 'BUENO', 'REGULAR', 'BUENO', 'EXCELENTE'], 'SUBMITTED', objsMaria);
  const scalesValidadorMaria = ['EXCELENTE', 'BUENO', 'BUENO', 'BUENO', 'EXCELENTE'];
  const valMaria = await prisma.validation.create({
    data: {
      selfEvaluationId: evMaria.id, validatorId: jefeCarlos.id,
      justification: 'El inventario cíclico se completó con observaciones menores; ajusto a Bueno conforme a evidencia del 30 de septiembre.',
      items: {
        create: objsMaria.map((o, i) => ({
          objectiveId: o.id, scale: scalesValidadorMaria[i], percent: SCALE_PERCENT[scalesValidadorMaria[i]],
        })),
      },
    },
  });
  const snapEmpMaria = snapshotItems(objsMaria, ['EXCELENTE', 'BUENO', 'REGULAR', 'BUENO', 'EXCELENTE']);
  const snapValMaria = snapshotItems(objsMaria, scalesValidadorMaria);
  const tpMaria = totalPoints(snapValMaria);
  await prisma.evaluationResult.create({
    data: {
      periodId: sep.id, employeeId: maria.id,
      employeeVersion: { items: snapEmpMaria }, validatorVersion: { items: snapValMaria },
      validatedById: jefeCarlos.id, totalPointsEarned: tpMaria,
      prorationFactor: 1, proratedMax: 5000, finalAmount: round2(tpMaria * 50),
      closeReason: 'MANUAL', closedAt: new Date('2026-09-12T10:00:00Z'),
    },
  });

  // Luis: en progreso (3 de 5 capturados)
  const objsLuis = await crearObjetivos(sep.id, luis.id, DEFS);
  await prisma.selfEvaluation.create({
    data: {
      periodId: sep.id, employeeId: luis.id, status: 'IN_PROGRESS',
      items: {
        create: objsLuis.slice(0, 3).map((o, i) => ({
          objectiveId: o.id, scale: ['BUENO', 'BUENO', 'EXCELENTE'][i],
          percent: SCALE_PERCENT[['BUENO', 'BUENO', 'EXCELENTE'][i]],
        })),
      },
    },
  });

  // Ana M.: en progreso (1 capturado)
  const objsAnaM = await crearObjetivos(sep.id, anam.id, DEFS);
  await prisma.selfEvaluation.create({
    data: {
      periodId: sep.id, employeeId: anam.id, status: 'IN_PROGRESS',
      items: {
        create: [{ objectiveId: objsAnaM[0].id, scale: 'EXCELENTE', percent: 100 }],
      },
    },
  });

  // Carlos L.: sin iniciar (PENDING)
  await crearObjetivos(sep.id, carlosL.id, DEFS);

  // Sofía: enviada, pendiente de validación
  const objsSofia = await crearObjetivos(sep.id, sofia.id, DEFS);
  await crearAutoeval(sep.id, sofia.id, ['BUENO', 'EXCELENTE', 'EXCELENTE', 'BUENO', 'EXCELENTE'], 'SUBMITTED', objsSofia);

  // Pedro: alta 10-sep → prorrateo 21/30 = 0.7, enviada
  const objsPedro = await crearObjetivos(sep.id, pedro.id, DEFS_PRORRATEO);
  await crearAutoeval(sep.id, pedro.id, ['BUENO', 'BUENO', 'EXCELENTE', 'REGULAR', 'NO_CUMPLIDO'], 'SUBMITTED', objsPedro);

  // Laura: sin iniciar (PENDING)
  await crearObjetivos(sep.id, laura.id, DEFS);

  // ---- Objetivos para jefes y RRHH (también reciben GEV) — periodo SEP-2026 ----
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

  // Carlos (jefe): enviada → aparece en la bandeja de RRHH
  const objsCarlosJ = await crearObjetivos(sep.id, jefeCarlos.id, DEFS_JEFE);
  await crearAutoeval(sep.id, jefeCarlos.id, ['EXCELENTE', 'BUENO', 'BUENO', 'EXCELENTE', 'REGULAR'], 'SUBMITTED', objsCarlosJ);

  // Ana (jefe): en progreso
  const objsAnaJ = await crearObjetivos(sep.id, jefeAna.id, DEFS_JEFE);
  await prisma.selfEvaluation.create({
    data: {
      periodId: sep.id, employeeId: jefeAna.id, status: 'IN_PROGRESS',
      items: { create: [{ objectiveId: objsAnaJ[0].id, scale: 'BUENO', percent: 80 }] },
    },
  });

  // RRHH (admin): enviada → aparece en la bandeja del Dueño
  const objsRRHH = await crearObjetivos(sep.id, rrhh.id, DEFS_RRHH);
  await crearAutoeval(sep.id, rrhh.id, ['BUENO', 'EXCELENTE', 'BUENO', 'EXCELENTE', 'BUENO'], 'SUBMITTED', objsRRHH);

  // ---- Periodo AGO-2026 (cerrado, para analítica) ----
  const ago = await prisma.evaluationPeriod.upsert({
    where: { year_month: { year: 2026, month: 8 } },
    update: { status: 'CLOSED' },
    create: { year: 2026, month: 8, status: 'CLOSED' },
  });
  const crearResultadoAgo = async (colaborador, scales, validatedBy) => {
    const objs = await crearObjetivos(ago.id, colaborador.id, DEFS);
    const ev = await crearAutoeval(ago.id, colaborador.id, scales, 'SUBMITTED', objs);
    const snap = snapshotItems(objs, scales);
    const tp = totalPoints(snap);
    const max = colaborador.monto;
    await prisma.validation.create({
      data: {
        selfEvaluationId: ev.id, validatorId: validatedBy,
        justification: 'Conforme a evidencia del periodo.',
        items: { create: objs.map((o, i) => ({ objectiveId: o.id, scale: scales[i], percent: SCALE_PERCENT[scales[i]] })) },
      },
    });
    await prisma.evaluationResult.create({
      data: {
        periodId: ago.id, employeeId: colaborador.id,
        employeeVersion: { items: snap }, validatorVersion: { items: snap },
        validatedById: validatedBy, totalPointsEarned: tp,
        prorationFactor: 1, proratedMax: max, finalAmount: round2(tp * (max / 100)),
        closeReason: 'MANUAL', closedAt: new Date('2026-08-11T10:00:00Z'),
      },
    });
  };
  await crearResultadoAgo(juan, ['EXCELENTE', 'BUENO', 'BUENO', 'EXCELENTE', 'BUENO'], jefeCarlos.id);
  await crearResultadoAgo(maria, ['BUENO', 'BUENO', 'EXCELENTE', 'BUENO', 'EXCELENTE'], jefeCarlos.id);
  await crearResultadoAgo(sofia, ['EXCELENTE', 'EXCELENTE', 'BUENO', 'BUENO', 'REGULAR'], jefeAna.id);

  // Carlos L. en ago: auto-cierre al 0%
  const objsCarlosAgo = await crearObjetivos(ago.id, carlosL.id, DEFS);
  await prisma.selfEvaluation.create({
    data: { periodId: ago.id, employeeId: carlosL.id, status: 'PENDING' },
  });
  await prisma.evaluationResult.create({
    data: {
      periodId: ago.id, employeeId: carlosL.id,
      employeeVersion: { items: [] }, validatorVersion: null,
      validatedById: null, totalPointsEarned: 0,
      prorationFactor: 1, proratedMax: 4000, finalAmount: 0,
      closeReason: 'AUTO_CLOSED', closedAt: new Date('2026-08-11T00:05:00Z'),
    },
  });

  console.log('[demo-seed] Datos demo creados: 1 dueño, 2 jefes, 8 colaboradores, periodos ago-2026 (cerrado) y sep-2026 (activo).');
  console.log('[demo-seed] Password de todos los usuarios demo: Demo1234 | Admin RRHH: admin@demo.gev / Admin123! | Dueño: dueno@demo.gev');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
