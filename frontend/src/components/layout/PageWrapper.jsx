import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

function PageWrapper({ routes }) {
  return (
    <div className="min-h-screen">
      <Navbar routes={routes} />
      <main className="mx-auto w-[calc(100%-48px)] max-w-[1120px] py-12 pb-[120px] max-[520px]:w-[calc(100%-32px)] max-[520px]:pt-8 max-[520px]:pb-[104px]">
        <Outlet />
      </main>
    </div>
  )
}

export default PageWrapper
