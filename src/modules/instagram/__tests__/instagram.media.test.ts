import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeInstagramMedia,
  normalizeInstagramMediaList,
  resolveMediaImageSourceUrl
} from "../instagram.media.js";
import type { InstagramMediaDto } from "../instagram.schemas.js";

const baseMedia = {
  id: "179000",
  permalink: "https://www.instagram.com/p/abc/",
  timestamp: "2026-07-20T12:00:00+0000"
} as const;

describe("instagram.media", () => {
  it("resolves IMAGE media_url", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "IMAGE",
      media_url: "https://cdn.example.com/photo.jpg",
      caption: "Foto da obra"
    };

    assert.equal(resolveMediaImageSourceUrl(media), "https://cdn.example.com/photo.jpg");
    const normalized = normalizeInstagramMedia(media);
    assert.ok(normalized);
    assert.equal(normalized.mediaType, "IMAGE");
    assert.equal(normalized.caption, "Foto da obra");
  });

  it("prefers VIDEO thumbnail_url", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "VIDEO",
      media_url: "https://cdn.example.com/video.mp4",
      thumbnail_url: "https://cdn.example.com/thumb.jpg"
    };

    assert.equal(resolveMediaImageSourceUrl(media), "https://cdn.example.com/thumb.jpg");
  });

  it("uses first carousel child image", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "CAROUSEL_ALBUM",
      children: {
        data: [
          { media_type: "IMAGE", media_url: "https://cdn.example.com/slide-1.jpg" },
          { media_type: "IMAGE", media_url: "https://cdn.example.com/slide-2.jpg" }
        ]
      }
    };

    assert.equal(resolveMediaImageSourceUrl(media), "https://cdn.example.com/slide-1.jpg");
  });

  it("uses carousel video thumbnail when first child is video", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "CAROUSEL_ALBUM",
      children: {
        data: [
          {
            media_type: "VIDEO",
            media_url: "https://cdn.example.com/clip.mp4",
            thumbnail_url: "https://cdn.example.com/clip-thumb.jpg"
          }
        ]
      }
    };

    assert.equal(
      resolveMediaImageSourceUrl(media),
      "https://cdn.example.com/clip-thumb.jpg"
    );
  });

  it("skips media without resolvable image", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "VIDEO"
    };

    assert.equal(normalizeInstagramMedia(media), null);
    assert.deepEqual(normalizeInstagramMediaList([media]), []);
  });

  it("marks accepted collaborative media", () => {
    const media: InstagramMediaDto = {
      ...baseMedia,
      media_type: "IMAGE",
      media_url: "https://cdn.example.com/collaboration.jpg"
    };

    const normalized = normalizeInstagramMedia(media, true);
    assert.ok(normalized);
    assert.equal(normalized.isCollaborative, true);
  });
});
