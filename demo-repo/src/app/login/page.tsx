/**
 * Login page - uses the buggy session
 */

"use client";

import { useSession } from "../auth/session";

export default function LoginPage() {
  const { session, setSession } = useSession();

  const login = () => setSession("user123");
  const logout = () => setSession(null);

  return (
    <div data-testid="login-page">
      <h1>Login</h1>
      {session ? (
        <div>
          <p data-testid="logged-in">Logged in as: {session}</p>
          <button onClick={logout} data-testid="logout">Logout</button>
        </div>
      ) : (
        <button onClick={login} data-testid="login">Login</button>
      )}
    </div>
  );
}
