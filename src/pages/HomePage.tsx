import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../utils/authStore";
import { listAudioFiles } from "../utils/googleApi";
import { useGooglePicker } from "../utils/googlePicker";
import { listHistory } from "../utils/data";
import type { DriveFile, HistoryItem } from "../utils/types";

const HomePage = () => {
  const navigate = useNavigate();
  const { accessToken, userSub } = useAuthStore();
  const { ready: pickerReady, openPicker } = useGooglePicker();
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");

  useEffect(() => {
    if (!userSub) {
      return;
    }
    listHistory(userSub).then((items) => {
      const sorted = [...items].sort((a, b) =>
        sortMode === "recent"
          ? b.lastPlayedAt.localeCompare(a.lastPlayedAt)
          : a.name.localeCompare(b.name)
      );
      setHistoryItems(sorted);
    });
  }, [userSub, sortMode]);

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
        </div>
        <p className="helper">
          Pickerが使えない環境では「一覧を取得」でDrive内の音声一覧を表示します。
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
            </div>
          </div>
          <ul className="list">
            {historyItems.map((item) => (
              <li key={item.id}>
                <button
                  className="list-item"
                  onClick={() => navigate(`/player/${item.driveFileId}`, { state: { name: item.name } })}
                >
                  <span className="list-title">{item.name}</span>
                  <span className="list-sub">
                    最終再生 {new Date(item.lastPlayedAt).toLocaleString("ja-JP")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default HomePage;