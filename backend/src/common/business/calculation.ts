import { Scale } from '@prisma/client';

/** Mapeo fijo de escala a porcentaje. */
export const SCALE_PERCENT: Record<Scale, number> = {
  EXCELENTE: 100,
  BUENO: 80,
  REGULAR: 50,
  NO_CUMPLIDO: 0,
};

export const SCALES: Scale[] = ['EXCELENTE', 'BUENO', 'REGULAR', 'NO_CUMPLIDO'];

/**
 * Motor de puntos — método del residuo mayor (largest remainder).
 * Reparte exactamente 100 puntos entre los objetivos proporcionalmente a su peso.
 */
export function calculatePoints(weights: number[]): number[] {
  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);

  const raw = weights.map((w) => (100 * w) / total);
  const points = raw.map((r) => Math.floor(r));
  let remainder = 100 - points.reduce((acc, p) => acc + p, 0);

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

/**
 * Factor de prorrateo: aplica SOLO si la fecha de alta al programa cae
 * dentro del mes del periodo evaluado.
 * factor = (diasDelMes - diaAlta + 1) / diasDelMes
 */
export function prorationFactor(
  programStartDate: Date,
  periodYear: number,
  periodMonth: number,
): number {
  const start = new Date(programStartDate);
  if (start.getFullYear() === periodYear && start.getMonth() + 1 === periodMonth) {
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const factor = (daysInMonth - start.getDate() + 1) / daysInMonth;
    return Math.round(factor * 10000) / 10000;
  }
  return 1;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ResultItemSnapshot {
  objectiveId: string;
  description: string;
  scale: Scale;
  percent: number;
  points: number;
  weighted: number;
}

/** total_points = Σ(points * percent / 100) */
export function totalPoints(items: ResultItemSnapshot[]): number {
  return round2(items.reduce((acc, i) => acc + (i.points * i.percent) / 100, 0));
}
