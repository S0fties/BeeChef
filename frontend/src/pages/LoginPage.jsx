import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'w-full rounded-lg border border-[#253b2d]/30 bg-white px-3 py-2 text-[#253b2d] outline-none focus:border-[#253b2d]'

function LoginPage() {
  const { user, loading, login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '',name: '',  surname: '', user_name: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="p-8 text-[#253b2d]">Loading...</p>
  if (user) return <Navigate to="/recipes" replace />

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <form onSubmit={submit} className="grid gap-4">
        <h1 className="m-0 text-4xl font-bold tracking-[-1.5px] text-[#253b2d]">
          {isLogin ? 'Log in' : 'Create account'}
        </h1>

        {!isLogin && (
          <>
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Name"
                value={form.name}
                onChange={update('name')}
                maxLength={50}
                required
              />
              <input
                className={inputClass}
                placeholder="Surname"
                value={form.surname}
                onChange={update('surname')}
                maxLength={20}
                required
              />
            </div>

            <input
              className={inputClass}
              placeholder="Username"
              value={form.user_name}
              onChange={update('user_name')}
              maxLength={20}
              autoComplete="username"
              required
            />
          </>
        )}

        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={update('email')}
          autoComplete="email"
          required
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={update('password')}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
        />

        {error && <p className="m-0 text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          className="rounded-lg bg-[#253b2d] px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? 'Please wait...' : isLogin ? 'Log in' : 'Register'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? 'register' : 'login')
            setError('')
          }}
          className="text-sm text-[#253b2d] underline"
        >
          {isLogin ? 'Need an account? Register' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  )
}

export default LoginPage