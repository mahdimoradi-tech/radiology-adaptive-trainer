import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RegisterBodySchema } from '../../features/auth/schemas.js';
import { useRegister } from '../../features/auth/hooks.js';
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

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const register = useRegister();

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
  });
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

    const payload = {
      ...formData,
      language: i18n.language?.startsWith('en') ? 'en' : 'fa',
    };

    const validation = RegisterBodySchema.safeParse(payload);
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
      const user = await register.mutateAsync(validation.data);
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
          <CardTitle>{t('auth.register')}</CardTitle>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {apiError && <Alert variant="error">{apiError}</Alert>}

            <Field id="register-name" label={t('auth.displayName')} error={fieldErrors.displayName}>
              <Input
                id="register-name"
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                error={fieldErrors.displayName}
                autoComplete="name"
                placeholder="دکتر احمدی"
                required
              />
            </Field>

            <Field id="register-email" label={t('auth.email')} error={fieldErrors.email}>
              <Input
                id="register-email"
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

            <Field
              id="register-password"
              label={t('auth.password')}
              error={fieldErrors.password}
              hint={t('auth.passwordHint')}
            >
              <Input
                id="register-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={fieldErrors.password}
                autoComplete="new-password"
                required
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={register.isPending}
            >
              {t('auth.submitRegister')}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-xs text-slate-600 gap-1">
          <span>{t('auth.haveAccount')}</span>
          <Link to="/login" className="text-sky-600 hover:text-sky-700 font-medium hover:underline">
            {t('auth.login')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
