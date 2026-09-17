import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { MyCurrentEvaluation, Scale } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../store/auth';
import { Badge, Button, Card, PageHeader } from '../../components/ui';

const SCALES: Scale[] = ['EXCELENTE', 'BUENO', 'REGULAR', 'NO_CUMPLIDO'];

const periodLabel = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

export function EvaluacionPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [periodId, setPeriodId] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['myEvaluation', periodId],
    queryFn: () =>
      api.get<MyCurrentEvaluation>(
        `/api/evaluations/my-current${periodId ? `?periodId=${periodId}` : ''}`,
      ),
  });

  const saveMutation = useMutation({
    mutationFn: ({ objectiveId, scale, comment }: { objectiveId: string; scale: Scale; comment?: string }) =>
      api.put(`/api/evaluations/my-current/items/${objectiveId}`, { scale, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEvaluation'] });
      setError('');
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post('/api/evaluations/my-current/submit', { periodId: data?.period?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myEvaluation'] });
      setNotice(t('evaluation.submittedOk'));
      setError('');
    },
    onError: (e) => {
      setNotice('');
      setError((e as unknown as ApiError).message);
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  if (!data?.period) {
    return (
      <Card>
        <p className="text-sm text-gray-600">{t('evaluation.noActivePeriod')}</p>
      </Card>
    );
  }

  const currentLabel = periodLabel(data.period.year, data.period.month);
  const pending = data.pendingPeriods ?? [];
  const blocked =
    data.selfEvaluation?.status === 'SUBMITTED' || data.period.status !== 'ACTIVE';
  const itemsByObjective = new Map(
    (data.selfEvaluation?.items ?? []).map((i) => [i.objectiveId, i]),
  );
  const complete = data.objectives.every((o) => itemsByObjective.has(o.id));

  return (
    <div>
      <PageHeader title={`${t('evaluation.title')} — ${currentLabel}`} />

      {pending.length > 0 && (
        <Card className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{t('evaluation.pendingPeriodsTitle')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPeriodId(undefined)}
              className={`px-3 py-1.5 rounded text-sm border ${
                !periodId || periodId === data.period.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {currentLabel}
            </button>
            {pending.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodId(p.id)}
                className={`px-3 py-1.5 rounded text-sm border ${
                  periodId === p.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {periodLabel(p.year, p.month)}
              </button>
            ))}
          </div>
        </Card>
      )}

      {data.objectives.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-700">{t('evaluation.noObjectivesAssigned')}</p>
        </Card>
      ) : blocked ? (
        <Card>
          <p className="text-sm text-gray-700">
            {data.selfEvaluation?.status === 'SUBMITTED'
              ? t('evaluation.submitted')
              : t('evaluation.blockedClosed')}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-600 mb-6">
            {t('evaluation.instructionsPersonal', { name: firstName })}
          </p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {notice && <p className="text-sm text-green-700 mb-4">{notice}</p>}
          <ul className="divide-y">
            {data.objectives.map((o) => {
              const item = itemsByObjective.get(o.id);
              return (
                <li key={o.id} className="py-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge text={o.importanceLevel.label} color={o.importanceLevel.colorHex} />
                    <div className="flex-1 text-sm font-medium">{o.description}</div>
                    <div className="text-xs text-gray-500">{o.points} pts</div>
                  </div>
                  {o.metric && <p className="text-xs text-gray-500 mb-3">{o.metric}</p>}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SCALES.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          saveMutation.mutate({
                            objectiveId: o.id,
                            scale: s,
                            comment: item?.comment ?? undefined,
                          })
                        }
                        className={`px-3 py-2 rounded text-sm border ${
                          item?.scale === s
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {t(`scales.${s}`)}
                      </button>
                    ))}
                  </div>
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder={t('evaluation.comment')}
                    defaultValue={item?.comment ?? ''}
                    onBlur={(e) => {
                      if (item && e.target.value !== (item.comment ?? '')) {
                        saveMutation.mutate({
                          objectiveId: o.id,
                          scale: item.scale,
                          comment: e.target.value,
                        });
                      }
                    }}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex items-center gap-4">
            <Button
              disabled={!complete || submitMutation.isPending || saveMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {t('evaluation.submit')}
            </Button>
            {!complete && (
              <span className="text-sm text-amber-700">{t('evaluation.missingItems')}</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
