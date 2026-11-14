import { useState } from "react"
import { useAuth } from "../context/AuthContext"

function ProfilePage() {
  const { user, logout, changePassword } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    try {
      await changePassword({
        email: user?.email,
        current_password: currentPassword,
        new_password: newPassword,
      })

      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setTimeout(() => {
        setIsOpen(false)
        setSuccess(false)
      }, 1500)
    } catch (err) {
      setError(err?.message || "Failed to update password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setError("")
    setSuccess(false)
    setCurrentPassword("")
    setNewPassword("")
  }

  return (
    <section className="w-full">
      <h1 className="m-0 text-[clamp(32px,5vw,48px)] font-bold tracking-[-1.5px] text-[#253b2d]">
        Profile
      </h1>

      {/* Main Container: details on left, actions on right */}
      <div className="mt-6 flex flex-col justify-between gap-8 md:flex-row md:items-start">
        {/* Left Side: User Info */}
        <dl className="grid gap-4 text-[#253b2d]">
          <div>
            <dt className="text-sm opacity-70">Full name</dt>
            <dd className="m-0 text-lg font-medium">
              {user?.name + " " + user?.surname}
            </dd>
          </div>
          <div>
            <dt className="text-sm opacity-70">User name</dt>
            <dd className="m-0 text-lg font-medium">{user?.user_name}</dd>
          </div>
          <div>
            <dt className="text-sm opacity-70">Email</dt>
            <dd className="m-0 text-lg font-medium">{user?.email}</dd>
          </div>
        </dl>

        {/* Right Side: Action Controls */}
        <div className="flex w-full flex-col items-end gap-4 md:w-auto">
          {/* Morphing Container */}
          <div
            className={`w-full overflow-hidden rounded-lg transition-all duration-300 ease-in-out md:w-80 ${
              isOpen
                ? "max-h-[450px] border border-gray-200 bg-white p-5 shadow-sm"
                : "max-h-[44px] border-transparent bg-[#253b2d] p-0"
            }`}
          >
            {!isOpen ? (
              /* Button state */
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="h-full w-full px-4 py-2 text-center font-medium text-white transition-opacity hover:opacity-90"
              >
                Change Password
              </button>
            ) : (
              /* Form state (morphed) */
              <form
                onSubmit={handlePasswordSubmit}
                className="flex flex-col gap-3 transition-opacity duration-300 ease-in"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#253b2d]">
                    Change Password
                  </span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && (
                  <p className="text-sm text-green-600">
                    Password updated successfully!
                  </p>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#253b2d]">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#253b2d] focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#253b2d]">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#253b2d] focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 rounded-lg bg-[#253b2d] px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            )}
          </div>

          {/* Log out Button */}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg bg-[#253b2d] px-4 py-2 text-center text-white transition-opacity hover:opacity-90 md:w-80"
          >
            Log out
          </button>
        </div>
      </div>
    </section>
  )
}

export default ProfilePage