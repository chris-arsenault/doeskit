import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useStore } from "./data/store";
import { signIn, signOut, getSession } from "./auth";
import Today from "./views/Today";
import Setup from "./views/Setup";
import History from "./views/History";
import { Pill, Settings, CalendarDays, LogOut } from "lucide-react";

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  token: string;
  username: string;
};

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading", token: "", username: "" });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await getSession();
        if (session) {
          const payload = session.getIdToken().payload as Record<string, unknown>;
          const displayName =
            (typeof payload.name === "string" && payload.name) ||
            (typeof payload.email === "string" && payload.email) ||
            (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) ||
            "";
          setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username: displayName });
          return;
        }
      } catch (error) {
        console.error("Session load failed:", error);
      }
      setAuth({ status: "signedOut", token: "", username: "" });
    };
    loadSession();
  }, []);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    setErrorMessage("");
    try {
      const session = await signIn(username, password);
      const payload = session.getIdToken().payload as Record<string, unknown>;
      const displayName =
        (typeof payload.name === "string" && payload.name) ||
        (typeof payload.email === "string" && payload.email) ||
        "";
      setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username: displayName || username });
    } catch (error) {
      setErrorMessage((error as Error).message || "Sign in failed");
    }
  };

  const handleSignOut = useCallback(() => {
    signOut();
    setAuth({ status: "signedOut", token: "", username: "" });
  }, []);

  if (auth.status === "loading") {
    return (
      <div className="splash">
        <div className="splash-title">dosekit</div>
      </div>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <div className="splash">
        <div className="splash-card">
          <div className="splash-title">dosekit</div>
          <form className="login-form" onSubmit={handleSignIn}>
            <input name="username" type="text" placeholder="Username" required autoComplete="username" />
            <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
            {errorMessage && <div className="login-error">{errorMessage}</div>}
            <button type="submit" className="btn btn-primary">Sign in</button>
          </form>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp token={auth.token} username={auth.username} onSignOut={handleSignOut} />;
}

function AuthenticatedApp({ token, username, onSignOut }: { token: string; username: string; onSignOut: () => void }) {
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const refresh = useStore((s) => s.refresh);

  useEffect(() => {
    useStore.getState()._setToken(token);
  }, [token]);

  return (
    <div className="app-layout">
      <main className="main-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={refresh}>
              Retry
            </button>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/history" element={<History />} />
          </Routes>
        )}
      </main>
      <nav className="bottom-nav">
        <NavLink to="/" end className="nav-item">
          <Pill size={20} />
          <span>Today</span>
        </NavLink>
        <NavLink to="/history" className="nav-item">
          <CalendarDays size={20} />
          <span>History</span>
        </NavLink>
        <NavLink to="/setup" className="nav-item">
          <Settings size={20} />
          <span>Setup</span>
        </NavLink>
        <button className="nav-item" onClick={onSignOut} title={username}>
          <LogOut size={20} />
          <span>Out</span>
        </button>
      </nav>
    </div>
  );
}
