import { useAuth } from "../context/AuthContext"

function ProfilePage() {
  const { user, logout } = useAuth()

  return (
    <section className="w-full">
      <h1 className="m-0 text-[clamp(32px,5vw,48px)] font-bold tracking-[-1.5px] text-[#253b2d]">
        Profile
      </h1>

      <dl className="mt-6 grid gap-4 text-[#253b2d]">
        <div>
          <dt className="text-sm opacity-70">Full name</dt>
          <dd className="m-0 text-lg font-medium">{user.full_name}</dd>
        </div>
        <div>
          <dt className="text-sm opacity-70">Email</dt>
          <dd className="m-0 text-lg font-medium">{user.email}</dd>
        </div>
      </dl>

      <button
        onClick={logout}
        className="mt-8 rounded-lg bg-[#253b2d] px-4 py-2 text-white"
      >
        Log out
      </button>
    </section>
  )
}

export default ProfilePage