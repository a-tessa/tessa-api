const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function getYouTubeVideoId(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  if (YOUTUBE_ID_REGEX.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const isYouTubeHost =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be";

  if (!isYouTubeHost) {
    return null;
  }

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return YOUTUBE_ID_REGEX.test(id) ? id : null;
  }

  const queryId = url.searchParams.get("v");
  if (queryId && YOUTUBE_ID_REGEX.test(queryId)) {
    return queryId;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const videoSegmentIndex = pathSegments.findIndex(
    (segment) =>
      segment === "embed" ||
      segment === "shorts" ||
      segment === "v" ||
      segment === "live"
  );
  const pathId = pathSegments[videoSegmentIndex + 1];

  return videoSegmentIndex >= 0 && pathId && YOUTUBE_ID_REGEX.test(pathId)
    ? pathId
    : null;
}
