import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { Button, Field, Input } from '../components/ui';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/reset-password', {
        token,
        password,
      });
      setNotice(res.message);
    } catch (err) {
      setError((err as unknown as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-semibold mb-1">{t('app.name')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('auth.resetTitle')}</p>
        {!token ? (
          <p className="text-sm text-red-600">{t('auth.resetTokenMissing')}</p>
        ) : (
          <form onSubmit={onSubmit}>
            <Field label={t('auth.newPassword')}>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label={t('auth.confirmPassword')}>
              <Input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            {notice && (
              <div className="mb-3">
                <p className="text-sm text-green-700">{notice}</p>
                <Link to="/login" className="text-sm text-blue-600 hover:underline">
                  {t('auth.backToLogin')}
                </Link>
              </div>
            )}
            <Button type="submit" disabled={submitting || !!notice}>
              {t('auth.resetSubmit')}
            </Button>
          </form>
        )}
        {!notice && (
          <p className="text-sm mt-4">
            <Link to="/login" className="text-blue-600 hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
