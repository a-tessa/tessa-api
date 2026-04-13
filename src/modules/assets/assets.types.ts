export type PreparedImageAsset = {
  contentType: "image/webp";
  body: Blob;
  sizeBytes: number;
  originalFilename: string;
};

export type HeroAssetBinding = {
  entityType: "landingPage";
  entityId: string;
  sectionKey: "heroSection";
  fieldKey: "image";
  slot: number;
};
