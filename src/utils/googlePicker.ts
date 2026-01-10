import { useEffect, useState } from "react";
import { useScript } from "../hooks/useScript";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;

export const useGooglePicker = () => {
  const gapiScript = useScript("https://apis.google.com/js/api.js");
  const [pickerReady, setPickerReady] = useState(false);

  useEffect(() => {
    if (!gapiScript.loaded || !window.gapi) {
      return;
    }
    window.gapi.load("picker", { callback: () => setPickerReady(true) });
  }, [gapiScript.loaded]);

  const openPicker = (accessToken: string, onPick: (fileId: string, name: string) => void) => {
    if (!pickerReady || !window.google?.picker || !API_KEY) {
      return false;
    }

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMimeTypes(
        [
          "audio/mpeg",
          "audio/mp3",
          "audio/wav",
          "audio/x-m4a",
          "audio/aac",
          "audio/ogg"
        ].join(",")
      );

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID || undefined)
      .setTitle("Google Driveから音声を選択")
      .setCallback((data: any) => {
        if (data.action !== window.google.picker.Action.PICKED) {
          return;
        }
        const doc = data.docs?.[0];
        if (doc?.id) {
          onPick(doc.id, doc.name || "音声ファイル");
        }
      })
      .build();

    picker.setVisible(true);
    return true;
  };

  return {
    ready: pickerReady && Boolean(API_KEY),
    openPicker
  };
};
