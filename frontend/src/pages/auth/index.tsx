import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, UserPlus } from 'lucide-react'
import { useLogin, useRegister } from 'shared/api/generated/auth/auth'
import { getGetMeQueryKey } from 'shared/api/generated/users/users'
import { Button, Panel, TextInput } from 'shared/ui'
import { useToast } from 'utils/useToast'

type Mode = 'login' | 'register'

export default function AuthPage({ mode }: { mode: Mode }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from
    ?.pathname

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() })
    addToast({ message: 'Сессия обновлена', type: 'success' })
    navigate(from || '/', { replace: true })
  }

  const login = useLogin({
    mutation: {
      onSuccess,
      onError: () =>
        addToast({ message: 'Не удалось войти', type: 'error' }),
    },
  })
  const register = useRegister({
    mutation: {
      onSuccess,
      onError: () =>
        addToast({ message: 'Не удалось зарегистрироваться', type: 'error' }),
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'login') {
      login.mutate({ data: { email, password } })
      return
    }
    register.mutate({ data: { username, email, password } })
  }

  const isPending = login.isPending || register.isPending

  return (
    <div className="auth-page">
      <Panel>
        <div className="section-heading compact">
          <div>
            <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
            <p>Cookie-сессия, без хранения токенов в браузере.</p>
          </div>
        </div>
        <form className="stack" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Username
              <TextInput
                autoComplete="username"
                minLength={3}
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <TextInput
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <TextInput
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button disabled={isPending} type="submit">
            {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </Button>
          <p className="muted-text">
            {mode === 'login' ? (
              <>
                Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
              </>
            ) : (
              <>
                Уже есть аккаунт? <Link to="/login">Войти</Link>
              </>
            )}
          </p>
        </form>
      </Panel>
    </div>
  )
}
