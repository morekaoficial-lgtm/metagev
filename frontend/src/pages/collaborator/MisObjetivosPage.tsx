import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { MyCurrentEvaluation } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { monthLabel } from '../../i18n/months';
import { useAuth } from '../../store/auth';
import { Badge, Button, Card, PageHeader } from '../../components/ui';

const fmt = (n: number) =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MisObjetivosPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const { data, isLoading } = useQuery({
    queryKey: ['myEvaluation'],
    queryFn: () => api.get<MyCurrentEvaluation>('/api/evaluations/my-current'),
    refetchInterval: 60000,
  });

  if (isLoading) return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  if (!data?.period) {
    return <Card><p className="text-sm text-gray-600">{t('myObjectives.noActivePeriod')}</p></Card>;
  }

  const closed = data.period.status !== 'ACTIVE';
  const projected = data.projected;
  const hasLiveAmount = projected?.amount !== null && projected?.amount !== undefined;
  const hasPotential = projected?.potentialMax !== null && projected?.potentialMax !== undefined;

  return (
    <div>
      <PageHeader
        title={t('myObjectives.personalTitle', {
          name: firstName,
          month: monthLabel(data.period.month),
          year: data.period.year,
        })}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-sm text-gray-500">
            {projected?.isFinal ? t('myObjectives.finalAmount') : t('myObjectives.projectedAmount')}
          </div>
          <div className="text-2xl font-semibold mt-1">
            {hasLiveAmount ? fmt(projected.amount as number) : hasPotential ? fmt(projected.potentialMax as number) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {projected?.isFinal
              ? t('myObjectives.closedNotice')
              : hasLiveAmount && hasPotential
                ? `${t('myObjectives.liveProjection')} · ${t('myObjectives.ofMax', { max: fmt(projected.potentialMax as number) })}`
                : hasPotential
                  ? t('myObjectives.maxAt100')
                  : ''}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">{t('myObjectives.daysToClose')}</div>
          <div className="text-2xl font-semibold mt-1">{projected?.daysToClose ?? '—'}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">{t('common.status')}</div>
          <div className="mt-2">
            <Badge
              text={
                data.selfEvaluation
                  ? t(`selfEvaluationStatus.${data.selfEvaluation.status}`)
                  : t('selfEvaluationStatus.PENDING')
              }
              color={
                data.selfEvaluation?.status === 'SUBMITTED'
                  ? '#16A34A'
                  : data.selfEvaluation?.status === 'IN_PROGRESS'
                    ? '#F97316'
                    : '#9CA3AF'
              }
            />
          </div>
          <div className="mt-4">
            <Link to="/evaluacion">
              <Button>{t('myObjectives.goToEvaluation')}</Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">{t('menu.myObjectives')}</h2>
        {data.objectives.length === 0 ? (
          <p className="text-sm text-gray-500">{t('myObjectives.noObjectives')}</p>
        ) : (
          <ul className="divide-y">
            {data.objectives.map((o) => (
              <li key={o.id} className="py-4 flex items-start gap-4">
                <span
                  className="mt-1 inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: o.importanceLevel.colorHex }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{o.description}</div>
                  {o.metric && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t('myObjectives.metric')}: {o.metric}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <Badge text={o.importanceLevel.label} color={o.importanceLevel.colorHex} />
                  <div className="text-xs text-gray-500 mt-1">
                    {o.points} {t('objectives.points').toLowerCase()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {closed && (
          <p className="text-sm text-amber-700 mt-4">{t('evaluation.blockedClosed')}</p>
        )}
      </Card>
    </div>
  );
}
