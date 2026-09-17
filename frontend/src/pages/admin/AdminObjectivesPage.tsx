import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import { AuditEntry, ImportanceLevel, Objective, Period, UserRow } from '../../api/types';
import { useI18n } from '../../i18n/I18nContext';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from '../../components/ui';

interface ObjectiveForm {
  description: string;
  metric: string;
  importanceLevelId: string;
  relativeWeight: string;
}

const emptyForm: ObjectiveForm = {
  description: '',
  metric: '',
  importanceLevelId: '',
  relativeWeight: '1',
};

export function AdminObjectivesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [form, setForm] = useState<ObjectiveForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAudit, setShowAudit] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<UserRow[]>('/api/users?evaluable=true&active=true'),
  });
  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: () => api.get<Period[]>('/api/periods'),
  });
  const { data: levels } = useQuery({
    queryKey: ['levels'],
    queryFn: () => api.get<ImportanceLevel[]>('/api/importance-levels'),
  });

  const selected = !!(employeeId && periodId);
  const { data: objectives, isLoading } = useQuery({
    queryKey: ['objectives', periodId, employeeId],
    queryFn: () => api.get<Objective[]>(`/api/objectives?periodId=${periodId}&employeeId=${employeeId}`),
    enabled: selected,
  });
  const { data: audit } = useQuery({
    queryKey: ['objectiveAudit', periodId, employeeId],
    queryFn: () =>
      api.get<AuditEntry[]>(`/api/objectives/audit?periodId=${periodId}&employeeId=${employeeId}`),
    enabled: selected && showAudit,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['objectives', periodId, employeeId] });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editingId
        ? api.patch(`/api/objectives/${editingId}`, payload)
        : api.post('/api/objectives', { ...payload, periodId, employeeId }),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setEditingId(null);
      setError('');
      setNotice(t('objectives.saved'));
    },
    onError: (e) => {
      setNotice('');
      setError((e as unknown as ApiError).message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/objectives/${id}`),
    onSuccess: invalidate,
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post('/api/objectives/duplicate-from-last-month', { periodId, employeeId }),
    onSuccess: () => {
      invalidate();
      setError('');
    },
    onError: (e) => setError((e as unknown as ApiError).message),
  });

  const recalcMutation = useMutation({
    mutationFn: () =>
      api.post<{ count: number; totalPoints: number }>('/api/objectives/recalculate', {
        periodId,
        employeeId,
      }),
    onSuccess: (d) => {
      invalidate();
      setError('');
      setNotice(t('objectives.recalculated', { count: d.count, total: d.totalPoints }));
    },
    onError: (e) => {
      setNotice('');
      setError((e as unknown as ApiError).message);
    },
  });

  const selectedEmployee = employees?.find((e) => e.id === employeeId);
  const selectedPeriod = periods?.find((p) => p.id === periodId);

  const fmtMoney = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /** Prorrateo por alta a mitad de mes (misma regla del backend). */
  const proration = useMemo(() => {
    if (!selectedPeriod || !selectedEmployee?.profile?.programStartDate) return 1;
    const raw = selectedEmployee.profile.programStartDate.slice(0, 10).split('-').map(Number);
    if (raw.length !== 3 || raw.some(Number.isNaN)) return 1;
    const [y, m, d] = raw;
    if (y === selectedPeriod.year && m === selectedPeriod.month) {
      const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month, 0).getDate();
      return Math.round(((daysInMonth - d + 1) / daysInMonth) * 10000) / 10000;
    }
    return 1;
  }, [selectedEmployee, selectedPeriod]);

  const maxMonthly = Number(selectedEmployee?.profile?.gratificationMaxMonthly ?? 0);
  const proratedMax = maxMonthly * proration;
  const objectiveValue = (points: number) => (proratedMax * points) / 100;

  const preview = useMemo(() => {
    if (!objectives || objectives.length === 0) return [];
    const weights = objectives.map(
      (o) => Number(o.relativeWeight) * Number(o.importanceLevel.relativeWeight),
    );
    const total = weights.reduce((acc, w) => acc + w, 0);
    return objectives.map((o, i) => ({
      id: o.id,
      label: o.description.slice(0, 40),
      pct: total > 0 ? Math.round((weights[i] / total) * 10000) / 100 : 0,
      points: Number(o.points),
      money: objectiveValue(Number(o.points)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectives, proratedMax]);

  const startEdit = (o: Objective) => {
    setEditingId(o.id);
    setForm({
      description: o.description,
      metric: o.metric ?? '',
      importanceLevelId: o.importanceLevelId,
      relativeWeight: String(o.relativeWeight),
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      description: form.description,
      metric: form.metric || undefined,
      importanceLevelId: form.importanceLevelId,
      relativeWeight: Number(form.relativeWeight),
    });
  };

  return (
    <div>
      <PageHeader title={t('objectives.title')} />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Field label={t('objectives.selectEmployee')}>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">{t('common.select')}</option>
              {employees?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('objectives.selectPeriod')}>
            <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">{t('common.select')}</option>
              {periods?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.year}-{String(p.month).padStart(2, '0')} ({t(`periodStatus.${p.status}`)})
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              disabled={!selected || recalcMutation.isPending}
              onClick={() => recalcMutation.mutate()}
            >
              {t('objectives.recalculate')}
            </Button>
            <Button
              variant="secondary"
              disabled={!selected || duplicateMutation.isPending}
              onClick={() => duplicateMutation.mutate()}
            >
              {t('objectives.duplicate')}
            </Button>
            <Button variant="secondary" disabled={!selected} onClick={() => setShowAudit((v) => !v)}>
              {t('objectives.auditLog')}
            </Button>
          </div>
        </div>

        {selected && (
          <>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 items-end">
              <div className="md:col-span-2">
                <Field label={t('objectives.description')}>
                  <Input
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t('objectives.metric')}>
                <Input
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                />
              </Field>
              <Field label={t('objectives.level')}>
                <Select
                  required
                  value={form.importanceLevelId}
                  onChange={(e) => setForm({ ...form, importanceLevelId: e.target.value })}
                >
                  <option value="">{t('common.select')}</option>
                  {levels?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label} (x{l.relativeWeight})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('objectives.weight')}>
                <Input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={form.relativeWeight}
                  onChange={(e) => setForm({ ...form, relativeWeight: e.target.value })}
                />
              </Field>
              <div className="md:col-span-5 flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {editingId ? t('common.save') : t('objectives.add')}
                </Button>
                {editingId && (
                  <Button variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </form>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            {notice && <p className="text-sm text-green-700 mb-3">{notice}</p>}

            {isLoading ? (
              <p className="text-sm text-gray-500">{t('common.loading')}</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  {objectives?.length ?? 0}/30 · {t('objectives.minRequired')}
                </p>
                {maxMonthly > 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    {t('objectives.summaryMax')}: <strong>{fmtMoney(maxMonthly)}</strong>
                    {proration < 1 && (
                      <>
                        {' · '}
                        {t('objectives.summaryProrated', {
                          date: selectedEmployee?.profile?.programStartDate?.slice(0, 10) ?? '',
                          factor: proration,
                        })}
                        {' → '}
                        <strong>{fmtMoney(proratedMax)}</strong>
                      </>
                    )}
                  </p>
                )}
                <Table
                  head={[
                    t('objectives.description'),
                    t('objectives.metric'),
                    t('objectives.level'),
                    t('objectives.weight'),
                    t('objectives.points'),
                    t('objectives.value'),
                    t('common.actions'),
                  ]}
                >
                  {objectives?.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 pr-4">{o.description}</td>
                      <td className="py-2 pr-4">{o.metric ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge text={o.importanceLevel.label} color={o.importanceLevel.colorHex} />
                      </td>
                      <td className="py-2 pr-4" title={t('objectives.weightHint')}>
                        {o.relativeWeight} × {o.importanceLevel.relativeWeight}
                      </td>
                      <td className="py-2 pr-4 font-medium">{o.points}</td>
                      <td className="py-2 pr-4">
                        {proratedMax > 0 ? fmtMoney(objectiveValue(Number(o.points))) : '—'}
                      </td>
                      <td className="py-2 pr-4 flex gap-2">
                        <Button variant="secondary" onClick={() => startEdit(o)}>
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            if (window.confirm(t('common.confirmDelete'))) {
                              deleteMutation.mutate(o.id);
                            }
                          }}
                        >
                          {t('common.delete')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {objectives && objectives.length > 0 && (
                    <tr className="font-semibold border-t-2">
                      <td className="py-2 pr-4" colSpan={4}>
                        {t('objectives.total')}
                      </td>
                      <td className="py-2 pr-4">
                        {objectives.reduce((acc, o) => acc + Number(o.points), 0)} pts
                      </td>
                      <td className="py-2 pr-4">{proratedMax > 0 ? fmtMoney(proratedMax) : '—'}</td>
                      <td />
                    </tr>
                  )}
                </Table>

                <h2 className="text-lg font-semibold mt-8 mb-3">{t('objectives.preview')}</h2>
                <div className="space-y-2">
                  {preview.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-56 truncate text-sm">{p.label}</div>
                      <div className="flex-1 bg-gray-200 rounded h-4 overflow-hidden">
                        <div className="bg-gray-700 h-4" style={{ width: `${p.pct}%` }} />
                      </div>
                      <div className="w-48 text-right text-sm">
                        {p.points} pts · {fmtMoney(p.money)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {showAudit && (
              <>
                <h2 className="text-lg font-semibold mt-8 mb-3">{t('objectives.auditLog')}</h2>
                <Table
                  head={[
                    t('objectives.auditField'),
                    t('objectives.auditOld'),
                    t('objectives.auditNew'),
                    t('objectives.auditBy'),
                    t('objectives.auditAt'),
                  ]}
                >
                  {audit?.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-4">{a.field}</td>
                      <td className="py-2 pr-4">{a.oldValue ?? '—'}</td>
                      <td className="py-2 pr-4">{a.newValue ?? '—'}</td>
                      <td className="py-2 pr-4">{a.changedBy?.fullName ?? '—'}</td>
                      <td className="py-2 pr-4">{new Date(a.changedAt).toLocaleString('es-MX')}</td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
