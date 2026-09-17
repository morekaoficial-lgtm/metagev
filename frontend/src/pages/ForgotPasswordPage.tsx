import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useI18n } from '../i18n/I18nContext';
import { Button, Field, Input } from '../components/ui';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/forgot-password', { email });
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
        <p className="text-sm text-gray-500 mb-6">{t('auth.forgotTitle')}</p>
        <form onSubmit={onSubmit}>
          <Field label={t('auth.email')}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {notice && <p className="text-sm text-green-700 mb-3">{notice}</p>}
          <Button type="submit" disabled={submitting}>
            {t('auth.forgotSubmit')}
          </Button>
        </form>
        <p className="text-sm mt-4">
          <Link to="/login" className="text-blue-600 hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
