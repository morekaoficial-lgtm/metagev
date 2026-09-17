import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { TeamHistory, TeamMemberHistory } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { monthLabel, monthShort } from '../../i18n/months';
import { Card, Loading, PageHeader, Select } from '../../components/ui';

const pct = (v: number) => `${v.toFixed(1)}%`;

function scaleColor(v: number): string {
  if (v >= 90) return '#059669'; // excelente
  if (v >= 70) return '#2563EB'; // bueno
  if (v >= 50) return '#D97706'; // regular
  return '#DC2626'; // no cumplido
}

function average(vals: (number | null)[]): number | null {
  const clean = vals.filter((v): v is number => v !== null);
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function TeamHistoricoPage() {
  const { t } = useI18n();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | ''>('');
  const [memberId, setMemberId] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['team-history', year],
    queryFn: () =>
      api.get<TeamHistory>(
        `/api/evaluations/team-history${year ? `?year=${year}` : ''}`,
      ),
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title={t('team.title')} />
        <Loading />
      </div>
    );
  }

  const members = data.members;
  const periodValue = (m: TeamMemberHistory): number | null =>
    month === '' ? m.yearAverage : (m.months[month - 1]?.points ?? null);
  const valued = members
    .map((m) => ({ m, v: periodValue(m) }))
    .filter((x): x is { m: TeamMemberHistory; v: number } => x.v !== null);
  const periodAvg = average(valued.map((x) => x.v));
  const best = valued.length
    ? [...valued].sort((a, b) => b.v - a.v)[0]
    : null;
  const selected = memberId ? members.find((m) => m.employeeId === memberId) : null;
  const sorted = [...members].sort((a, b) => {
    const va = periodValue(a);
    const vb = periodValue(b);
    if (va === null && vb === null) return a.fullName.localeCompare(b.fullName);
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t('team.title')} />

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{t('team.year')}</span>
            <Select
              value={year ?? data.year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {(data.availableYears.length ? data.availableYears : [data.year]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{t('team.month')}</span>
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{t('team.monthAll')}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{t('team.member')}</span>
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">{t('team.memberAll')}</option>
              {members.map((m) => (
                <option key={m.employeeId} value={m.employeeId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {members.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">{t('team.noMembers')}</p>
        </Card>
      ) : selected ? (
        /* Detalle de un colaborador: 12 meses en barras verticales */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="text-sm text-gray-500">
                {month === '' ? t('team.yearAvgLabel') : `${t('team.monthResult')} · ${monthLabel(month)}`}
              </div>
              <div className="text-3xl font-semibold mt-1">
                {periodValue(selected) !== null ? pct(periodValue(selected) as number) : '—'}
              </div>
            </Card>
            <Card>
              <div className="text-sm text-gray-500">{t('team.yearAvgLabel')}</div>
              <div className="text-3xl font-semibold mt-1">
                {selected.yearAverage !== null ? pct(selected.yearAverage) : '—'}
              </div>
            </Card>
          </div>
          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="font-semibold">{selected.fullName}</div>
                {selected.position && (
                  <div className="text-xs text-gray-500">{selected.position}</div>
                )}
              </div>
              <div className="text-sm text-gray-500">{data.year}</div>
            </div>
            <div className="flex items-end gap-1 sm:gap-2 h-40 sm:h-52 mb-2">
              {selected.months.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setMonth(m.points === null ? '' : m.month)}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${monthLabel(m.month)}: ${m.points !== null ? pct(m.points) : t('team.noData')}`}
                >
                  <div className="text-[10px] sm:text-xs font-medium text-gray-700">
                    {m.points !== null ? Math.round(m.points) : ''}
                  </div>
                  <div
                    className={`w-full rounded-t transition-all ${
                      month === m.month ? 'ring-2 ring-gray-800' : ''
                    }`}
                    style={{
                      height: `${m.points ?? 0}%`,
                      backgroundColor: m.points !== null ? scaleColor(m.points) : '#E5E7EB',
                    }}
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 truncate w-full text-center">
                    {monthShort(m.month)}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* Todos: barras horizontales ordenadas por el periodo seleccionado */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="text-sm text-gray-500">{t('team.periodAvg')}</div>
              <div className="text-3xl font-semibold mt-1">
                {periodAvg !== null ? pct(periodAvg) : '—'}
              </div>
              {month !== '' && (
                <div className="text-xs text-gray-400">{monthLabel(month)} {data.year}</div>
              )}
            </Card>
            <Card>
              <div className="text-sm text-gray-500">{t('team.evaluated')}</div>
              <div className="text-3xl font-semibold mt-1">
                {valued.length} <span className="text-base font-normal text-gray-400">{t('team.of')} {members.length}</span>
              </div>
            </Card>
            <Card>
              <div className="text-sm text-gray-500">{t('team.best')}</div>
              <div className="text-3xl font-semibold mt-1">
                {best ? pct(best.v) : '—'}
              </div>
              {best && <div className="text-xs text-gray-400 truncate">{best.m.fullName}</div>}
            </Card>
          </div>

          <Card>
            <div className="space-y-4">
              {sorted.map((m) => {
                const v = periodValue(m);
                return (
                  <div key={m.employeeId}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate">{m.fullName}</span>
                        {m.position && (
                          <span className="text-xs text-gray-400 ml-2 truncate">{m.position}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {v !== null ? pct(v) : t('team.noData')}
                      </span>
                    </div>
                    <div className="bg-gray-200 rounded h-3 overflow-hidden">
                      <div
                        className="h-3 rounded transition-all"
                        style={{
                          width: `${v ?? 0}%`,
                          backgroundColor: v !== null ? scaleColor(v) : '#E5E7EB',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
