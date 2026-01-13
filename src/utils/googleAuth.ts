import { useEffect, useMemo } from "react";
import { useAuthStore } from "./authStore";
import { useScript } from "../hooks/useScript";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// drive.readonly は音声取得のみ、userinfo.profile は sub 取得用 (クリップ/履歴キー用)
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");

export const useGoogleAuth = () => {
  const { loaded } = useScript("https://accounts.google.com/gsi/client");
  const { setToken, clear } = useAuthStore();

  const tokenClient = useMemo(() => {
    if (!loaded || !CLIENT_ID || !window.google?.accounts?.oauth2) {
      return null;
    }
    return window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPES,
      callback: () => {}
    });
  }, [loaded]);

  useEffect(() => {
    if (!tokenClient) {
      return;
    }
    tokenClient.callback = (response) => {
      if (response.error || !response.access_token) {
        clear();
        return;
      }
      setToken(response.access_token, response.expires_in || 0);
    };
  }, [tokenClient, setToken, clear]);

  const requestToken = (prompt: "consent" | "" = "consent") => {
    if (!tokenClient) {
      return;
    }
    tokenClient.requestAccessToken({ prompt });
  };

  return {
    ready: Boolean(loaded && CLIENT_ID && window.google?.accounts?.oauth2),
    requestToken,
    requestTokenSilent: () => requestToken("")
  };
};