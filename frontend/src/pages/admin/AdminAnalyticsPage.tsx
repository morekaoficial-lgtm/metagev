import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, downloadFile } from '../../api/client';
import { Branch, Heatmap, LeaderboardRow, Period, UserRow } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Button, Card, Field, PageHeader, Select, Table } from '../../components/ui';

function cellColor(value: number | null): string {
  if (value === null) return '#F3F4F6';
  const pct = Math.max(0, Math.min(100, value));
  return `rgba(22, 163, 74, ${0.15 + (pct / 100) * 0.75})`;
}

export function AdminAnalyticsPage() {
  const { t } = useI18n();
  const [periodId, setPeriodId] = useState('');
  const [bossId, setBossId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: () => api.get<Period[]>('/api/periods'),
  });
  const { data: bosses } = useQuery({
    queryKey: ['bosses'],
    queryFn: () => api.get<UserRow[]>('/api/users/bosses'),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/api/branches'),
  });

  const { data: heatmap } = useQuery({
    queryKey: ['heatmap', periodId],
    queryFn: () => api.get<Heatmap>(`/api/analytics/heatmap?periodId=${periodId}`),
    enabled: !!periodId,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', bossId, branchId, from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (bossId) params.set('bossId', bossId);
      if (branchId) params.set('branchId', branchId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return api.get<LeaderboardRow[]>(`/api/analytics/leaderboard?${params.toString()}`);
    },
  });

  const [exportError, setExportError] = useState('');

  const onExport = async () => {
    setExportError('');
    try {
      await downloadFile(
        `/api/analytics/export.csv?periodId=${periodId}`,
        'evaluacion-periodo.csv',
      );
    } catch (e) {
      setExportError((e as Error).message || t('common.error'));
    }
  };

  return (
    <div>
      <PageHeader title={t('analytics.title')} />
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <Field label={t('analytics.selectPeriod')}>
              <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <option value="">{t('common.select')}</option>
                {periods?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.year}-{String(p.month).padStart(2, '0')}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" disabled={!periodId} onClick={() => void onExport()}>
              {t('common.exportCsv')}
            </Button>
          </div>
          {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

          <h2 className="text-lg font-semibold mb-3">{t('analytics.heatmap')}</h2>
          {heatmap && heatmap.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4 font-medium">Nivel</th>
                    {heatmap.branches.map((b) => (
                      <th key={b} className="py-2 pr-4 font-medium">
                        {b}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.rows.map((row) => (
                    <tr key={row.level} className="border-b">
                      <td className="py-2 pr-4">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: row.color }}
                        >
                          {row.level}
                        </span>
                      </td>
                      {row.cells.map((value, i) => (
                        <td key={i} className="py-2 pr-4">
                          <span
                            className="inline-block px-3 py-1 rounded"
                            style={{ backgroundColor: cellColor(value) }}
                          >
                            {value === null ? '—' : `${value}%`}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('analytics.noData')}</p>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3">{t('analytics.leaderboard')}</h2>
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <Field label={t('analytics.filterBoss')}>
              <Select value={bossId} onChange={(e) => setBossId(e.target.value)}>
                <option value="">{t('common.all')}</option>
                {bosses?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('analytics.filterBranch')}>
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">{t('common.all')}</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('analytics.filterFrom')}>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('analytics.filterTo')}>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {leaderboard && leaderboard.length > 0 ? (
            <Table
              head={['#', t('users.fullName'), t('users.officialPosition'), t('analytics.branch'), t('analytics.average'), t('analytics.periodsEvaluated')]}
            >
              {leaderboard.map((row, index) => (
                <tr key={row.employeeId}>
                  <td className="py-2 pr-4">{index + 1}</td>
                  <td className="py-2 pr-4">{row.fullName}</td>
                  <td className="py-2 pr-4">{row.officialPosition}</td>
                  <td className="py-2 pr-4">{row.branch || '—'}</td>
                  <td className="py-2 pr-4 font-medium">{row.average}</td>
                  <td className="py-2 pr-4">{row.periods}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <p className="text-sm text-gray-500">{t('analytics.noData')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
