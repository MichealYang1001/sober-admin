'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { API_BASE_URL, storeOpsAuth } from '@/lib/api'
import type { OpsAccount } from '@/lib/types'

type LoginMode = 'password' | 'code' | 'reset'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function readError(response: Response) {
    try {
      const data = await response.json()
      return data.message || data.detail || '请求失败'
    } catch {
      return '请求失败'
    }
  }

  async function sendCode(purpose: 'login' | 'reset_password') {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/ops/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      })
      if (!response.ok) throw new Error(await readError(response))
      setMessage('验证码已发送')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发送失败')
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'reset') {
        const response = await fetch(`${API_BASE_URL}/ops/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, new_password: newPassword }),
        })
        if (!response.ok) throw new Error(await readError(response))
        setCode('')
        setPassword('')
        setNewPassword('')
        setMode('password')
        setMessage('密码已重置，可以用新密码登录')
        return
      }

      const response = await fetch(`${API_BASE_URL}${mode === 'password' ? '/ops/auth/password-login' : '/ops/auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'password' ? { email, password } : { email, code }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const data = (await response.json()) as { token: string; account: OpsAccount }
      storeOpsAuth(data.token, data.account)
      router.replace('/')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode)
    setCode('')
    setPassword('')
    setNewPassword('')
    setMessage('')
    setShowPassword(false)
  }

  const canSubmit =
    Boolean(email) &&
    ((mode === 'password' && Boolean(password)) ||
      (mode === 'code' && Boolean(code)) ||
      (mode === 'reset' && Boolean(code) && Boolean(newPassword)))

  const messageIsSuccess = message.includes('已发送') || message.includes('已重置')

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label="Sober Admin">
        <div className="auth-brand-bar">
          <span className="auth-logo">S</span>
          <div>
            <strong>Sober Admin</strong>
            <small>Internal operations</small>
          </div>
        </div>

        <div className="auth-brand-copy">
          <span className="auth-status">
            <i aria-hidden="true" />
            SOBER 内部系统
          </span>
          <h1>
            权限变更，
            <br />
            <span>清楚有据。</span>
          </h1>
          <p>学员工单与权限管理</p>
        </div>

        <div className="auth-brand-footer">
          <span>SOBER</span>
          <span>OPS / 2026</span>
        </div>
      </section>

      <section className="auth-content">
        <div className="auth-access-label">
          <ShieldCheck size={16} />
          仅限内部成员
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'reset' && (
            <button className="auth-back" type="button" onClick={() => changeMode('password')}>
              <ArrowLeft size={16} />
              返回登录
            </button>
          )}

          <header className="auth-heading">
            <span>{mode === 'reset' ? 'RESET PASSWORD' : 'WELCOME BACK'}</span>
            <h2>{mode === 'reset' ? '重置密码' : '登录 Sober Admin'}</h2>
            <p>{mode === 'reset' ? '验证后台邮箱后设置新密码' : '学员权限审批工作台'}</p>
          </header>

          {mode !== 'reset' && (
            <div className="auth-switch" aria-label="登录方式">
              <button
                className={mode === 'password' ? 'active' : ''}
                type="button"
                onClick={() => changeMode('password')}
                aria-pressed={mode === 'password'}
              >
                <KeyRound size={16} />
                密码登录
              </button>
              <button
                className={mode === 'code' ? 'active' : ''}
                type="button"
                onClick={() => changeMode('code')}
                aria-pressed={mode === 'code'}
              >
                <Mail size={16} />
                验证码登录
              </button>
            </div>
          )}

          <div className="auth-fields">
            <div className="auth-field">
              <label htmlFor="ops-email">后台邮箱</label>
              <div className="auth-input-shell">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="ops-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@sober.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {mode === 'password' && (
              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="ops-password">密码</label>
                  <button className="auth-text-button" type="button" onClick={() => changeMode('reset')}>
                    忘记密码？
                  </button>
                </div>
                <div className="auth-input-shell">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="ops-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="输入密码"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    className="auth-icon-button"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <span className="auth-hint">
                  <i aria-hidden="true" />
                  初始密码 admin1234
                </span>
              </div>
            )}

            {(mode === 'code' || mode === 'reset') && (
              <div className="auth-field">
                <label htmlFor="ops-code">邮箱验证码</label>
                <div className="auth-code-row">
                  <div className="auth-input-shell">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <input
                      id="ops-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="6 位验证码"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                    />
                  </div>
                  <button
                    className="auth-code-button"
                    type="button"
                    onClick={() => sendCode(mode === 'reset' ? 'reset_password' : 'login')}
                    disabled={loading || !email}
                  >
                    获取验证码
                  </button>
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div className="auth-field">
                <label htmlFor="ops-new-password">新密码</label>
                <div className="auth-input-shell">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="ops-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="至少 8 位"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    className="auth-icon-button"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <span className="auth-hint">密码长度至少 8 位</span>
              </div>
            )}
          </div>

          {message && (
            <div className={messageIsSuccess ? 'auth-message success' : 'auth-message error'} role="status">
              {messageIsSuccess ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
              <span>{message}</span>
            </div>
          )}

          <button className="auth-submit" disabled={loading || !canSubmit}>
            {loading ? <Loader2 className="auth-spinner" size={18} /> : <LogIn size={18} />}
            {loading ? '处理中...' : mode === 'reset' ? '确认重置' : '进入后台'}
          </button>

          {mode === 'code' && (
            <button className="auth-reset-link" type="button" onClick={() => changeMode('reset')}>
              无法登录？通过邮箱验证码重置密码
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
