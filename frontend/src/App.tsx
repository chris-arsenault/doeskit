import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useStore } from "./data/store";
import { signIn, signOut, getSession } from "./auth";
import Today from "./views/Today";
import Setup from "./views/Setup";
import History from "./views/History";
import { Pill, Settings, CalendarDays, LogOut } from "lucide-react";
import styles from "./App.module.css";
import shared from "./styles/shared.module.css";

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  token: string;
  username: string;
};

function displayName(payload: Record<string, unknown>): string {
  return (
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) ||
    ""
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading", token: "", username: "" });

  useEffect(() => {
    getSession()
      .then((session) => {
        if (!session) return setAuth({ status: "signedOut", token: "", username: "" });
        const payload = session.getIdToken().payload as Record<string, unknown>;
        setAuth({
          status: "signedIn",
          token: session.getIdToken().getJwtToken(),
          username: displayName(payload),
        });
      })
      .catch(() => setAuth({ status: "signedOut", token: "", username: "" }));
  }, []);

  const handleSignIn = useCallback((token: string, name: string) => {
    setAuth({ status: "signedIn", token, username: name });
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setAuth({ status: "signedOut", token: "", username: "" });
  }, []);

  if (auth.status === "loading") {
    return (
      <div className={styles.splash}>
        <div className={styles.splashTitle}>dosekit</div>
      </div>
    );
  }
  if (auth.status === "signedOut") {
    return (
      <LoginScreen onSignIn={handleSignIn} />
    );
  }
  return <AuthenticatedApp token={auth.token} username={auth.username} onSignOut={handleSignOut} />;
}

function LoginScreen({ onSignIn }: { onSignIn: (token: string, username: string) => void }) {
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setErrorMessage("");
    try {
      const session = await signIn(
        String(fd.get("username") ?? ""),
        String(fd.get("password") ?? "")
      );
      const payload = session.getIdToken().payload as Record<string, unknown>;
      onSignIn(
        session.getIdToken().getJwtToken(),
        displayName(payload) || String(fd.get("username"))
      );
    } catch (error) {
      setErrorMessage((error as Error).message || "Sign in failed");
    }
  };

  return (
    <div className={styles.splash}>
      <div className={styles.splashCard}>
        <div className={styles.splashTitle}>dosekit</div>
        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <input
            name="username"
            type="text"
            placeholder="Username"
            required
            autoComplete="username"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            autoComplete="current-password"
          />
          {errorMessage && <div className={styles.loginError}>{errorMessage}</div>}
          <button type="submit" className={shared.btnPrimary}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

function AppContent({
  loading,
  error,
  refresh,
}: {
  loading: boolean;
  error: string | null;
  refresh: () => void;
}) {
  if (loading)
    return (
      <div className={shared.loadingState}>
        <div className={shared.spinner} />
      </div>
    );
  if (error) {
    return (
      <div className={shared.errorState}>
        <p>{error}</p>
        <button className={shared.btnPrimary} onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/history" element={<History />} />
    </Routes>
  );
}

function AuthenticatedApp({
  token,
  username,
  onSignOut,
}: {
  token: string;
  username: string;
  onSignOut: () => void;
}) {
  const loading = useStore((s) => s.initialLoading);
  const error = useStore((s) => s.error);
  const refresh = useStore((s) => s.refresh);

  useEffect(() => {
    useStore.getState()._setToken(token);
  }, [token]);

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <AppContent loading={loading} error={error} refresh={refresh} />
      </main>
      <nav className={styles.nav}>
        <NavLink to="/" end className={styles.navItem}>
          <Pill size={20} />
          <span>Today</span>
        </NavLink>
        <NavLink to="/history" className={styles.navItem}>
          <CalendarDays size={20} />
          <span>History</span>
        </NavLink>
        <NavLink to="/setup" className={styles.navItem}>
          <Settings size={20} />
          <span>Setup</span>
        </NavLink>
        <button className={styles.navItem} onClick={onSignOut} title={username}>
          <LogOut size={20} />
          <span>Out</span>
        </button>
      </nav>
    </div>
  );
}
