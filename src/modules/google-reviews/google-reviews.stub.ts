import type {
  GoogleReviewsProvider,
  NormalizedGoogleReview
} from "./google-reviews.types.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Realistic fixtures exercising every display path decided during planning:
 * long 5-star reviews, a mid rating, an honest negative, and a star-only
 * review with no text. Used until live Business Profile API access is granted.
 */
const STUB_REVIEWS: NormalizedGoogleReview[] = [
  {
    externalId: "stub-google-review-1",
    authorName: "Marcos Andrade",
    authorUrl: "https://www.google.com/maps/contrib/stub1",
    profileImageUrl: "https://lh3.googleusercontent.com/a/stub-avatar-1",
    rating: 5,
    comment:
      "Contratamos a Tessa para a estrutura metálica do nosso barracão e o resultado superou as expectativas. Prazo cumprido à risca e acabamento impecável. Recomendo demais!",
    relativeTime: "há 2 meses",
    sourceCreatedAt: daysAgo(60),
    sourceUpdatedAt: daysAgo(60)
  },
  {
    externalId: "stub-google-review-2",
    authorName: "Juliana Prado",
    authorUrl: "https://www.google.com/maps/contrib/stub2",
    profileImageUrl: null,
    rating: 5,
    comment:
      "Equipe extremamente profissional do orçamento à montagem. A obra ficou linda e dentro do combinado.",
    relativeTime: "há 5 meses",
    sourceCreatedAt: daysAgo(150),
    sourceUpdatedAt: daysAgo(150)
  },
  {
    externalId: "stub-google-review-3",
    authorName: "Ricardo Nunes",
    authorUrl: null,
    profileImageUrl: "https://lh3.googleusercontent.com/a/stub-avatar-3",
    rating: 4,
    comment:
      "Bom trabalho no geral, estrutura sólida. Tirei uma estrela por um pequeno atraso na entrega dos documentos, mas resolveram rápido.",
    relativeTime: "há 1 mês",
    sourceCreatedAt: daysAgo(30),
    sourceUpdatedAt: daysAgo(28)
  },
  {
    externalId: "stub-google-review-4",
    authorName: "Fernanda Lima",
    authorUrl: "https://www.google.com/maps/contrib/stub4",
    profileImageUrl: "https://lh3.googleusercontent.com/a/stub-avatar-4",
    rating: 2,
    comment:
      "A comunicação durante a obra poderia ter sido melhor. O produto final é bom, mas o acompanhamento deixou a desejar.",
    relativeTime: "há 3 semanas",
    sourceCreatedAt: daysAgo(21),
    sourceUpdatedAt: daysAgo(21)
  },
  {
    externalId: "stub-google-review-5",
    authorName: "Anderson Silva",
    authorUrl: null,
    profileImageUrl: null,
    rating: 5,
    comment: "",
    relativeTime: "há 1 semana",
    sourceCreatedAt: daysAgo(7),
    sourceUpdatedAt: daysAgo(7)
  }
];

export const stubGoogleReviewsProvider: GoogleReviewsProvider = {
  name: "stub",
  async listAllReviews(): Promise<NormalizedGoogleReview[]> {
    return STUB_REVIEWS.map((review) => ({ ...review }));
  }
};
