import { openDB, DBSchema } from "idb";
import type { Clip, HistoryItem, LocalFile, Settings } from "./types";

interface ClipDB extends DBSchema {
  clips: {
    key: string;
    value: Clip;
    indexes: { "by-file": string };
  };
  history: {
    key: string;
    value: HistoryItem;
    indexes: { "by-user": string };
  };
  settings: {
    key: string;
    value: Settings;
  };
  localFiles: {
    key: string;
    value: LocalFile;
  };
}

export const dbPromise = openDB<ClipDB>("seisho-clips", 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const clipStore = db.createObjectStore("clips", { keyPath: "id" });
      clipStore.createIndex("by-file", "fileKey");

      const historyStore = db.createObjectStore("history", { keyPath: "id" });
      historyStore.createIndex("by-user", "userSub");

      db.createObjectStore("settings", { keyPath: "userSub" });
    }
    if (oldVersion < 2) {
      db.createObjectStore("localFiles", { keyPath: "id" });
    }
  }
});

export const buildFileKey = (userSub: string, driveFileId: string) =>
  `${userSub}:${driveFileId}`;

export const buildClipId = (userSub: string, driveFileId: string, clipId: string) =>
  `${userSub}:${driveFileId}:${clipId}`;
