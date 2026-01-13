import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../utils/authStore";
import { listAudioFiles } from "../utils/googleApi";
import { useGooglePicker } from "../utils/googlePicker";
import { deleteHistoryItem, deleteLocalFile, getLocalFile, listHistory } from "../utils/data";
import type { DriveFile, HistoryItem } from "../utils/types";

const HomePage = () => {
  const navigate = useNavigate();
  const { accessToken, userSub } = useAuthStore();
  const { ready: pickerReady, openPicker } = useGooglePicker();
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");
  const [editMode, setEditMode] = useState(false);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isIOS =
    typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone);

  useEffect(() => {
    const historyUser = userSub ?? "local";
    listHistory(historyUser).then(async (items) => {
      const sorted = [...items].sort((a, b) =>
        sortMode === "recent"
          ? b.lastPlayedAt.localeCompare(a.lastPlayedAt)
          : a.name.localeCompare(b.name)
      );
      setHistoryItems(sorted);
      const offlineChecks = await Promise.all(
        sorted.map(async (item) => {
          if (item.driveFileId.startsWith("local-")) {
            return null;
          }
          const stored = await getLocalFile(item.driveFileId);
          return stored ? item.driveFileId : null;
        })
      );
      const nextOffline = new Set(offlineChecks.filter(Boolean) as string[]);
      setOfflineIds(nextOffline);
    });
  }, [userSub, sortMode]);

  const handleHistoryDelete = async (item: HistoryItem) => {
    const historyUser = userSub ?? "local";
    await deleteHistoryItem(historyUser, item.driveFileId);
    if (item.driveFileId.startsWith("local-")) {
      await deleteLocalFile(item.driveFileId);
    }
    setHistoryItems((prev) => prev.filter((entry) => entry.id !== item.id));
  };

  const handlePicker = () => {
    if (!accessToken) {
      return;
    }
    const opened = openPicker(accessToken, (fileId, name) => {
      navigate(`/player/${fileId}`, { state: { name } });
    });
    if (!opened) {
      setLoadingFiles(true);
      listAudioFiles(accessToken)
        .then((files) => setDriveFiles(files))
        .finally(() => setLoadingFiles(false));
    }
  };

  const handleList = () => {
    if (!accessToken) {
      return;
    }
    setLoadingFiles(true);
    listAudioFiles(accessToken)
      .then((files) => setDriveFiles(files))
      .finally(() => setLoadingFiles(false));
  };

  const handleLocalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    const localId = `local-${file.lastModified}-${file.size}-${encodeURIComponent(file.name)}`;
    navigate(`/player/${localId}`, {
      state: { name: file.name, blobUrl, mimeType: file.type, file }
    });
    event.target.value = "";
  };

  const handleLocalOpen = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="home">
      <div className="section">
        <h2>音声ファイルを開く</h2>
        <div className="button-row">
          <button className="primary" onClick={handlePicker} disabled={!accessToken}>
            {pickerReady ? "Driveから選択" : "Driveにアクセス"}
          </button>
          <button className="ghost" onClick={handleList} disabled={!accessToken}>
            一覧を取得
          </button>
          <button className="secondary" type="button" onClick={handleLocalOpen}>
            ローカルから開く
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.aac"
            onChange={handleLocalChange}
            className="file-input-hidden"
            aria-label="ローカルから開く"
          />
        </div>
        <p className="helper">
          Pickerが使えない環境では「一覧を取得」でDrive内の音声一覧を表示します。
          {isIOS ? " iPhoneはSafariでのみローカル選択が有効です。" : ""}
          {isIOS && isStandalone
            ? " ホーム画面PWAではファイル選択が動かない場合があります。"
            : ""}
        </p>
      </div>

      {loadingFiles && <div className="card">Driveから音声一覧を取得中...</div>}

      {!loadingFiles && driveFiles.length > 0 && (
        <div className="section">
          <h3>Drive内の音声</h3>
          <ul className="list">
            {driveFiles.map((file) => (
              <li key={file.id}>
                <button
                  className="list-item"
                  onClick={() => navigate(`/player/${file.id}`, { state: { name: file.name } })}
                >
                  <span className="list-title">{file.name}</span>
                  <span className="list-sub">{file.mimeType}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {historyItems.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>最近開いた音声</h3>
            <div className="chip-group">
              <button
                className={sortMode === "recent" ? "chip active" : "chip"}
                onClick={() => setSortMode("recent")}
              >
                新着順
              </button>
              <button
                className={sortMode === "name" ? "chip active" : "chip"}
                onClick={() => setSortMode("name")}
              >
                名前順
              </button>
              <button
                className={editMode ? "chip active" : "chip"}
                onClick={() => setEditMode((prev) => !prev)}
              >
                編集
              </button>
            </div>
          </div>
          <ul className="list">
            {historyItems.map((item) => {
              const isLocal = item.driveFileId.startsWith("local-");
              const isOffline = offlineIds.has(item.driveFileId);
              return (
                <li key={item.id}>
                  <button
                    className={editMode ? "list-item list-item-disabled" : "list-item"}
                    onClick={() => {
                      if (editMode) {
                        return;
                      }
                      isLocal
                        ? navigate(`/player/${item.driveFileId}`)
                        : navigate(`/player/${item.driveFileId}`, { state: { name: item.name } });
                    }}
                  >
                    <div className="list-row">
                      <span className="list-title">
                        {item.name}
                        {isLocal ? "（ローカル）" : ""}
                        {!isLocal && isOffline ? "（オフライン）" : ""}
                      </span>
                      {editMode && (
                        <button
                          className="ghost small"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHistoryDelete(item);
                          }}
                        >
                          削除
                        </button>
                      )}
                    </div>
                    <span className="list-sub">
                      最終再生 {new Date(item.lastPlayedAt).toLocaleString("ja-JP")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export default HomePage;
