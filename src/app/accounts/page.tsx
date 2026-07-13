'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { SelectControl } from '@/components/SelectControl'
import type { OpsAccount } from '@/lib/types'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<OpsAccount[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', display_name: '', role: 'normal', status: 'active' })

  async function load() {
    setError('')
    try {
      const data = await opsFetch<{ accounts: OpsAccount[] }>('/ops/accounts')
      setAccounts(data.accounts)
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createAccount(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await opsFetch('/ops/accounts', { method: 'POST', body: JSON.stringify(form) })
      setForm({ email: '', display_name: '', role: 'normal', status: 'active' })
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>后台账号</h1>
          <p>后台角色独立于学员 users 表，只分管理员和普通用户。</p>
        </div>
      </div>
      {error && <div className="error-state">{error}</div>}
      <form className="panel toolbar account-create-form" onSubmit={createAccount}>
        <input className="input account-email-input" type="email" placeholder="邮箱" aria-label="邮箱" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input className="input account-name-input" placeholder="姓名" aria-label="姓名" value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
        <SelectControl
          containerClassName="account-role-select"
          ariaLabel="角色"
          value={form.role}
          options={[
            { value: 'normal', label: '普通用户' },
            { value: 'admin', label: '管理员' },
          ]}
          onValueChange={(value) => setForm({ ...form, role: value })}
        />
        <button className="button"><Plus size={17} />新增账号</button>
      </form>
      <div className="section panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>邮箱</th>
              <th>姓名</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.email}</td>
                <td>{account.display_name || '-'}</td>
                <td>{account.role === 'admin' ? '管理员' : '普通用户'}</td>
                <td><span className={account.status === 'active' ? 'badge green' : 'badge gray'}>{account.status}</span></td>
                <td>{formatDate(account.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
