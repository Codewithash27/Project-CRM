import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PasswordField } from '../components/PasswordField'
import { usePasswordPolicy } from '../hooks/usePasswordPolicy'
import { fieldMessages, messageForError } from '../validation/errors'
import { isEmail } from '../validation/password'
import { ErrorAlert } from '../../components/common/ErrorAlert'
import { homePathForRoles } from '../../layouts/AppLayout/nav'
import { ApiError } from '../../services/api/errors'
import { useAuth } from '../../store/auth-context'

export function LoginPage() {
  const { t } = useTranslation(['auth', 'validation', 'common'])
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { policy } = usePasswordPolicy()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = t('validation:required')
    else if (!isEmail(email)) next.email = t('validation:email')
    if (!password) next.password = t('validation:required')
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length > 0) {
      return
    }
    setSubmitting(true)
    try {
      const profile = await login({ email: email.trim(), password, remember_me: rememberMe })
      navigate(homePathForRoles(profile.roles), { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.details.length > 0) {
        setErrors(fieldMessages(error, t, policy))
      } else {
        setFormError(messageForError(error, t))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack component="form" onSubmit={onSubmit} noValidate spacing={0} sx={{ width: '100%' }}>
      <Stack spacing={0.75} sx={{ mb: 3 }}>
        <Typography variant="h1">{t('auth:loginTitle')}</Typography>
        <Typography color="text.secondary">{t('auth:loginSubtitle')}</Typography>
      </Stack>
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      ) : null}
      {formError ? (
        <Stack sx={{ mb: 2 }}>
          <ErrorAlert message={formError} />
        </Stack>
      ) : null}
      <Stack spacing={2.25}>
        <TextField
          id="email"
          name="email"
          type="email"
          label={t('auth:email')}
          autoComplete="email"
          value={email}
          required
          fullWidth
          error={Boolean(errors.email)}
          helperText={errors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          id="password"
          label={t('auth:password')}
          autoComplete="current-password"
          value={password}
          error={errors.password}
          disabled={submitting}
          onChange={setPassword}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={submitting}
              size="small"
            />
          }
          label={t('auth:rememberMe')}
          sx={{ mt: -0.5, mb: 0.5 }}
        />
        <Button type="submit" variant="contained" fullWidth size="large" disabled={submitting} sx={{ minHeight: 44 }}>
          {submitting ? t('auth:submitting') : t('auth:signIn')}
        </Button>
        <MuiLink component={Link} to="/forgot-password" sx={{ alignSelf: 'flex-start' }}>
          {t('auth:forgotPassword')}
        </MuiLink>
        <Typography sx={{ pt: 0.5 }}>
          {t('auth:noAccount')}{' '}
          <MuiLink component={Link} to="/register">
            {t('auth:register')}
          </MuiLink>
        </Typography>
      </Stack>
    </Stack>
  )
}
