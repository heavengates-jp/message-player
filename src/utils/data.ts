import { dbPromise, buildClipId, buildFileKey } from "./db";
import type { Clip, HistoryItem, LocalFile, Settings } from "./types";

export const defaultSettings = (userSub: string): Settings => ({
  userSub,
  autoResume: true,
  defaultSpeed: 1,
  noiseReduction: true
});

export const getSettings = async (userSub: string) => {
  const db = await dbPromise;
  const stored = await db.get("settings", userSub);
  const defaults = defaultSettings(userSub);
  if (!stored) {
    return defaults;
  }
  return { ...defaults, ...stored };
};

export const saveSettings = async (settings: Settings) => {
  const db = await dbPromise;
  await db.put("settings", settings);
};

export const addClip = async (clip: Omit<Clip, "id">) => {
  const db = await dbPromise;
  const id = buildClipId(clip.userSub, clip.driveFileId, clip.clipId);
  const fileKey = buildFileKey(clip.userSub, clip.driveFileId);
  await db.put("clips", { ...clip, id, fileKey });
  return id;
};

export const updateClip = async (clip: Clip) => {
  const db = await dbPromise;
  const fileKey = clip.fileKey ?? buildFileKey(clip.userSub, clip.driveFileId);
  await db.put("clips", { ...clip, fileKey });
};

export const deleteClip = async (clipId: string) => {
  const db = await dbPromise;
  await db.delete("clips", clipId);
};

export const listClips = async (userSub: string, driveFileId: string) => {
  const db = await dbPromise;
  const fileKey = buildFileKey(userSub, driveFileId);
  return await db.getAllFromIndex("clips", "by-file", fileKey);
};

export const saveHistory = async (item: HistoryItem) => {
  const db = await dbPromise;
  await db.put("history", item);
};

export const listHistory = async (userSub: string) => {
  const db = await dbPromise;
  return await db.getAllFromIndex("history", "by-user", userSub);
};

export const getHistoryItem = async (userSub: string, driveFileId: string) => {
  const db = await dbPromise;
  const id = buildFileKey(userSub, driveFileId);
  return await db.get("history", id);
};

export const deleteHistoryItem = async (userSub: string, driveFileId: string) => {
  const db = await dbPromise;
  const id = buildFileKey(userSub, driveFileId);
  await db.delete("history", id);
};

export const saveLocalFile = async (file: LocalFile) => {
  const db = await dbPromise;
  await db.put("localFiles", file);
};

export const getLocalFile = async (id: string) => {
  const db = await dbPromise;
  return await db.get("localFiles", id);
};

export const deleteLocalFile = async (id: string) => {
  const db = await dbPromise;
  await db.delete("localFiles", id);
};
