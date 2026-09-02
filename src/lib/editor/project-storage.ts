import type { LocalAsset } from "@/components/editor/hooks/editor-session-types";
import type { ProjectSession } from "./types";

const DATABASE_NAME = "inkframe-editor";
const STORE_NAME = "projects";
const PROJECT_KEY = "latest";
const DATABASE_VERSION = 1;

interface PersistedAsset {
  assetId: string;
  kind: LocalAsset["kind"];
  mimeType: string;
  name: string;
  size: number;
  externalUrl?: string;
  attribution?: LocalAsset["attribution"];
  blob?: Blob;
}

interface PersistedProject {
  key: typeof PROJECT_KEY;
  savedAt: number;
  project: ProjectSession;
  assets: PersistedAsset[];
}

export interface RestoredProject {
  project: ProjectSession;
  assets: PersistedAsset[];
  savedAt: number;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open project storage."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const saveProjectSnapshot = async (
  project: ProjectSession,
  assets: readonly LocalAsset[],
): Promise<void> => {
  const database = await openDatabase();
  try {
    const persisted: PersistedProject = {
      key: PROJECT_KEY,
      savedAt: Date.now(),
      project,
      assets: assets.map((asset) => ({
        assetId: asset.assetId,
        kind: asset.kind,
        mimeType: asset.mimeType,
        name: asset.name,
        size: asset.size,
        externalUrl: asset.externalUrl,
        attribution: asset.attribution,
        blob: asset.file,
      })),
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(persisted);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Project save failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project save aborted."));
    });
  } finally {
    database.close();
  }
};

export const loadProjectSnapshot = async (): Promise<RestoredProject | null> => {
  const database = await openDatabase();
  try {
    const result = await new Promise<PersistedProject | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(PROJECT_KEY);
      request.onsuccess = () => resolve(request.result as PersistedProject | undefined);
      request.onerror = () => reject(request.error ?? new Error("Project restore failed."));
    });

    if (!result) return null;
    return {
      project: result.project,
      assets: result.assets,
      savedAt: result.savedAt,
    };
  } finally {
    database.close();
  }
};
