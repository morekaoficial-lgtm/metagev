import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';

interface BranchRow {
  id: string;
  name: string;
  _count?: { profiles: number };
}

export function AdminBranchesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<BranchRow[]>('/api/branches'),
  });

  const mutation = useMutation({
    mutationFn: (payload: { name: string }) =>
      editingId
        ? api.patch(`/api/branches/${editingId}`, payload)
        : api.post('/api/branches', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setName('');
      setEditingId(null);
      setError('');
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/branches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name: name.trim() });
  };

  const startEdit = (b: BranchRow) => {
    setEditingId(b.id);
    setName(b.name);
    setError('');
  };

  const onDelete = (b: BranchRow) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    setError('');
    removeMutation.mutate(b.id);
  };

  return (
    <div>
      <PageHeader title={t('branches.title')} />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4 mb-6">
          <Field label={t('branches.name')}>
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('branches.placeholder')}
            />
          </Field>
          <Button type="submit" disabled={mutation.isPending}>
            {editingId ? t('common.save') : t('branches.add')}
          </Button>
          {editingId && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setName('');
              }}
            >
              {t('common.cancel')}
            </Button>
          )}
        </form>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <Table head={[t('branches.name'), t('branches.collaborators'), t('common.actions')]}>
            {branches?.map((b) => (
              <tr key={b.id}>
                <td className="py-2 pr-4 font-medium">{b.name}</td>
                <td className="py-2 pr-4">{b._count?.profiles ?? 0}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(b)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(b)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
