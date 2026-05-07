import { FormEvent, ReactNode, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { HelpCircle, LogIn, LogOut, Search, Shield, Upload, User } from 'lucide-react'
import { useSession, useLogoutSession } from 'features/auth/session'
import { Button, TextInput } from 'shared/ui'

export default function AppShell({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const navigate = useNavigate()
  const session = useSession()
  const logout = useLogoutSession()

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    const next = query.trim()
    navigate(next ? `/?q=${encodeURIComponent(next)}` : '/')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">NB</span>
          <span>NeoBooru</span>
        </Link>

        <form className="topbar-search" onSubmit={handleSearch}>
          <Search size={16} />
          <TextInput
            aria-label="Поиск"
            placeholder="tag1 tag2 sort:new"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>

        <nav className="topbar-nav">
          <NavLink to="/upload" title="Загрузка">
            <Upload size={18} />
            <span>Upload</span>
          </NavLink>
          <NavLink to="/search-help" title="Справка по поиску">
            <HelpCircle size={18} />
            <span>Search</span>
          </NavLink>
          {session.isStaff && (
            <NavLink to="/admin" title="Админка">
              <Shield size={18} />
              <span>Admin</span>
            </NavLink>
          )}
          {session.isAuthenticated ? (
            <>
              <NavLink to="/me" title="Профиль">
                <User size={18} />
                <span>{session.user?.username}</span>
              </NavLink>
              <Button
                disabled={logout.isPending}
                title="Выйти"
                type="button"
                variant="ghost"
                onClick={() => logout.mutate()}
              >
                <LogOut size={18} />
              </Button>
            </>
          ) : (
            <NavLink to="/login" title="Войти">
              <LogIn size={18} />
              <span>Login</span>
            </NavLink>
          )}
        </nav>
      </header>
      <main className="main-content">{children}</main>
    </div>
  )
}
