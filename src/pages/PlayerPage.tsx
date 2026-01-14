import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "../utils/authStore";
import { fetchAudioBlob, fetchFileMeta } from "../utils/googleApi";
import {
  addClip,
  deleteClip,
  deleteLocalFile,
  getHistoryItem,
  getLocalFile,
  getSettings,
  listClips,
  saveHistory,
  saveLocalFile,
  updateClip
} from "../utils/data";
import { buildFileKey } from "../utils/db";
import type { Clip, DriveFile, HistoryItem, Settings } from "../utils/types";

const speedOptions = [0.75, 1, 1.25, 1.5, 2];

type LocalState = {
  name?: string;
  blobUrl?: string;
  mimeType?: string;
  file?: File;
};

const getDurationValue = (audio: HTMLAudioElement) => {
  const raw = audio.duration;
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (audio.seekable && audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) {
      return end;
    }
  }
  if (audio.buffered && audio.buffered.length > 0) {
    const end = audio.buffered.end(audio.buffered.length - 1);
    if (Number.isFinite(end) && end > 0) {
      return end;
    }
  }
  return 0;
};

const PlayerPage = () => {
  const { fileId } = useParams();
  const { accessToken, userSub } = useAuthStore();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [fileMeta, setFileMeta] = useState<DriveFile | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [clipSort, setClipSort] = useState<"new" | "time">("new");
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const pendingPlayRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);

  const normalizeBlob = (blob: Blob, mimeType?: string) => {
    if (blob.type) {
      return blob;
    }
    return new Blob([blob], { type: mimeType || "audio/mpeg" });
  };

  const inferMimeType = (name?: string) => {
    const lower = name?.toLowerCase() ?? "";
    if (lower.endsWith(".m4a")) {
      return "audio/mp4";
    }
    if (lower.endsWith(".wav")) {
      return "audio/wav";
    }
    if (lower.endsWith(".aac")) {
      return "audio/aac";
    }
    if (lower.endsWith(".ogg")) {
      return "audio/ogg";
    }
    return "audio/mpeg";
  };

  const locationState = location.state as LocalState | null;
  const isLocal = Boolean(fileId?.startsWith("local-"));
  const effectiveUserSub = userSub ?? (isLocal ? "local" : null);

  useEffect(() => {
    if (!fileId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isLocal) {
          if (!effectiveUserSub) {
            return;
          }
          const storedSettings = await getSettings(effectiveUserSub);
          if (!cancelled) {
            setSettings(storedSettings);
            setSpeed(storedSettings.defaultSpeed || 1);
          }

          let localBlob = locationState?.file ?? null;
          let localName = locationState?.name ?? "ローカル音声";
          let localMime = locationState?.mimeType ?? "";
          let localUrl = null;

          if (!localBlob && fileId) {
            const storedFile = await getLocalFile(fileId);
            if (storedFile) {
              localBlob = normalizeBlob(storedFile.blob, storedFile.mimeType);
              localName = storedFile.name;
              localMime = storedFile.mimeType;
              localUrl = URL.createObjectURL(storedFile.blob);
            }
          }

          if (localBlob) {
            if (!localMime || localMime === "audio/*") {
              localMime = inferMimeType(localName);
            }
            const normalized = normalizeBlob(localBlob, localMime);
            localUrl = URL.createObjectURL(normalized);
            localBlob = normalized;
          }

          if (!localUrl) {
            if (!cancelled) {
              setError("ローカル音声は再選択が必要です。ホームから選び直してください。");
            }
            return;
          }

          if (!cancelled) {
            setFileMeta({
              id: fileId,
              name: localName,
              mimeType: localMime
            });
            setAudioUrl(localUrl);
            setAudioBlob(localBlob);
          }

          if (localBlob && fileId) {
            await saveLocalFile({
              id: fileId,
              name: localName,
              mimeType: localMime,
              blob: normalizeBlob(localBlob, localMime),
              updatedAt: new Date().toISOString()
            });
          }

          const loadedClips = await listClips(effectiveUserSub, fileId);
          if (!cancelled) {
            setClips(loadedClips);
          }
          const history = await getHistoryItem(effectiveUserSub, fileId);
          if (!cancelled && history && storedSettings.autoResume) {
            setResumeAt(history.lastPosition);
          }
          return;
        }

        const storedOffline = await getLocalFile(fileId);
        if (!cancelled) {
          setOfflineSaved(Boolean(storedOffline));
        }

        if (storedOffline && !cancelled) {
          if (!storedOffline.blob.size) {
            setError("オフライン保存に失敗しました。容量不足の可能性があります。");
            setOfflineSaved(false);
            setLoading(false);
            return;
          }
          const normalizedBlob = normalizeBlob(storedOffline.blob, storedOffline.mimeType);
          setFileMeta({
            id: fileId,
            name: storedOffline.name,
            mimeType: storedOffline.mimeType
          });
          setAudioUrl(URL.createObjectURL(normalizedBlob));
          setAudioBlob(normalizedBlob);
        }

        const isOnline =
          typeof navigator !== "undefined" ? navigator.onLine : true;

        if (!effectiveUserSub) {
          if (storedOffline && !cancelled) {
            setLoading(false);
          }
          return;
        }

        const storedSettings = await getSettings(effectiveUserSub);
        if (!cancelled) {
          setSettings(storedSettings);
          setSpeed(storedSettings.defaultSpeed || 1);
        }

        const loadedClips = await listClips(effectiveUserSub, fileId);
        if (!cancelled) {
          setClips(loadedClips);
        }

        const history = await getHistoryItem(effectiveUserSub, fileId);
        if (!cancelled && history && storedSettings.autoResume) {
          setResumeAt(history.lastPosition);
        }

        if (storedOffline) {
          if (!cancelled) {
            setLoading(false);
          }
          if (!isOnline || !accessToken) {
            return;
          }
          return;
        }

        if (!accessToken) {
          return;
        }

        const meta = await fetchFileMeta(accessToken, fileId);
        if (!cancelled) {
          setFileMeta(meta);
        }

        // TODO: 将来的にはRange対応やストリーミング再生へ切り替える。
        const blob = await fetchAudioBlob(accessToken, fileId);
        if (!cancelled) {
          const normalizedBlob = normalizeBlob(blob, meta.mimeType);
          const url = URL.createObjectURL(normalizedBlob);
          setAudioUrl(url);
          setAudioBlob(normalizedBlob);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [
    fileId,
    accessToken,
    effectiveUserSub,
    isLocal,
    locationState?.blobUrl,
    locationState?.name,
    locationState?.mimeType
  ]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      sourceNodeRef.current?.disconnect();
      filterNodeRef.current?.disconnect();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (!sourceNodeRef.current) {
      sourceNodeRef.current = context.createMediaElementSource(audio);
    }
    sourceNodeRef.current.disconnect();
    filterNodeRef.current?.disconnect();
    if (settings?.noiseReduction) {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 8000;
      filter.Q.value = 0.7;
      filterNodeRef.current = filter;
      sourceNodeRef.current.connect(filter);
      filter.connect(context.destination);
    } else {
      filterNodeRef.current = null;
      sourceNodeRef.current.connect(context.destination);
    }
    return () => {
      sourceNodeRef.current?.disconnect();
      filterNodeRef.current?.disconnect();
    };
  }, [settings?.noiseReduction]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      return;
    }
    audio.load();
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      const nextDuration = getDurationValue(audio);
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    };
    const onDuration = () => {
      const nextDuration = getDurationValue(audio);
      setDuration(nextDuration);
      if (resumeAt !== null) {
        audio.currentTime = resumeAt;
        setCurrentTime(resumeAt);
        setResumeAt(null);
      }
    };
    const onDurationChange = () => {
      const nextDuration = getDurationValue(audio);
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    };
    const onError = () => {
      setError("音声の読み込みに失敗しました。別のファイルを選択してください。");
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onCanPlay = () => {
      if (!pendingPlayRef.current) {
        return;
      }
      pendingPlayRef.current = false;
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setError("再生できませんでした。もう一度お試しください。");
        });
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("loadeddata", onDuration);
    audio.addEventListener("canplay", onDuration);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("error", onError);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("loadeddata", onDuration);
      audio.removeEventListener("canplay", onDuration);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioRef, resumeAt]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      return;
    }
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setCurrentTime(audio.currentTime || 0);
      const nextDuration = getDurationValue(audio);
      if (nextDuration > 0) {
        setDuration(nextDuration);
        window.clearInterval(timer);
      } else if (ticks >= 20) {
        window.clearInterval(timer);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [audioUrl]);

  useEffect(() => {
    if (!fileId || !effectiveUserSub || !fileMeta) {
      return;
    }
    const save = async () => {
      const history: HistoryItem = {
        id: `${effectiveUserSub}:${fileId}`,
        driveFileId: fileId,
        userSub: effectiveUserSub,
        name: fileMeta.name ?? locationState?.name ?? "音声ファイル",
        mimeType: fileMeta.mimeType ?? "audio/*",
        lastPlayedAt: new Date().toISOString(),
        lastPosition: currentTime
      };
      await saveHistory(history);
    };
    const timeout = setTimeout(() => {
      void save();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [currentTime, fileId, effectiveUserSub, fileMeta, locationState?.name]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handlePlayToggle = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      if (audio.readyState < 2) {
        pendingPlayRef.current = true;
        audio.load();
        return;
      }
      try {
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setPlaying(true);
      } catch {
        setError("再生できませんでした。もう一度お試しください。");
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const handleSeekAndPlay = (value: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = value;
    setCurrentTime(value);
    void handlePlayToggle();
  };

  const handleSkip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  };

  const handleClipAdd = async () => {
    if (!fileId || !effectiveUserSub) {
      return;
    }
    const now = new Date().toISOString();
    const clipId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const newClip = {
      clipId,
      driveFileId: fileId,
      userSub: effectiveUserSub,
      timeSec: Math.floor(currentTime),
      title: "",
      memo: "",
      createdAt: now,
      updatedAt: now
    };
    const id = await addClip(newClip);
    setClips((prev) => [{ ...newClip, id, fileKey: buildFileKey(effectiveUserSub, fileId) }, ...prev]);
  };

  const updateClipState = (clipId: string, updates: Partial<Clip>) => {
    setClips((prev) =>
      prev.map((clip) => (clip.id === clipId ? { ...clip, ...updates } : clip))
    );
  };

  const handleClipSave = async (clip: Clip) => {
    const updated = { ...clip, updatedAt: new Date().toISOString() };
    updateClipState(clip.id, { updatedAt: updated.updatedAt });
    await updateClip(updated);
  };

  const handleClipDelete = async (clipId: string) => {
    await deleteClip(clipId);
    setClips((prev) => prev.filter((clip) => clip.id !== clipId));
  };

  const handleDownload = () => {
    if (!audioBlob) {
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    const name = fileMeta?.name ?? "audio";
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleOfflineSave = async () => {
    if (!audioBlob || !fileId || !fileMeta) {
      return;
    }
    setSavingOffline(true);
    try {
      await saveLocalFile({
        id: fileId,
        name: fileMeta.name ?? "音声ファイル",
        mimeType: fileMeta.mimeType ?? "audio/*",
        blob: normalizeBlob(audioBlob, fileMeta.mimeType),
        updatedAt: new Date().toISOString()
      });
      setOfflineSaved(true);
    } catch {
      setError("オフライン保存に失敗しました。容量不足の可能性があります。");
    } finally {
      setSavingOffline(false);
    }
  };

  const handleOfflineRemove = async () => {
    if (!fileId) {
      return;
    }
    await deleteLocalFile(fileId);
    setOfflineSaved(false);
  };

  const sortedClips = useMemo(() => {
    const copy = [...clips];
    return copy.sort((a, b) =>
      clipSort === "new" ? b.createdAt.localeCompare(a.createdAt) : a.timeSec - b.timeSec
    );
  }, [clips, clipSort]);

  if (!fileId) {
    return <div className="card">音声ファイルが指定されていません。</div>;
  }

  if (!accessToken && !isLocal) {
    return <div className="card">ログイン後に利用できます。</div>;
  }

  if (loading) {
    return <div className="card">読み込み中...</div>;
  }

  if (error) {
    return <div className="card error">{error}</div>;
  }

  return (
    <section className="player">
      <div className="section">
        <h2>{fileMeta?.name ?? locationState?.name ?? "音声ファイル"}</h2>
        <p className="helper">速度や位置は設定でデフォルト値を変更できます。</p>
      </div>

      <div className="player-card">
        <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" playsInline />
        <div className="time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={currentTime}
          onChange={(e) => handleSeek(Number(e.target.value))}
        />
        <div className="controls">
          <button className="ghost" onClick={() => handleSkip(-10)}>
            10秒戻し
          </button>
          <button
            className="primary"
            onClick={handlePlayToggle}
            disabled={!audioUrl}
          >
            {playing ? "一時停止" : "再生"}
          </button>
          <button className="ghost" onClick={() => handleSkip(30)}>
            30秒送り
          </button>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={handleDownload} disabled={!audioBlob}>
            音声を保存
          </button>
          {!isLocal && (
            <>
              <button
                className="secondary"
                onClick={handleOfflineSave}
                disabled={!audioBlob || savingOffline || offlineSaved}
              >
                {offlineSaved ? "オフライン保存済み" : "オフライン保存"}
              </button>
              {offlineSaved && (
                <button className="ghost" onClick={handleOfflineRemove}>
                  保存解除
                </button>
              )}
            </>
          )}
        </div>
        <div className="speed-row">
          {speedOptions.map((option) => (
            <button
              key={option}
              className={speed === option ? "chip speed-chip active" : "chip speed-chip"}
              onClick={() => setSpeed(option)}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <div className="sticky-actions">
        <button className="primary" onClick={handleClipAdd}>
          + クリップを追加
        </button>
        <div className="status">
          {settings?.autoResume ? "続きから再生: ON" : "続きから再生: OFF"}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3>クリップ一覧</h3>
          <div className="chip-group">
            <button
              className={clipSort === "new" ? "chip active" : "chip"}
              onClick={() => setClipSort("new")}
            >
              新しい順
            </button>
            <button
              className={clipSort === "time" ? "chip active" : "chip"}
              onClick={() => setClipSort("time")}
            >
              時刻順
            </button>
          </div>
        </div>

        {sortedClips.length === 0 && <div className="card">まだクリップがありません。</div>}

        <div className="clip-grid">
          {sortedClips.map((clip) => (
            <div className="clip-card" key={clip.id}>
              <div className="clip-header">
                <button className="chip" onClick={() => handleSeekAndPlay(clip.timeSec)}>
                  {formatTime(clip.timeSec)} に移動
                </button>
                <button className="ghost small" onClick={() => handleClipDelete(clip.id)}>
                  削除
                </button>
              </div>
              <input
                className="clip-title"
                placeholder="タイトル（後から入力OK）"
                value={clip.title}
                onChange={(e) => updateClipState(clip.id, { title: e.target.value })}
              />
              <textarea
                className="clip-memo"
                placeholder="メモ"
                value={clip.memo}
                onChange={(e) => updateClipState(clip.id, { memo: e.target.value })}
              />
              <div className="clip-footer">
                <span className="clip-date">更新 {new Date(clip.updatedAt).toLocaleString("ja-JP")}</span>
                <button className="secondary" onClick={() => handleClipSave(clip)}>
                  保存
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlayerPage;
