import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { HistoryDetail, MyHistory } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { monthLabel, monthShort } from '../../i18n/months';
import { useAuth } from '../../store/auth';
import { Card, PageHeader, Select, Table } from '../../components/ui';

/** Orden dentro de cada grupo: No cumplido primero, luego Regular. */
const OPPORTUNITY_ORDER: Record<string, number> = { NO_CUMPLIDO: 0, REGULAR: 1 };

export function HistoricoPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const [year, setYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['myHistory', year],
    queryFn: () =>
      api.get<MyHistory>(year ? `/api/evaluations/history?year=${year}` : '/api/evaluations/history'),
  });

  const { data: detail } = useQuery({
    queryKey: ['myHistoryDetail', data?.year, selectedMonth],
    queryFn: () => api.get<HistoryDetail>(`/api/evaluations/history/${data?.year}/${selectedMonth}`),
    enabled: data != null && selectedMonth !== null,
  });

  if (isLoading) return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  if (!data) return <Card><p className="text-sm text-gray-600">{t('common.error')}</p></Card>;

  const years = data.availableYears.length > 0 ? data.availableYears : [data.year];
  const hasAnyResult = data.months.some((m) => m.points !== null);
  const toggleMonth = (m: number) =>
    setSelectedMonth(selectedMonth === m ? null : m);

  return (
    <div>
      <PageHeader title={t('history.title')}>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t('history.year')}</label>
          <Select
            value={String(data.year)}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </PageHeader>

      {!hasAnyResult ? (
        <Card>
          <p className="text-sm text-gray-600">
            {t('history.noData', { year: data.year })}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <div className="text-sm text-gray-500">{t('history.average')}</div>
              <div className="text-2xl font-semibold mt-1">
                {data.yearAverage !== null ? `${data.yearAverage}%` : '—'}
              </div>
            </Card>
            <Card>
              <div className="text-sm text-gray-500">{t('history.position')}</div>
              <div className="text-lg font-semibold mt-1">
                {data.yearRank !== null
                  ? t('history.myPosition', {
                      rank: data.yearRank,
                      total: data.yearTotal,
                      year: data.year,
                    })
                  : '—'}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-base font-semibold mb-4">
              {firstName ? `${firstName} · ` : ''}{data.year}
            </h2>
            {/* Gráfica de barras: % de cumplimiento por mes (solo porcentajes, sin dinero).
                Clic en un mes con resultado abre su detalle. */}
            <div className="flex items-end gap-1 sm:gap-2 h-40 sm:h-52 mb-2">
              {data.months.map((m) => {
                const selectable = m.points !== null;
                const isSelected = selectedMonth === m.month;
                return (
                  <button
                    key={m.month}
                    type="button"
                    disabled={!selectable}
                    onClick={() => toggleMonth(m.month)}
                    title={selectable ? t('history.viewDetail') : undefined}
                    className={`flex-1 flex flex-col items-center gap-1 h-full ${
                      selectable ? 'cursor-pointer' : 'cursor-default opacity-40'
                    } ${isSelected ? '' : selectable ? 'opacity-90 hover:opacity-100' : ''}`}
                  >
                    <div className="text-[10px] sm:text-xs font-medium text-gray-700">
                      {m.points !== null ? `${m.points}%` : ''}
                    </div>
                    <div
                      className={`w-full flex-1 rounded-t relative overflow-hidden ${
                        isSelected ? 'bg-indigo-100' : 'bg-gray-100'
                      }`}
                    >
                      <div
                        className={`absolute bottom-0 left-0 w-full rounded-t transition-all ${
                          isSelected ? 'bg-indigo-700' : 'bg-indigo-500'
                        }`}
                        style={{ height: `${m.points ?? 0}%` }}
                      />
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 truncate w-full text-center">{monthShort(m.month)}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <Table
              head={[t('history.month'), t('history.compliance'), t('history.position'), '']}
            >
              {data.months
                .filter((m) => m.points !== null)
                .map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 pr-4">{monthLabel(m.month)}</td>
                    <td className="py-2 pr-4 font-medium">{m.points}%</td>
                    <td className="py-2 pr-4">
                      {m.rank !== null
                        ? t('history.ofTotal', { rank: m.rank, total: m.total })
                        : t('history.noPosition')}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleMonth(m.month)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        {selectedMonth === m.month ? '▲' : t('history.viewDetail')}
                      </button>
                    </td>
                  </tr>
                ))}
            </Table>
          </Card>

          {selectedMonth !== null && (
            <Card>
              <h3 className="text-base font-semibold mb-1">
                {t('history.detailTitle', {
                  month: monthLabel(selectedMonth),
                  year: data.year,
                })}
              </h3>
              {!detail || detail.items.length === 0 ? (
                <p className="text-sm text-gray-600 mt-2">{t('history.noDetail')}</p>
              ) : (
                /* Grupos por calificación recibida (no por puntos):
                   NO_CUMPLIDO + REGULAR → áreas de oportunidad · BUENO → neutro · EXCELENTE → felicitación */
                (() => {
                  const opportunity = detail.items
                    .filter((i) => i.scale === 'NO_CUMPLIDO' || i.scale === 'REGULAR')
                    .sort((a, b) => (OPPORTUNITY_ORDER[a.scale] ?? 0) - (OPPORTUNITY_ORDER[b.scale] ?? 0));
                  const bueno = detail.items.filter((i) => i.scale === 'BUENO');
                  const excelente = detail.items.filter((i) => i.scale === 'EXCELENTE');
                  const groups = [
                    {
                      key: 'opportunity',
                      items: opportunity,
                      title: t('history.opportunityTitle', { name: firstName }),
                      className: 'text-red-700',
                    },
                    {
                      key: 'bueno',
                      items: bueno,
                      title: t('history.groupBueno'),
                      className: 'text-gray-700',
                    },
                    {
                      key: 'excelente',
                      items: excelente,
                      title: t('history.congratsTitle', { name: firstName }),
                      className: 'text-green-700',
                    },
                  ];
                  return (
                    <div className="mt-4 space-y-6">
                      {groups.map((g) =>
                        g.items.length === 0 ? null : (
                          <div key={g.key}>
                            <div className={`text-sm font-semibold mb-2 ${g.className}`}>
                              {g.title}
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                ({g.items.length})
                              </span>
                            </div>
                            <ul className="divide-y">
                              {g.items.map((i) => (
                                <li key={i.objectiveId} className="py-2">
                                  <div className="text-sm">{i.description}</div>
                                  {i.comment && (
                                    <div className="text-xs text-gray-500 mt-0.5 italic">
                                      {t('history.commentLabel')}: {i.comment}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ),
                      )}
                    </div>
                  );
                })()
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
