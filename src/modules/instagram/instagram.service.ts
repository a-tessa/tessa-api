import { env } from "../../env.js";
import {
  badRequest,
  conflict,
  internalServerError,
  notFound
} from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  parseDraftContent,
  toDraftContentInput
} from "../content/content.utils.js";
import type {
  DraftContent,
  InstagramSelection
} from "../content/content.types.js";
import { INSTAGRAM_ENTITY_TYPE } from "../translation/translation.config.js";
import {
  enqueueInstagramMediaTranslations,
  findLocalizedInstagramMediaIds,
  processEntityTranslations,
  runTranslationsInBackground
} from "../translation/translation.service.js";
import {
  buildInstagramAuthorizeUrl,
  exchangeLongLivedToken,
  fetchCollaborativeMedia,
  fetchFacebookPages,
  fetchInstagramMe,
  fetchMediaById,
  fetchRecentMedia,
  isInstagramIntegrationConfigured
} from "./instagram.client.js";
import { createOAuthState, decryptSecret, encryptSecret, verifyOAuthState } from "./instagram.crypto.js";
import { normalizeInstagramMediaList } from "./instagram.media.js";
import type {
  InstagramConnectionRecord,
  InstagramMediaRecord,
  InstagramSyncResult,
  NormalizedInstagramMedia
} from "./instagram.types.js";
import {
  INSTAGRAM_CATALOG_UNSELECTED_LIMIT,
  INSTAGRAM_PUBLIC_DEFAULT_LIMIT,
  INSTAGRAM_REQUIRED_SCOPE,
  INSTAGRAM_SYNC_MEDIA_LIMIT,
  INSTAGRAM_SELECTION_SLOTS
} from "./instagram.types.js";

const connectionSelect = {
  id: true,
  instagramUserId: true,
  facebookPageId: true,
  facebookPageName: true,
  username: true,
  accountType: true,
  encryptedAccessToken: true,
  tokenExpiresAt: true,
  scopes: true,
  lastSyncedAt: true,
  lastSyncError: true,
  connectedById: true,
  createdAt: true,
  updatedAt: true
} as const;

const mediaSelect = {
  id: true,
  connectionId: true,
  instagramMediaId: true,
  mediaType: true,
  caption: true,
  altText: true,
  permalink: true,
  imageUrl: true,
  isCollaborative: true,
  publishedAt: true,
  isAvailable: true,
  unavailableAt: true,
  syncedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

const MAIN_CONTENT_SLUG = "home";

export interface InstagramCuratorCatalog {
  updatedAt: Date;
  draftSelection: InstagramSelection | null;
  publishedSelection: InstagramSelection | null;
  media: Array<InstagramMediaRecord & { isLocalized: boolean }>;
}

export type SelectedInstagramMedia = InstagramMediaRecord & {
  slot: (typeof INSTAGRAM_SELECTION_SLOTS)[number];
};

function adminRedirect(path: string): string {
  const base = env.ADMIN_APP_URL ?? "http://localhost:5174";
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

async function getPrimaryConnection(): Promise<InstagramConnectionRecord | null> {
  return prisma.instagramConnection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: connectionSelect
  });
}

async function ensureFreshAccessToken(
  connection: InstagramConnectionRecord
): Promise<{ accessToken: string; connection: InstagramConnectionRecord }> {
  const accessToken = decryptSecret(connection.encryptedAccessToken);

  if (connection.tokenExpiresAt.getTime() <= Date.now()) {
    badRequest(
      "Token do Facebook expirado. Reconecte a conta no painel administrativo."
    );
  }

  return { accessToken, connection };
}

async function upsertSyncedMedia(
  connection: InstagramConnectionRecord,
  mediaItems: NormalizedInstagramMedia[]
): Promise<number> {
  let synced = 0;

  for (const media of mediaItems) {
    const existing = await prisma.instagramMedia.findUnique({
      where: { instagramMediaId: media.instagramMediaId },
      select: {
        id: true,
        caption: true,
        altText: true
      }
    });

    const captionChanged = existing?.caption !== media.caption;
    const altChanged = existing?.altText !== media.altText;

    const savedMedia = await prisma.instagramMedia.upsert({
      where: { instagramMediaId: media.instagramMediaId },
      create: {
        connectionId: connection.id,
        instagramMediaId: media.instagramMediaId,
        mediaType: media.mediaType,
        caption: media.caption,
        altText: media.altText,
        permalink: media.permalink,
        imageUrl: media.imageSourceUrl,
        isCollaborative: media.isCollaborative,
        publishedAt: media.publishedAt,
        isAvailable: true,
        unavailableAt: null,
        syncedAt: new Date()
      },
      update: {
        connectionId: connection.id,
        mediaType: media.mediaType,
        caption: media.caption,
        altText: media.altText,
        permalink: media.permalink,
        imageUrl: media.imageSourceUrl,
        isCollaborative: media.isCollaborative,
        publishedAt: media.publishedAt,
        isAvailable: true,
        unavailableAt: null,
        syncedAt: new Date()
      },
      select: mediaSelect
    });

    if (!existing || captionChanged || altChanged) {
      await enqueueInstagramMediaTranslations(savedMedia);
      runTranslationsInBackground(
        processEntityTranslations(INSTAGRAM_ENTITY_TYPE, savedMedia.id)
      );
    }

    synced += 1;
  }

  return synced;
}

export async function startInstagramOAuth(userId: string): Promise<{ authorizeUrl: string }> {
  if (!isInstagramIntegrationConfigured()) {
    internalServerError("Integração do Instagram não configurada.");
  }

  const state = createOAuthState(userId);
  return { authorizeUrl: buildInstagramAuthorizeUrl(state) };
}

export async function completeInstagramOAuth(input: {
  state: string;
  accessToken?: string | undefined;
  longLivedToken?: string | undefined;
  expiresIn?: number | undefined;
  dataAccessExpirationTime?: number | undefined;
}): Promise<string> {
  try {
    const { userId } = verifyOAuthState(input.state);
    const token = input.longLivedToken
      ? {
          accessToken: input.longLivedToken,
          expiresIn: input.dataAccessExpirationTime
            ? Math.min(
                60 * 24 * 60 * 60,
                Math.max(
                  60,
                  input.dataAccessExpirationTime -
                    Math.floor(Date.now() / 1000)
                )
              )
            : 60 * 24 * 60 * 60
        }
      : await exchangeLongLivedToken(input.accessToken ?? "");
    const pages = await fetchFacebookPages(token.accessToken);
    const selectedPage = env.INSTAGRAM_FACEBOOK_PAGE_ID
      ? pages.find((page) => page.id === env.INSTAGRAM_FACEBOOK_PAGE_ID)
      : pages.length === 1
        ? pages[0]
        : null;

    if (!selectedPage) {
      const message =
        pages.length === 0
          ? "Nenhuma Página do Facebook com uma conta profissional do Instagram vinculada foi encontrada."
          : "Mais de uma Página elegível foi encontrada. Configure INSTAGRAM_FACEBOOK_PAGE_ID.";
      badRequest(message);
    }

    const me = await fetchInstagramMe(
      selectedPage.instagramUserId,
      token.accessToken
    );

    const existing = await prisma.instagramConnection.findFirst({
      select: { id: true }
    });

    const tokenExpiresAt = new Date(Date.now() + token.expiresIn * 1000);
    const encryptedAccessToken = encryptSecret(token.accessToken);

    const connection = existing
      ? await prisma.instagramConnection.update({
          where: { id: existing.id },
          data: {
            instagramUserId: me.userId,
            facebookPageId: selectedPage.id,
            facebookPageName: selectedPage.name,
            username: me.username,
            accountType: me.accountType,
            encryptedAccessToken,
            tokenExpiresAt,
            scopes: INSTAGRAM_REQUIRED_SCOPE,
            connectedById: userId,
            lastSyncError: null
          },
          select: connectionSelect
        })
      : await prisma.instagramConnection.create({
          data: {
            instagramUserId: me.userId,
            facebookPageId: selectedPage.id,
            facebookPageName: selectedPage.name,
            username: me.username,
            accountType: me.accountType,
            encryptedAccessToken,
            tokenExpiresAt,
            scopes: INSTAGRAM_REQUIRED_SCOPE,
            connectedById: userId
          },
          select: connectionSelect
        });

    try {
      await syncInstagramMedia(connection.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.instagramConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: message.slice(0, 1000) }
      });
    }

    return adminRedirect("/conteudo/instagram?connected=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return adminRedirect(`/conteudo/instagram?error=${encodeURIComponent(message)}`);
  }
}

export async function getInstagramConnectionStatus(): Promise<{
  connection: InstagramConnectionRecord | null;
  media: InstagramMediaRecord[];
}> {
  const connection = await getPrimaryConnection();
  if (!connection) {
    return { connection: null, media: [] };
  }

  const media = await prisma.instagramMedia.findMany({
    where: { connectionId: connection.id },
    orderBy: { publishedAt: "desc" },
    take: INSTAGRAM_SYNC_MEDIA_LIMIT,
    select: mediaSelect
  });

  return { connection, media };
}

export async function disconnectInstagram(): Promise<void> {
  const connection = await getPrimaryConnection();
  if (!connection) {
    notFound("Nenhuma conta do Instagram conectada.");
  }

  const mediaItems = await prisma.instagramMedia.findMany({
    where: { connectionId: connection.id },
    select: { id: true }
  });
  const page = await prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG }
  });

  await prisma.$transaction(async (transaction) => {
    if (page) {
      const draftContent = parseDraftContent(page.draftContent);
      const publishedContent = page.publishedContent
        ? parseDraftContent(page.publishedContent)
        : null;
      delete draftContent.instagramSelection;
      if (publishedContent) {
        delete publishedContent.instagramSelection;
      }

      await transaction.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput(draftContent),
          publishedContent: publishedContent
            ? toDraftContentInput(publishedContent)
            : undefined,
          status: "draft"
        }
      });
    }

    await transaction.translation.deleteMany({
      where: {
        entityType: INSTAGRAM_ENTITY_TYPE,
        entityId: { in: mediaItems.map((media) => media.id) }
      }
    });
    await transaction.instagramConnection.delete({
      where: { id: connection.id }
    });
  });
}

function getSelectionMediaIds(
  selection: InstagramSelection | null | undefined
): string[] {
  if (!selection) {
    return [];
  }

  return INSTAGRAM_SELECTION_SLOTS.map((slot) => selection[slot]);
}

async function findReferencedMedia(): Promise<
  Array<Pick<InstagramMediaRecord, "id" | "instagramMediaId" | "isCollaborative">>
> {
  const page = await prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG },
    select: { draftContent: true, publishedContent: true }
  });

  if (!page) {
    return [];
  }

  const draftSelection = parseDraftContent(page.draftContent).instagramSelection;
  const publishedSelection = page.publishedContent
    ? parseDraftContent(page.publishedContent).instagramSelection
    : null;
  const ids = [
    ...new Set([
      ...getSelectionMediaIds(draftSelection),
      ...getSelectionMediaIds(publishedSelection)
    ])
  ];

  if (ids.length === 0) {
    return [];
  }

  return prisma.instagramMedia.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      instagramMediaId: true,
      isCollaborative: true
    }
  });
}

export async function syncInstagramMedia(
  connectionId?: string
): Promise<InstagramSyncResult> {
  const connection = connectionId
    ? await prisma.instagramConnection.findUnique({
        where: { id: connectionId },
        select: connectionSelect
      })
    : await getPrimaryConnection();

  if (!connection) {
    notFound("Nenhuma conta do Instagram conectada.");
  }

  try {
    const { accessToken, connection: freshConnection } =
      await ensureFreshAccessToken(connection);
    const [ownedMedia, collaborativeMedia] = await Promise.all([
      fetchRecentMedia(
        freshConnection.instagramUserId,
        accessToken,
        INSTAGRAM_SYNC_MEDIA_LIMIT
      ),
      fetchCollaborativeMedia(
        freshConnection.instagramUserId,
        accessToken,
        INSTAGRAM_SYNC_MEDIA_LIMIT
      )
    ]);
    const normalizedByInstagramId = new Map<string, NormalizedInstagramMedia>();

    for (const media of normalizeInstagramMediaList(ownedMedia)) {
      normalizedByInstagramId.set(media.instagramMediaId, media);
    }
    for (const media of normalizeInstagramMediaList(collaborativeMedia, true)) {
      if (!normalizedByInstagramId.has(media.instagramMediaId)) {
        normalizedByInstagramId.set(media.instagramMediaId, media);
      }
    }

    const recentMedia = [...normalizedByInstagramId.values()]
      .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
      .slice(0, INSTAGRAM_SYNC_MEDIA_LIMIT);
    const recentIds = new Set(
      recentMedia.map((media) => media.instagramMediaId)
    );
    const referencedMedia = await findReferencedMedia();
    const unavailableIds: string[] = [];

    for (const selectedMedia of referencedMedia) {
      if (recentIds.has(selectedMedia.instagramMediaId)) {
        continue;
      }

      try {
        const refreshed = await fetchMediaById(
          selectedMedia.instagramMediaId,
          accessToken
        );
        const normalized = normalizeInstagramMediaList(
          [refreshed],
          selectedMedia.isCollaborative
        )[0];

        if (normalized) {
          recentMedia.push(normalized);
        } else {
          unavailableIds.push(selectedMedia.id);
        }
      } catch {
        unavailableIds.push(selectedMedia.id);
      }
    }

    const synced = await upsertSyncedMedia(freshConnection, recentMedia);

    if (unavailableIds.length > 0) {
      await prisma.instagramMedia.updateMany({
        where: { id: { in: unavailableIds } },
        data: {
          isAvailable: false,
          unavailableAt: new Date(),
          syncedAt: new Date()
        }
      });
    }

    await prisma.instagramConnection.update({
      where: { id: freshConnection.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncError: null
      }
    });

    console.info(
      JSON.stringify({
        event: "instagram.sync.succeeded",
        connectionId: freshConnection.id,
        username: freshConnection.username,
        synced,
        unavailable: unavailableIds.length
      })
    );

    return {
      synced,
      unavailable: unavailableIds.length,
      connectionId: freshConnection.id,
      username: freshConnection.username
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.instagramConnection.update({
      where: { id: connection.id },
      data: { lastSyncError: message.slice(0, 1000) }
    });

    console.error(
      JSON.stringify({
        event: "instagram.sync.failed",
        connectionId: connection.id,
        error: message
      })
    );

    throw error;
  }
}

export async function getInstagramCuratorCatalog(): Promise<InstagramCuratorCatalog> {
  const page = await prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG }
  });
  if (!page) {
    notFound("Conteúdo principal não encontrado.");
  }

  const draftSelection = parseDraftContent(page.draftContent).instagramSelection ?? null;
  const publishedSelection = page.publishedContent
    ? parseDraftContent(page.publishedContent).instagramSelection ?? null
    : null;
  const selectedIds = [
    ...new Set([
      ...getSelectionMediaIds(draftSelection),
      ...getSelectionMediaIds(publishedSelection)
    ])
  ];
  const [selectedMedia, candidates] = await Promise.all([
    selectedIds.length > 0
      ? prisma.instagramMedia.findMany({
          where: { id: { in: selectedIds } },
          select: mediaSelect
        })
      : Promise.resolve([]),
    prisma.instagramMedia.findMany({
      where: {
        isAvailable: true,
        id: selectedIds.length > 0 ? { notIn: selectedIds } : undefined
      },
      orderBy: { publishedAt: "desc" },
      take: INSTAGRAM_CATALOG_UNSELECTED_LIMIT,
      select: mediaSelect
    })
  ]);
  const media = [...selectedMedia, ...candidates];
  const localizedIds = await findLocalizedInstagramMediaIds(media);

  return {
    updatedAt: page.updatedAt,
    draftSelection,
    publishedSelection,
    media: media.map((item) => ({
      ...item,
      isLocalized: localizedIds.has(item.id)
    }))
  };
}

export async function saveInstagramSelectionDraft(
  input: {
    expectedUpdatedAt: string;
    primary: string;
    upperRight: string;
    lowerRight: string;
  },
  userId: string
): Promise<InstagramCuratorCatalog> {
  const page = await prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG }
  });
  if (!page) {
    notFound("Conteúdo principal não encontrado.");
  }

  const mediaIds = [input.primary, input.upperRight, input.lowerRight];
  const availableMediaCount = await prisma.instagramMedia.count({
    where: { id: { in: mediaIds }, isAvailable: true }
  });
  if (availableMediaCount !== mediaIds.length) {
    badRequest("Selecione três publicações disponíveis e distintas.");
  }

  const content = parseDraftContent(page.draftContent);
  const nextSelection: InstagramSelection = {
    version: (content.instagramSelection?.version ?? 0) + 1,
    primary: input.primary,
    upperRight: input.upperRight,
    lowerRight: input.lowerRight
  };
  const nextContent: DraftContent = {
    ...content,
    instagramSelection: nextSelection
  };
  const result = await prisma.landingPage.updateMany({
    where: {
      id: page.id,
      updatedAt: new Date(input.expectedUpdatedAt)
    },
    data: {
      draftContent: toDraftContentInput(nextContent),
      status: "draft",
      updatedById: userId
    }
  });

  if (result.count === 0) {
    conflict(
      "O conteúdo foi alterado por outra pessoa. Recarregue antes de salvar a seleção."
    );
  }

  return getInstagramCuratorCatalog();
}

function hasSameSelection(
  left: InstagramSelection | null | undefined,
  right: InstagramSelection | null | undefined
): boolean {
  return INSTAGRAM_SELECTION_SLOTS.every(
    (slot) => left?.[slot] === right?.[slot]
  );
}

export async function validateInstagramSelectionForPublish(
  draftContent: DraftContent,
  publishedContent: unknown
): Promise<void> {
  const draftSelection = draftContent.instagramSelection;
  const publishedSelection = publishedContent
    ? parseDraftContent(publishedContent).instagramSelection
    : null;

  if (!draftSelection || hasSameSelection(draftSelection, publishedSelection)) {
    return;
  }

  const mediaIds = getSelectionMediaIds(draftSelection);
  const media = await prisma.instagramMedia.findMany({
    where: { id: { in: mediaIds }, isAvailable: true },
    select: mediaSelect
  });

  if (media.length !== mediaIds.length) {
    badRequest(
      "A seleção do Instagram contém uma publicação indisponível. Revise a curadoria."
    );
  }

  const localizedIds = await findLocalizedInstagramMediaIds(media);
  if (localizedIds.size !== mediaIds.length) {
    badRequest(
      "Aguarde as traduções em inglês e espanhol das publicações selecionadas."
    );
  }
}

export async function listPublishedInstagramMedia(
  limit = INSTAGRAM_PUBLIC_DEFAULT_LIMIT
): Promise<SelectedInstagramMedia[]> {
  if (!env.INSTAGRAM_CONTENT_ENABLED) {
    return [];
  }

  const page = await prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG },
    select: { publishedContent: true }
  });
  const selection = page?.publishedContent
    ? parseDraftContent(page.publishedContent).instagramSelection
    : null;

  if (!selection) {
    return [];
  }

  const selectedIds = getSelectionMediaIds(selection);
  const [selectedMedia, candidates] = await Promise.all([
    prisma.instagramMedia.findMany({
      where: { id: { in: selectedIds } },
      select: mediaSelect
    }),
    prisma.instagramMedia.findMany({
      where: {
        isAvailable: true,
        id: { notIn: selectedIds }
      },
      orderBy: { publishedAt: "desc" },
      take: INSTAGRAM_CATALOG_UNSELECTED_LIMIT,
      select: mediaSelect
    })
  ]);
  const selectedById = new Map(selectedMedia.map((media) => [media.id, media]));
  const localizedCandidateIds = await findLocalizedInstagramMediaIds(candidates);
  const eligibleCandidates = candidates.filter((candidate) =>
    localizedCandidateIds.has(candidate.id)
  );
  const replacementsUsed = new Set<string>();
  const resolved: SelectedInstagramMedia[] = [];

  for (const slot of INSTAGRAM_SELECTION_SLOTS) {
    const selected = selectedById.get(selection[slot]);
    const media =
      selected?.isAvailable
        ? selected
        : eligibleCandidates.find(
            (candidate) => !replacementsUsed.has(candidate.id)
          );

    if (!media) {
      return [];
    }

    replacementsUsed.add(media.id);
    resolved.push({ ...media, slot });
  }

  return resolved.slice(0, limit);
}
