import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { Period } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from '../../components/ui';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF',
  ACTIVE: '#16A34A',
  CLOSED: '#3B82F6',
  AUTO_CLOSED: '#EF4444',
};

export function AdminPeriodsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [error, setError] = useState('');

  const { data: periods, isLoading } = useQuery({
    queryKey: ['periods'],
    queryFn: () => api.get<Period[]>('/api/periods'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/periods', { year: Number(year), month: Number(month) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods'] }),
    onError: (e) => setError((e as unknown as ApiError).message),
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/periods/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods'] }),
    onError: (e) => setError((e as unknown as ApiError).message),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/periods/${id}/close`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods'] }),
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate();
  };

  return (
    <div>
      <PageHeader title={t('periods.title')} />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4 mb-6">
          <Field label={t('periods.year')}>
            <Input
              required
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
          <Field label={t('periods.month')}>
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={createMutation.isPending}>
            {t('periods.create')}
          </Button>
        </form>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <Table
            head={[
              t('periods.year'),
              t('periods.month'),
              t('common.status'),
              t('periods.objectivesCount'),
              t('periods.evaluationsCount'),
              t('periods.resultsCount'),
              t('common.actions'),
            ]}
          >
            {periods?.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-4">{p.year}</td>
                <td className="py-2 pr-4">{p.month}</td>
                <td className="py-2 pr-4">
                  <Badge
                    text={t(`periodStatus.${p.status}`)}
                    color={STATUS_COLORS[p.status] ?? '#6B7280'}
                  />
                </td>
                <td className="py-2 pr-4">{p._count?.objectives ?? 0}</td>
                <td className="py-2 pr-4">{p._count?.selfEvaluations ?? 0}</td>
                <td className="py-2 pr-4">{p._count?.results ?? 0}</td>
                <td className="py-2 pr-4 flex gap-2">
                  {p.status === 'DRAFT' && (
                    <Button onClick={() => activateMutation.mutate(p.id)}>
                      {t('periods.activate')}
                    </Button>
                  )}
                  {p.status === 'ACTIVE' && (
                    <Button variant="danger" onClick={() => closeMutation.mutate(p.id)}>
                      {t('periods.close')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
