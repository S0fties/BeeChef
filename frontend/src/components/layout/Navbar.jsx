import { NavLink } from 'react-router-dom'

function Navbar({ routes }) {
  const navigationRoutes = routes.filter((route) => route.navLabel)

  return (
    <header className="fixed inset-x-0 bottom-0 z-10 border-t border-[#eeece4] bg-white/[0.96] px-6 pt-[10px] pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-xl max-[520px]:px-2">
      <nav className="mx-auto w-full max-w-[880px]" aria-label="Main navigation">
        <div className="grid grid-cols-5 items-stretch gap-2 max-[520px]:gap-0.5">
          {navigationRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              end
              className={({ isActive }) =>
                `flex min-h-[62px] flex-col items-center justify-center gap-[5px] rounded-[14px] text-center text-xs font-semibold transition-colors duration-150 max-[520px]:min-h-[58px] max-[520px]:gap-1 max-[520px]:px-0.5 max-[520px]:py-1 max-[520px]:text-[10px] ${
                  isActive
                    ? 'bg-[#edf2e8] text-[#36583b]'
                    : 'text-[#777a72] hover:bg-[#edf2e8] hover:text-[#36583b]'
                }`
              }
            >
              <route.icon
                aria-hidden="true"
                className="h-[21px] w-[21px] shrink-0 max-[520px]:h-[19px] max-[520px]:w-[19px]"
                strokeWidth={1.8}
              />
              <span>{route.navLabel}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}

export default Navbar
