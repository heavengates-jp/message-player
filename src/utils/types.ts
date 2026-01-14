export type Clip = {
  id: string;
  clipId: string;
  driveFileId: string;
  userSub: string;
  fileKey?: string;
  timeSec: number;
  title: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

export type HistoryItem = {
  id: string;
  driveFileId: string;
  userSub: string;
  name: string;
  mimeType: string;
  lastPlayedAt: string;
  lastPosition: number;
};

export type LocalFile = {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  updatedAt: string;
};

export type Settings = {
  userSub: string;
  autoResume: boolean;
  defaultSpeed: number;
  noiseReduction: boolean;
};
