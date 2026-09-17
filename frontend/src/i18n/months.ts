export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const monthLabel = (m: number) => MONTHS_ES[m - 1] ?? String(m);
export const monthShort = (m: number) => MONTHS_ES[m - 1]?.slice(0, 3) ?? String(m);
