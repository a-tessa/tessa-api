import type {
  InstagramConnectionRecord,
  InstagramMediaRecord
} from "./instagram.types.js";
import type {
  InstagramCuratorCatalog,
  SelectedInstagramMedia
} from "./instagram.service.js";

export function serializeInstagramMedia(
  media: InstagramMediaRecord | SelectedInstagramMedia
) {
  return {
    id: media.id,
    instagramMediaId: media.instagramMediaId,
    mediaType: media.mediaType,
    caption: media.caption,
    altText: media.altText,
    permalink: media.permalink,
    imageUrl: media.imageUrl,
    isCollaborative: media.isCollaborative,
    isAvailable: media.isAvailable,
    unavailableAt: media.unavailableAt?.toISOString() ?? null,
    publishedAt: media.publishedAt.toISOString(),
    syncedAt: media.syncedAt.toISOString(),
    ...("slot" in media ? { slot: media.slot } : {})
  };
}

export function serializeInstagramMediaResponse(
  media: SelectedInstagramMedia[]
) {
  return {
    media: media.map(serializeInstagramMedia)
  };
}

export function serializeInstagramConnectionStatus(
  connection: InstagramConnectionRecord | null,
  media: InstagramMediaRecord[] = []
) {
  if (!connection) {
    return {
      connected: false as const,
      connection: null,
      media: []
    };
  }

  return {
    connected: true as const,
    connection: {
      id: connection.id,
      username: connection.username,
      facebookPageId: connection.facebookPageId,
      facebookPageName: connection.facebookPageName,
      accountType: connection.accountType,
      tokenExpiresAt: connection.tokenExpiresAt.toISOString(),
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: connection.lastSyncError,
      scopes: connection.scopes.split(",").filter(Boolean),
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString()
    },
    media: media.map(serializeInstagramMedia)
  };
}

export function serializeInstagramCuratorCatalog(
  catalog: InstagramCuratorCatalog
) {
  return {
    updatedAt: catalog.updatedAt.toISOString(),
    draftSelection: catalog.draftSelection,
    publishedSelection: catalog.publishedSelection,
    media: catalog.media.map((item) => ({
      ...serializeInstagramMedia(item),
      isLocalized: item.isLocalized
    }))
  };
}

export function serializeInstagramSyncResponse(result: {
  synced: number;
  unavailable: number;
  connectionId: string;
  username: string;
}) {
  return {
    ok: true,
    ...result
  };
}
