import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PendingValidation } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, PageHeader, Table } from '../../components/ui';

export function ValidacionListPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['validationsPending'],
    queryFn: () => api.get<PendingValidation[]>('/api/validations/pending'),
    refetchInterval: 30000,
  });

  return (
    <div>
      <PageHeader title={t('validation.title')} />
      <Card>
        <h2 className="text-lg font-semibold mb-4">{t('validation.pending')}</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : data && data.length > 0 ? (
          <Table
            head={[
              t('validation.employee'),
              t('users.officialPosition'),
              t('validation.period'),
              t('validation.submittedAt'),
              t('common.actions'),
            ]}
          >
            {data.map((v) => (
              <tr key={v.id}>
                <td className="py-2 pr-4">{v.employee.fullName}</td>
                <td className="py-2 pr-4">{v.employee.profile?.officialPosition ?? '—'}</td>
                <td className="py-2 pr-4">
                  <Badge
                    text={`${v.period.year}-${String(v.period.month).padStart(2, '0')}`}
                    color="#3B82F6"
                  />
                </td>
                <td className="py-2 pr-4">
                  {v.submittedAt ? new Date(v.submittedAt).toLocaleString('es-MX') : '—'}
                </td>
                <td className="py-2 pr-4">
                  <Link to={`/validacion/${v.id}`}>
                    <Button variant="secondary">{t('validation.detail')}</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-gray-500">{t('validation.noPending')}</p>
        )}
      </Card>
    </div>
  );
}
