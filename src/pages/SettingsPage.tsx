import { useEffect, useState } from "react";
import { useAuthStore } from "../utils/authStore";
import { getSettings, saveSettings } from "../utils/data";
import type { Settings } from "../utils/types";

const speedOptions = [0.75, 1, 1.25, 1.5, 2];

const SettingsPage = () => {
  const { userSub } = useAuthStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  const effectiveUserSub = userSub ?? "local";

  useEffect(() => {
    getSettings(effectiveUserSub).then((data) => setSettings(data));
  }, [effectiveUserSub]);

  const handleSave = async () => {
    if (!settings) {
      return;
    }
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) {
    return <div className="card">設定を読み込み中...</div>;
  }

  return (
    <section className="section">
      <h2>設定</h2>
      <div className="card">
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.autoResume}
            onChange={(e) => setSettings({ ...settings, autoResume: e.target.checked })}
          />
          <span>再生位置の自動復元</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.noiseReduction}
            onChange={(e) => setSettings({ ...settings, noiseReduction: e.target.checked })}
          />
          <span>ノイズ低減を有効化</span>
        </label>

        <div className="setting-block">
          <div className="setting-title">デフォルト再生速度</div>
          <div className="speed-row">
            {speedOptions.map((option) => (
              <button
                key={option}
                className={settings.defaultSpeed === option ? "chip speed-chip active" : "chip speed-chip"}
                onClick={() => setSettings({ ...settings, defaultSpeed: option })}
              >
                {option}x
              </button>
            ))}
          </div>
        </div>

        <button className="primary" onClick={handleSave}>
          保存
        </button>
        {saved && <div className="helper">保存しました。</div>}
      </div>

      <div className="card note">
        {userSub ? "Googleアカウントごと" : "ローカル"}に設定が保存されます。
      </div>
    </section>
  );
};

export default SettingsPage;
