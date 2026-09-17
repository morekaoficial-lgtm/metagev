import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, downloadFile } from '../../api/client';
import { Period, PeriodResultRow, ReceiptRow } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, Field, PageHeader, Select, Table } from '../../components/ui';

function periodLabel(p: { year: number; month: number }): string {
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function AdminReceiptsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: () => api.get<Period[]>('/api/periods'),
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ['receipt-results', periodId],
    queryFn: () =>
      api.get<PeriodResultRow[]>(`/api/receipts/results?periodId=${periodId}`),
    enabled: !!periodId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['receipt-results', periodId] });
    queryClient.invalidateQueries({ queryKey: ['receipts', periodId] });
  };

  const generateOne = useMutation({
    mutationFn: (resultId: string) =>
      api.post<ReceiptRow>(`/api/receipts/result/${resultId}/generate`),
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const [batchFile, setBatchFile] = useState<string | null>(null);

  const generateAll = useMutation({
    mutationFn: () =>
      api.post<{ generated: number; batch: string | null }>(
        `/api/receipts/period/${periodId}/generate-all`,
      ),
    onSuccess: (data) => {
      setError('');
      setBatchFile(data.batch);
      setNotice(t('receipts.generatedAll', { count: data.generated }));
      invalidate();
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const pendingCount = results?.filter((r) => !r.receipt).length ?? 0;

  return (
    <div>
      <PageHeader title={t('receipts.title')} />
      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <Field label={t('analytics.selectPeriod')}>
            <Select
              value={periodId}
              onChange={(e) => {
                setPeriodId(e.target.value);
                setError('');
                setNotice('');
                setBatchFile(null);
              }}
            >
              <option value="">{t('common.select')}</option>
              {periods?.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            disabled={!periodId || pendingCount === 0 || generateAll.isPending}
            onClick={() => generateAll.mutate()}
          >
            {t('receipts.generateAll')}
          </Button>
          {batchFile && (
            <Button
              variant="secondary"
              onClick={() =>
                void downloadFile(
                  `/api/receipts/batch/${batchFile}/download`,
                  batchFile,
                  'open',
                )
              }
            >
              {t('receipts.batchDownload')}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {notice && <p className="text-sm text-green-700 mb-4">{notice}</p>}

        {!periodId ? (
          <p className="text-sm text-gray-500">{t('receipts.selectPeriodFirst')}</p>
        ) : isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : results && results.length > 0 ? (
          <Table
            head={[
              t('users.fullName'),
              t('receipts.folio'),
              t('receipts.amount'),
              t('receipts.status'),
              t('common.actions'),
            ]}
          >
            {results.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4">{r.employee.fullName}</td>
                <td className="py-2 pr-4">{r.receipt?.folio ?? '—'}</td>
                <td className="py-2 pr-4">
                  ${Number(r.finalAmount).toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 pr-4">
                  <Badge
                    text={r.receipt ? t('receipts.generated') : t('receipts.pending')}
                    color={r.receipt ? '#16A34A' : '#D97706'}
                  />
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    {r.receipt ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void downloadFile(
                              `/api/receipts/${r.receipt!.id}/download`,
                              `${r.receipt!.folio}.pdf`,
                            )
                          }
                        >
                          {t('receipts.download')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void downloadFile(
                              `/api/receipts/${r.receipt!.id}/download`,
                              `${r.receipt!.folio}.pdf`,
                              'open',
                            )
                          }
                        >
                          {t('receipts.print')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={generateOne.isPending}
                        onClick={() => generateOne.mutate(r.id)}
                      >
                        {t('receipts.generate')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-gray-500">{t('receipts.noResults')}</p>
        )}
      </Card>
    </div>
  );
}
