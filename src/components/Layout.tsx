import { NavLink, Outlet, useLocation } from 'react-router-dom'

import homeIcon from '../assets/home.png'
import CacheSettings from './CacheSettings'
import LiveSignInButton from './live/LiveSignInButton'
import { useIsLandscapeMobile } from '../hooks/useIsMobile'
import { ReplayLayoutControls, ReplayLayoutProvider, ReplayStatusBar, ReplayTitleBadge } from '../hooks/useReplayLayout'

const navItems: { to: string; label: string; live?: boolean }[] = [
  { to: '/live', label: 'Live', live: true },
]

export default function Layout() {
  const { pathname } = useLocation()
  const landscapeMobile = useIsLandscapeMobile()
  return (
    <ReplayLayoutProvider>
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <NavLink to="/home" className="flex shrink-0 translate-y-0.5 items-center gap-3">
              <span className="h-5 w-1.5 rounded-full bg-f1-red" />
              <span className="text-lg font-semibold tracking-tight text-white">
                F1<span className="text-zinc-500"> Replay</span>
              </span>
            </NavLink>
            {!landscapeMobile ? (
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  [
                    'hidden items-center rounded-md px-2 py-1.5 transition-colors sm:inline-flex',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
                  ].join(' ')
                }
              >
                <img src={homeIcon} alt="Home" className="h-6 w-6" />
              </NavLink>
            ) : null}
            <div className="hidden min-w-0 items-center md:flex">
              <ReplayTitleBadge />
              {!landscapeMobile ? <ReplayStatusBar /> : null}
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-1">
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
            {pathname === '/live' && !__HOSTED__ ? <LiveSignInButton /> : null}
            {pathname === '/home' && !__HOSTED__ ? (
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
