import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LoginBodySchema } from '../../features/auth/schemas.js';
import { useLogin } from '../../features/auth/hooks.js';
import { getErrorI18nKey } from '../../lib/api.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Field,
  Input,
  Button,
  Alert,
} from '../../components/ui/index.js';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    const validation = LoginBodySchema.safeParse(formData);
    if (!validation.success) {
      const errors = {};
      for (const issue of validation.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName && !errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      const user = await login.mutateAsync(validation.data);
      const destination =
        location.state?.from?.pathname || (user?.role === 'instructor' ? '/instructor' : '/app');
      navigate(destination, { replace: true });
    } catch (err) {
      const errorKey = getErrorI18nKey(err.code);
      setApiError(t(errorKey));
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.login')}</CardTitle>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {apiError && <Alert variant="error">{apiError}</Alert>}

            <Field id="login-email" label={t('auth.email')} error={fieldErrors.email}>
              <Input
                id="login-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={fieldErrors.email}
                autoComplete="email"
                placeholder="name@example.com"
                required
              />
            </Field>

            <Field id="login-password" label={t('auth.password')} error={fieldErrors.password}>
              <Input
                id="login-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={fieldErrors.password}
                autoComplete="current-password"
                required
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={login.isPending}
            >
              {t('auth.submitLogin')}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-xs text-slate-600 gap-1">
          <span>{t('auth.noAccount')}</span>
          <Link
            to="/register"
            className="text-sky-600 hover:text-sky-700 font-medium hover:underline"
          >
            {t('auth.register')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
