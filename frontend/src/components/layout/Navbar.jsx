import { NavLink } from 'react-router-dom'

function Navbar({ routes }) {
  const navigationRoutes = routes.filter((route) => route.navLabel)
  const recipeRoute = navigationRoutes.find((route) => route.path === '/recipes')
  const orderedRoutes = navigationRoutes.filter((route) => route !== recipeRoute)
  if (recipeRoute) {
    orderedRoutes.splice(Math.floor(orderedRoutes.length / 2), 0, recipeRoute)
  }

  return (
    <header className="fixed inset-x-0 bottom-0 z-10 border-t border-[#eeece4] bg-white/[0.96] px-2 pt-3 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
      <nav className="mx-auto w-full max-w-[960px]" aria-label="Main navigation">
        <div className="grid grid-cols-5 items-stretch gap-0.5 sm:gap-2">
          {orderedRoutes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              end
              className={({ isActive }) =>
                route.path === '/recipes'
                  ? `group flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-0.5 py-1 text-center text-[9px] font-bold leading-tight transition-colors duration-150 sm:text-xs ${
                      isActive
                        ? 'text-[#253b2d]'
                        : 'text-[#536453] hover:text-[#253b2d]'
                    }`
                  : `flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-[5px] rounded-[14px] px-0.5 py-1 text-center text-[9px] font-semibold leading-tight transition-colors duration-150 sm:text-xs ${
                      isActive
                        ? 'bg-[#edf2e8] text-[#36583b]'
                        : 'text-[#777a72] hover:bg-[#edf2e8] hover:text-[#36583b]'
                    }`
              }
            >
              {route.path === '/recipes' ? (
                <>
                  <span className="relative -mt-7 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-[#fbfaf6] bg-[#36583b] text-white shadow-md transition-colors duration-150 group-hover:bg-[#2a462e]">
                    <route.icon
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={2}
                    />
                  </span>
                  <span className="max-w-full">{route.navLabel}</span>
                </>
              ) : (
                <>
                  <route.icon
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 sm:h-[21px] sm:w-[21px]"
                    strokeWidth={1.8}
                  />
                  <span className="max-w-full">{route.navLabel}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}

export default Navbar
