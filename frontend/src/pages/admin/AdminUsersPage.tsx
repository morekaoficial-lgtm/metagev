import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { Branch, Role, UserRow } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from '../../components/ui';

interface UserForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  directBossId: string;
  branchId: string;
  officialPosition: string;
  gratificationMaxMonthly: string;
  programStartDate: string;
  isActive: boolean;
}

const emptyForm: UserForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'COLABORADOR',
  directBossId: '',
  branchId: '',
  officialPosition: 'Ayudante General',
  gratificationMaxMonthly: '',
  programStartDate: '',
  isActive: true,
};

/** Roles que reciben gratificación: tienen perfil, objetivos y evaluación. El Dueño no. */
const EVALUABLE_ROLES: Role[] = ['COLABORADOR', 'JEFE', 'RRHH'];
const isEvaluable = (r: Role) => EVALUABLE_ROLES.includes(r);

export function AdminUsersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserRow[]>('/api/users'),
  });
  const { data: bosses } = useQuery({
    queryKey: ['bosses'],
    queryFn: () => api.get<{ id: string; fullName: string }[]>('/api/users/bosses'),
  });
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/api/branches'),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<UserForm>) =>
      editingId
        ? api.patch<UserRow>(`/api/users/${editingId}`, payload)
        : api.post<UserRow>('/api/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setError('');
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? '',
      password: '',
      role: u.role,
      directBossId: u.directBossId ?? '',
      branchId: u.profile?.branchId ?? '',
      officialPosition: u.profile?.officialPosition ?? 'Ayudante General',
      gratificationMaxMonthly: u.profile ? String(u.profile.gratificationMaxMonthly) : '',
      programStartDate: u.profile?.programStartDate
        ? u.profile.programStartDate.slice(0, 10)
        : '',
      isActive: u.isActive,
    });
    setShowForm(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      role: form.role,
      directBossId: form.directBossId || undefined,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;
    if (isEvaluable(form.role)) {
      payload.branchId = form.branchId || undefined;
      payload.officialPosition = form.officialPosition || 'Ayudante General';
      payload.gratificationMaxMonthly = form.gratificationMaxMonthly
        ? Number(form.gratificationMaxMonthly)
        : 0;
      payload.programStartDate = form.programStartDate || undefined;
    }
    mutation.mutate(payload);
  };

  return (
    <div>
      <PageHeader title={t('users.title')}>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(emptyForm);
            setError('');
          }}
        >
          {t('users.add')}
        </Button>
      </PageHeader>

      {showForm && (
        <Card>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('users.fullName')}>
              <Input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </Field>
            <Field label={t('users.email')}>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t('users.phone')}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label={editingId ? t('users.resetPassword') : t('auth.password')}>
              <Input
                type="password"
                placeholder={editingId ? t('users.resetPasswordHint') : undefined}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label={t('users.role')}>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {(['COLABORADOR', 'JEFE', 'RRHH', 'DUENO'] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('users.directBoss')}>
              <Select
                value={form.directBossId}
                onChange={(e) => setForm({ ...form, directBossId: e.target.value })}
              >
                <option value="">{t('common.select')}</option>
                {bosses?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            {isEvaluable(form.role) && (
              <>
                <Field label={t('users.branch')}>
                  <Select
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">{t('common.select')}</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('users.officialPosition')}>
                  <Input
                    value={form.officialPosition}
                    onChange={(e) => setForm({ ...form, officialPosition: e.target.value })}
                  />
                </Field>
                <Field label={t('users.maxMonthly')}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gratificationMaxMonthly}
                    onChange={(e) =>
                      setForm({ ...form, gratificationMaxMonthly: e.target.value })
                    }
                  />
                </Field>
                <Field label={t('users.programStartDate')}>
                  <Input
                    type="date"
                    value={form.programStartDate}
                    onChange={(e) => setForm({ ...form, programStartDate: e.target.value })}
                  />
                </Field>
              </>
            )}
            <Field label={t('users.isActive')}>
              <Select
                value={String(form.isActive)}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
              >
                <option value="true">{t('common.yes')}</option>
                <option value="false">{t('common.no')}</option>
              </Select>
            </Field>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {t('common.save')}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
          {!editingId && (
            <p className="text-xs text-gray-500 mt-3">{t('users.defaultPasswordNote')}</p>
          )}
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </Card>
      )}

      <Card>
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : (
          <Table
            head={[
              t('users.fullName'),
              t('users.email'),
              t('users.role'),
              t('users.directBoss'),
              t('users.branch'),
              t('users.officialPosition'),
              t('common.status'),
              t('common.actions'),
            ]}
          >
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-4">{u.fullName}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">{t(`roles.${u.role}`)}</td>
                <td className="py-2 pr-4">{u.directBoss?.fullName ?? '—'}</td>
                <td className="py-2 pr-4">{u.profile?.branch?.name ?? '—'}</td>
                <td className="py-2 pr-4">{u.profile?.officialPosition ?? '—'}</td>
                <td className="py-2 pr-4">
                  <Badge text={u.isActive ? t('catalog.active') : t('catalog.inactive')} color={u.isActive ? '#16A34A' : '#9CA3AF'} />
                </td>
                <td className="py-2 pr-4">
                  <Button variant="secondary" onClick={() => startEdit(u)}>
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
