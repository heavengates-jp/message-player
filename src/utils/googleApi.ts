import type { DriveFile } from "./types";

const API_BASE = "https://www.googleapis.com/drive/v3";

export const fetchUserInfo = async (accessToken: string) => {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return (await res.json()) as { sub: string; name?: string };
};

export const listAudioFiles = async (accessToken: string) => {
  const params = new URLSearchParams({
    q: "mimeType contains 'audio/' and trashed = false",
    fields: "files(id,name,mimeType,modifiedTime,size)",
    orderBy: "modifiedTime desc",
    pageSize: "50"
  });
  const res = await fetch(`${API_BASE}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error("Failed to list Drive audio files");
  }
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files ?? [];
};

export const fetchFileMeta = async (accessToken: string, fileId: string) => {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,modifiedTime,size"
  });
  const res = await fetch(`${API_BASE}/files/${fileId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch file metadata");
  }
  return (await res.json()) as DriveFile;
};

export const fetchAudioBlob = async (accessToken: string, fileId: string) => {
  const res = await fetch(`${API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error("Failed to fetch audio data");
  }
  return await res.blob();
};