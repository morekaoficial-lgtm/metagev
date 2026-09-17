import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { ImportanceLevel } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';

interface LevelForm {
  label: string;
  relativeWeight: string;
  colorHex: string;
  isActive: boolean;
}

const empty: LevelForm = { label: '', relativeWeight: '1', colorHex: '#3B82F6', isActive: true };

export function AdminCatalogPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LevelForm>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: levels, isLoading } = useQuery({
    queryKey: ['levels'],
    queryFn: () => api.get<ImportanceLevel[]>('/api/importance-levels?all=true'),
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingId
        ? api.patch(`/api/importance-levels/${editingId}`, payload)
        : api.post('/api/importance-levels', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['levels'] });
      setForm(empty);
      setEditingId(null);
      setError('');
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const startEdit = (l: ImportanceLevel) => {
    setEditingId(l.id);
    setForm({
      label: l.label,
      relativeWeight: String(l.relativeWeight),
      colorHex: l.colorHex,
      isActive: l.isActive,
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      label: form.label,
      relativeWeight: Number(form.relativeWeight),
      colorHex: form.colorHex,
      isActive: form.isActive,
    });
  };

  return (
    <div>
      <PageHeader title={t('catalog.title')} />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4 mb-6">
          <Field label={t('catalog.label')}>
            <Input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
          <Field label={t('catalog.relativeWeight')}>
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.relativeWeight}
              onChange={(e) => setForm({ ...form, relativeWeight: e.target.value })}
            />
          </Field>
          <Field label={t('catalog.colorHex')}>
            <Input
              type="color"
              value={form.colorHex}
              onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
              className="h-10 w-20 p-1 border border-gray-300 rounded"
            />
          </Field>
          <Button type="submit" disabled={mutation.isPending}>
            {editingId ? t('common.save') : t('catalog.add')}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>
              {t('common.cancel')}
            </Button>
          )}
        </form>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <Table head={[t('catalog.label'), t('catalog.relativeWeight'), t('catalog.colorHex'), t('common.status'), t('common.actions')]}>
            {levels?.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-4">
                  <Badge text={l.label} color={l.colorHex} />
                </td>
                <td className="py-2 pr-4">{l.relativeWeight}</td>
                <td className="py-2 pr-4">{l.colorHex}</td>
                <td className="py-2 pr-4">
                  <Badge
                    text={l.isActive ? t('catalog.active') : t('catalog.inactive')}
                    color={l.isActive ? '#16A34A' : '#9CA3AF'}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Button variant="secondary" onClick={() => startEdit(l)}>
                    {t('common.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
