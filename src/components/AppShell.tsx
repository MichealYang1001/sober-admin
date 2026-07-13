'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarClock, ClipboardList, LogOut, ScrollText, Settings, ShieldCheck, Users } from 'lucide-react'
import { clearOpsAuth, getStoredAccount, opsFetch } from '@/lib/api'
import type { OpsAccount } from '@/lib/types'

const navItems = [
  { href: '/', label: '工单', icon: ClipboardList },
  { href: '/students', label: '学员管理', icon: Users, adminOnly: true },
  { href: '/expirations', label: '到期管理', icon: CalendarClock, adminOnly: true },
  { href: '/audits', label: '学员审计', icon: ScrollText, adminOnly: true },
  { href: '/accounts', label: '后台账号', icon: Settings, adminOnly: true },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [account, setAccount] = useState<OpsAccount | null>(null)
  const [loading, setLoading] = useState(pathname !== '/login')

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false)
      return
    }

    const cached = getStoredAccount()
    if (cached) setAccount(cached)

    opsFetch<{ account: OpsAccount }>('/ops/me')
      .then((data) => {
        setAccount(data.account)
        localStorage.setItem('sober_ops_account', JSON.stringify(data.account))
      })
      .catch(() => {
        router.replace('/login')
      })
      .finally(() => setLoading(false))
  }, [pathname, router])

  if (pathname === '/login') return <>{children}</>

  const logout = () => {
    clearOpsAuth()
    router.replace('/login')
  }

  const accountName = account?.display_name || account?.email || '加载中'
  const accountInitial = account ? accountName.trim().charAt(0).toUpperCase() || 'S' : 'S'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark"><ShieldCheck size={19} /></span>
          <span className="brand-copy">
            <strong>Sober Admin</strong>
            <small>Operations</small>
          </span>
        </Link>
        <nav className="nav-list">
          {navItems
            .filter((item) => !item.adminOnly || account?.role === 'admin')
            .map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} className={active ? 'nav-item active' : 'nav-item'} href={item.href} aria-current={active ? 'page' : undefined}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
        </nav>
        <div className="sidebar-footer">
          <span className="account-avatar" aria-hidden="true">{accountInitial}</span>
          <div className="account-box">
            <strong>{accountName}</strong>
            <span>{account?.role === 'admin' ? '管理员' : '普通用户'}</span>
          </div>
          <button className="icon-button" onClick={logout} title="退出登录">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="main-inner">
          {loading ? <div className="empty-state">正在检查后台登录状态...</div> : children}
        </div>
      </main>
    </div>
  )
}
