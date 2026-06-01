import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/live', label: 'Live' },
]

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <NavLink to="/home" className="flex items-center gap-2.5">
            <span className="h-5 w-1.5 rounded-full bg-f1-red" />
            <span className="text-lg font-semibold tracking-tight text-white">
              F1<span className="text-zinc-500"> Replay</span>
            </span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
