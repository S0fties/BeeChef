import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // On page load, restore the session if a token is stored.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null)) // expired or invalid token
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { access_token } = await api.login({ email, password });
    setToken(access_token);
    setUser(await api.me());
  };

  const register = async ({ email, password, name,  surname, user_name}) => {
    await api.register({ email, password, name,  surname, user_name});
    await login(email, password); // log in right after registering
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);