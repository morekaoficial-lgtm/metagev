import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { Scale, ValidationDetail } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, PageHeader, Table } from '../../components/ui';

const SCALES: Scale[] = ['EXCELENTE', 'BUENO', 'REGULAR', 'NO_CUMPLIDO'];

export function ValidacionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [validatorScales, setValidatorScales] = useState<Record<string, Scale>>({});
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['validationDetail', id],
    queryFn: () => api.get<ValidationDetail>(`/api/validations/${id}`),
  });

  const decideMutation = useMutation({
    mutationFn: (payload: { items: { objectiveId: string; scale: Scale }[]; justification?: string }) =>
      api.post<{ receiptError?: string | null }>(`/api/validations/${id}/decide`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['validationsPending'] });
      setError('');
      setNotice(
        data?.receiptError
          ? `${t('validation.decided')} — ${t('validation.receiptPending')}`
          : t('validation.decided'),
      );
      setTimeout(() => navigate('/validacion'), 2500);
    },
    onError: (e) => {
      setNotice('');
      setError((e as unknown as ApiError).message);
    },
  });

  if (isLoading || !data) return <p className="text-sm text-gray-500">{t('common.loading')}</p>;

  const { selfEvaluation, objectives } = data;
  const employeeItems = new Map(selfEvaluation.items.map((i) => [i.objectiveId, i]));
  const modified = objectives.some(
    (o) => validatorScales[o.id] && validatorScales[o.id] !== employeeItems.get(o.id)?.scale,
  );
  const justificationRequired = modified;
  const periodLabel = `${selfEvaluation.period.year}-${String(selfEvaluation.period.month).padStart(2, '0')}`;

  const scaleFor = (objectiveId: string): Scale =>
    validatorScales[objectiveId] ?? employeeItems.get(objectiveId)?.scale ?? 'NO_CUMPLIDO';

  const onDecide = () => {
    decideMutation.mutate({
      items: objectives.map((o) => ({ objectiveId: o.id, scale: scaleFor(o.id) })),
      justification: justification.trim() || undefined,
    });
  };

  return (
    <div>
      <PageHeader title={`${t('validation.detail')} — ${selfEvaluation.employee.fullName} (${periodLabel})`} />
      <div className="space-y-6">
        <Card>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {notice && <p className="text-sm text-green-700 mb-4">{notice}</p>}
          <Table
            head={[
              t('objectives.description'),
              t('validation.points'),
              `${t('validation.employeeView')} · ${t('menu.evaluation')}`,
              `${t('validation.validatorView')} · ${t('menu.evaluation')}`,
            ]}
          >
            {objectives.map((o) => {
              const employeeItem = employeeItems.get(o.id);
              const validatorScale = scaleFor(o.id);
              return (
                <tr key={o.id}>
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium">{o.description}</div>
                    <Badge text={o.importanceLevel.label} color={o.importanceLevel.colorHex} />
                  </td>
                  <td className="py-2 pr-4">{o.points}</td>
                  <td className="py-2 pr-4">
                    {employeeItem ? (
                      <Badge
                        text={t(`scales.${employeeItem.scale}`)}
                        color={
                          employeeItem.scale === 'EXCELENTE'
                            ? '#16A34A'
                            : employeeItem.scale === 'BUENO'
                              ? '#3B82F6'
                              : employeeItem.scale === 'REGULAR'
                                ? '#F97316'
                                : '#EF4444'
                        }
                      />
                    ) : (
                      '—'
                    )}
                    {employeeItem?.comment && (
                      <p className="text-xs text-gray-500 mt-1">{employeeItem.comment}</p>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1.5">
                      {SCALES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setValidatorScales({ ...validatorScales, [o.id]: s })}
                          className={`px-2.5 py-1 rounded text-xs border ${
                            validatorScale === s
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {t(`scales.${s}`)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card>
          <label className="block mb-3">
            <span className="block text-sm font-medium text-gray-700 mb-1">
              {t('validation.justification')}
              {justificationRequired && <span className="text-red-600"> *</span>}
            </span>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <span className="block text-xs text-gray-500 mt-1">
              {t('validation.justificationRequired')}
            </span>
          </label>
          <div className="flex items-center gap-4">
            <Button
              disabled={
                decideMutation.isPending || (justificationRequired && justification.trim().length === 0)
              }
              onClick={onDecide}
            >
              {t('validation.approve')}
            </Button>
            {modified && (
              <Badge text={t('validation.modifiedMarker')} color="#F97316" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
