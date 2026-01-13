import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useGoogleAuth } from "./utils/googleAuth";
import { useAuthStore } from "./utils/authStore";
import { fetchUserInfo } from "./utils/googleApi";
import HomePage from "./pages/HomePage";
import PlayerPage from "./pages/PlayerPage";
import SettingsPage from "./pages/SettingsPage";
import { APP_VERSION } from "./utils/version";

const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);
  return promptEvent;
};

const App = () => {
  const { ready, requestToken, requestTokenSilent, error, missingClient } = useGoogleAuth();
  const { accessToken, expiresAt, userSub, userName, setUser, clear } = useAuthStore();
  const [online, setOnline] = useState(navigator.onLine);
  const installPrompt = useInstallPrompt();
  const location = useLocation();
  const silentTried = useRef(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!accessToken || userSub) {
      return;
    }
    fetchUserInfo(accessToken)
      .then((profile) => {
        setUser(profile.sub, profile.name ?? null);
      })
      .catch(() => {
        // user info fetch is best-effort
      });
  }, [accessToken, userSub, setUser]);

  useEffect(() => {
    if (!ready || accessToken || silentTried.current) {
      return;
    }
    silentTried.current = true;
    requestTokenSilent();
  }, [ready, accessToken, requestTokenSilent]);

  useEffect(() => {
    if (!accessToken || !expiresAt) {
      return;
    }
    if (expiresAt <= Date.now()) {
      clear();
    }
  }, [accessToken, expiresAt, clear]);

  const canInstall = Boolean(installPrompt);
  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
  };

  const isPlayer = location.pathname.startsWith("/player/");
  const title = useMemo(() => (isPlayer ? "再生" : "メッセージプレーヤー"), [isPlayer]);

  const loginLabel = () => {
    if (missingClient) {
      return "CLIENT_ID未設定";
    }
    if (error) {
      return "ログイン準備に失敗";
    }
    if (!ready) {
      return "ログイン準備中...";
    }
    return "Googleでログイン";
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-title">{title}</span>
          <span className="brand-sub">Drive音声をクリップして聞きやすく</span>
        </div>
        <nav className="nav">
          <Link to="/" className="nav-link">ホーム</Link>
          <Link to="/settings" className="nav-link">設定</Link>
        </nav>
      </header>

      {!online && (
        <div className="offline-banner">オフライン中です。保存済みの情報のみ表示されます。</div>
      )}

      {!accessToken && (
        <section className="auth-panel">
          <p>Google Driveにアクセスして音声を選択するため、Googleログインが必要です。</p>
          <button
            className="primary"
            onClick={requestToken}
            onTouchEnd={requestToken}
            disabled={!ready}
          >
            {loginLabel()}
          </button>
          {(missingClient || error) && (
            <div className="helper">ログインできない場合は一度再読み込みしてください。</div>
          )}
        </section>
      )}

      {accessToken && userName && (
        <div className="welcome">ようこそ、{userName} さん</div>
      )}
      {accessToken && !userSub && (
        <div className="welcome">ユーザー情報を取得中です...</div>
      )}

      {canInstall && (
        <div className="install-banner">
          <div>
            ホーム画面に追加してオフラインでも素早く起動できます。
          </div>
          <button className="secondary" onClick={handleInstall}>インストール</button>
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/player/:fileId" element={<PlayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <div className="app-version">{APP_VERSION}</div>
    </div>
  );
};

export default App;
