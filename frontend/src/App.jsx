import { Navigate, Route, Routes } from 'react-router-dom'
import { Package, ShoppingBasket, Sparkles, UserRound, Users } from 'lucide-react'
import PageWrapper from './components/layout/PageWrapper.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SocialPage from './pages/SocialPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import RecipeGeneratorPage from './pages/RecipeGeneratorPage.jsx'
import ShoppingPage from './pages/ShoppingPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

const routes = [
  { path: '/recipes', navLabel: 'Recipe Generator', icon: Sparkles, component: RecipeGeneratorPage },
  { path: '/inventory', navLabel: 'Inventory', icon: Package, component: InventoryPage },
  { path: '/social', navLabel: 'Social', icon: Users, component: SocialPage },
  { path: '/shopping', navLabel: 'Shopping', icon: ShoppingBasket, component: ShoppingPage },
  { path: '/profile', navLabel: 'Profile', icon: UserRound, component: ProfilePage },
]

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<PageWrapper routes={routes} />}>
          <Route index element={<Navigate to={routes[0].path} replace />} />
          {routes.map(({ path, component: Page }) => (
            <Route key={path} path={path.slice(1)} element={<Page />} />
          ))}
          <Route path="*" element={<Navigate to={routes[0].path} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App