import type { LocalAsset } from "@/components/editor/hooks/editor-session-types";
import type { ProjectSession } from "./types";
import { migrateProjectContent } from "./project-migrations";

const DATABASE_NAME = "inkframe-editor";
const PROJECT_STORE_NAME = "projects";
const ASSET_STORE_NAME = "assets";
const PROJECT_KEY = "latest";
const DATABASE_VERSION = 2;

interface PersistedAssetMetadata {
  assetId: string;
  kind: LocalAsset["kind"];
  mimeType: string;
  name: string;
  size: number;
  externalUrl?: string;
  attribution?: LocalAsset["attribution"];
  mediaMetadata?: LocalAsset["mediaMetadata"];
}

interface PersistedAssetBlob {
  assetId: string;
  fingerprint: string;
  blob: Blob;
}

interface PersistedProjectV2 {
  key: typeof PROJECT_KEY;
  schemaVersion: 2;
  savedAt: number;
  project: ProjectSession;
  assets: PersistedAssetMetadata[];
}

interface PersistedProjectV1 {
  key: typeof PROJECT_KEY;
  savedAt: number;
  project: ProjectSession;
  assets: Array<PersistedAssetMetadata & { blob?: Blob }>;
}

export interface RestoredProject {
  project: ProjectSession;
  assets: Array<PersistedAssetMetadata & { blob?: Blob }>;
  savedAt: number;
}

export interface ProjectSaveResult {
  savedAt: number;
  writtenAssetBlobs: number;
  reusedAssetBlobs: number;
  removedAssetBlobs: number;
}

const validateAssetMetadata = (assets: readonly PersistedAssetMetadata[]): void => {
  for (const asset of assets) {
    const metadata = asset.mediaMetadata;
    if (metadata === undefined) continue;
    if (!metadata || !Number.isSafeInteger(metadata.durationUs) || metadata.durationUs <= 0 ||
      [metadata.width, metadata.height].some((value) => value !== undefined && (!Number.isSafeInteger(value) || value <= 0))) {
      throw new Error(`Asset ${asset.assetId} has invalid media metadata.`);
    }
  }
};

const assetFingerprint = (asset: LocalAsset): string =>
  [asset.name, asset.mimeType, asset.size, asset.file?.lastModified ?? 0].join(":");

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
      if (!database.objectStoreNames.contains(PROJECT_STORE_NAME)) {
        database.createObjectStore(PROJECT_STORE_NAME, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        database.createObjectStore(ASSET_STORE_NAME, { keyPath: "assetId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const getProjectStorageErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "Local autosave is full. Remove unused media or free browser storage, then retry.";
  }
  if (error instanceof DOMException && error.name === "SecurityError") {
    return "Local autosave is blocked by this browser's privacy settings.";
  }
  return error instanceof Error
    ? `Local autosave failed: ${error.message}`
    : "Local autosave failed. Your current edit is still open in this tab.";
};

export const saveProjectSnapshot = async (
  project: ProjectSession,
  assets: readonly LocalAsset[],
): Promise<ProjectSaveResult> => {
  validateAssetMetadata(assets);
  const migratedProject = migrateProjectContent(project);
  const database = await openDatabase();
  const savedAt = Date.now();
  let writtenAssetBlobs = 0;
  let reusedAssetBlobs = 0;
  let removedAssetBlobs = 0;

  try {
    const persisted: PersistedProjectV2 = {
      key: PROJECT_KEY,
      schemaVersion: 2,
      savedAt,
      project: migratedProject,
      assets: assets.map(({ assetId, kind, mimeType, name, size, externalUrl, attribution, mediaMetadata }) => ({
        assetId,
        kind,
        mimeType,
        name,
        size,
        externalUrl,
        attribution,
        mediaMetadata,
      })),
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [PROJECT_STORE_NAME, ASSET_STORE_NAME],
        "readwrite",
      );
      const projectStore = transaction.objectStore(PROJECT_STORE_NAME);
      const assetStore = transaction.objectStore(ASSET_STORE_NAME);
      projectStore.put(persisted);

      const activeIds = new Set(assets.map((asset) => asset.assetId));
      const existingKeysRequest = assetStore.getAllKeys();
      existingKeysRequest.onsuccess = () => {
        for (const key of existingKeysRequest.result) {
          if (typeof key === "string" && !activeIds.has(key)) {
            assetStore.delete(key);
            removedAssetBlobs += 1;
          }
        }
      };

      for (const asset of assets) {
        if (!asset.file) continue;
        const fingerprint = assetFingerprint(asset);
        const request = assetStore.get(asset.assetId);
        request.onsuccess = () => {
          const existing = request.result as PersistedAssetBlob | undefined;
          if (existing?.fingerprint === fingerprint) {
            reusedAssetBlobs += 1;
            return;
          }
          assetStore.put({ assetId: asset.assetId, fingerprint, blob: asset.file });
          writtenAssetBlobs += 1;
        };
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Project save failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project save aborted."));
    });

    return { savedAt, writtenAssetBlobs, reusedAssetBlobs, removedAssetBlobs };
  } finally {
    database.close();
  }
};

export const loadProjectSnapshot = async (): Promise<RestoredProject | null> => {
  const database = await openDatabase();
  try {
    const result = await new Promise<PersistedProjectV2 | PersistedProjectV1 | undefined>(
      (resolve, reject) => {
        const transaction = database.transaction(PROJECT_STORE_NAME, "readonly");
        const request = transaction.objectStore(PROJECT_STORE_NAME).get(PROJECT_KEY);
        request.onsuccess = () => resolve(
          request.result as PersistedProjectV2 | PersistedProjectV1 | undefined,
        );
        request.onerror = () => reject(request.error ?? new Error("Project restore failed."));
      },
    );

    if (!result) return null;
    validateAssetMetadata(result.assets);
    const project = migrateProjectContent(result.project);
    // Upgrade only project metadata: keep the storage layout, saved timestamp,
    // and all existing asset records/fingerprints intact.
    if (result.project.contentVersion === undefined) {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(PROJECT_STORE_NAME, "readwrite");
        transaction.objectStore(PROJECT_STORE_NAME).put({ ...result, project });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Project migration failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Project migration aborted."));
      });
    }
    if (!("schemaVersion" in result) || result.schemaVersion !== 2) {
      return { project, assets: result.assets, savedAt: result.savedAt };
    }

    const blobs = await new Promise<Map<string, Blob>>((resolve, reject) => {
      const transaction = database.transaction(ASSET_STORE_NAME, "readonly");
      const request = transaction.objectStore(ASSET_STORE_NAME).getAll();
      request.onsuccess = () => resolve(
        new Map(
          (request.result as PersistedAssetBlob[]).map((asset) => [asset.assetId, asset.blob]),
        ),
      );
      request.onerror = () => reject(request.error ?? new Error("Asset restore failed."));
    });

    return {
      project,
      assets: result.assets.map((asset) => ({ ...asset, blob: blobs.get(asset.assetId) })),
      savedAt: result.savedAt,
    };
  } finally {
    database.close();
  }
};
