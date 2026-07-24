import type { InstagramMediaType } from "@prisma/client";

export const INSTAGRAM_API_VERSION = "v25.0";
export const INSTAGRAM_GRAPH_HOST = "https://graph.facebook.com";
export const INSTAGRAM_OAUTH_AUTHORIZE_URL =
  `https://www.facebook.com/${INSTAGRAM_API_VERSION}/dialog/oauth`;
export const INSTAGRAM_OAUTH_TOKEN_URL =
  `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/oauth/access_token`;
export const INSTAGRAM_REQUIRED_SCOPES = [
  "instagram_basic",
  "pages_read_engagement",
  "pages_show_list"
] as const;
export const INSTAGRAM_REQUIRED_SCOPE = INSTAGRAM_REQUIRED_SCOPES.join(",");
export const INSTAGRAM_SYNC_MEDIA_LIMIT = 27;
export const INSTAGRAM_CATALOG_UNSELECTED_LIMIT = 24;
export const INSTAGRAM_PUBLIC_DEFAULT_LIMIT = 3;
export const INSTAGRAM_META_FETCH_TIMEOUT_MS = 15_000;
export const INSTAGRAM_SELECTION_SLOTS = [
  "primary",
  "upperRight",
  "lowerRight"
] as const;

export type InstagramMediaTypeValue = InstagramMediaType;

export interface InstagramConnectionRecord {
  id: string;
  instagramUserId: string;
  facebookPageId: string;
  facebookPageName: string;
  username: string;
  accountType: string | null;
  encryptedAccessToken: string;
  tokenExpiresAt: Date;
  scopes: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  connectedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstagramMediaRecord {
  id: string;
  connectionId: string;
  instagramMediaId: string;
  mediaType: InstagramMediaType;
  caption: string | null;
  altText: string | null;
  permalink: string;
  imageUrl: string;
  isCollaborative: boolean;
  publishedAt: Date;
  isAvailable: boolean;
  unavailableAt: Date | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedInstagramMedia {
  instagramMediaId: string;
  mediaType: InstagramMediaType;
  caption: string | null;
  altText: string | null;
  permalink: string;
  imageSourceUrl: string;
  isCollaborative: boolean;
  publishedAt: Date;
}

export interface InstagramSyncResult {
  synced: number;
  unavailable: number;
  connectionId: string;
  username: string;
}
