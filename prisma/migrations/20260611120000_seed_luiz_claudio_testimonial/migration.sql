INSERT INTO "Testimonial" (
  "id",
  "authorName",
  "authorRole",
  "companyName",
  "rating",
  "comment",
  "question",
  "profileImageUrl",
  "profileImagePathname",
  "reviewImageUrl",
  "reviewImagePathname",
  "status",
  "createdAt",
  "reviewedAt"
)
SELECT
  'clx7seedtestimonial001luizclaudio',
  'Luiz Claudio A. Souza',
  NULL,
  'Construtora Jotanunes',
  5,
  'A grande vantagem é que todas as peças já vem cortadas no tamanho certo com desperdício zero.',
  NULL,
  '/testimonials/luiz-claudio-a-souza.webp',
  NULL,
  NULL,
  NULL,
  'approved',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "Testimonial"
  WHERE "authorName" = 'Luiz Claudio A. Souza'
    AND "companyName" = 'Construtora Jotanunes'
);
