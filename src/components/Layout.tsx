import { NavLink, Outlet, useLocation } from 'react-router-dom'

import CacheSettings from './CacheSettings'
import { ReplayLayoutControls, ReplayLayoutProvider, ReplayTitleBadge } from '../hooks/useReplayLayout'

const navItems: { to: string; label: string; live?: boolean }[] = [
  { to: '/home', label: 'Home' },
  { to: '/live', label: 'Live', live: true },
]

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <ReplayLayoutProvider>
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4">
          <div className="flex items-center">
            <NavLink to="/home" className="flex items-center gap-2.5">
              <span className="h-5 w-1.5 rounded-full bg-f1-red" />
              <span className="text-lg font-semibold tracking-tight text-white">
                F1<span className="text-zinc-500"> Replay</span>
              </span>
            </NavLink>
            <ReplayTitleBadge />
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
                  ].join(' ')
                }
              >
                {item.live ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-f1-red opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-f1-red" />
                  </span>
                ) : null}
                {item.label}
              </NavLink>
            ))}
            <ReplayLayoutControls />
            {pathname === '/home' ? (
              <>
                <span className="mx-1 h-5 w-px bg-zinc-800" />
                <CacheSettings />
              </>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="w-full flex-1 px-4 pt-4">
        <Outlet />
      </main>
    </div>
    </ReplayLayoutProvider>
  )
}
