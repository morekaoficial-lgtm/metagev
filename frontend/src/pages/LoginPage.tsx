import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useI18n } from '../i18n/I18nContext';
import { Button, Field, Input } from '../components/ui';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.invalid'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-semibold mb-1">{t('app.name')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('app.tagline')}</p>
        <form onSubmit={onSubmit}>
          <Field label={t('auth.email')}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t('auth.password')}>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {t('auth.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
