import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────────────────── enums ───────────────────────── */
export const externalSourceEnum = pgEnum("external_source", [
  "tmdb",
  "rawg",
  "naver",
  "kakao",
  "apple",
  "google_books",
  "aladin",
  "user",
]);
export const tierEnum = pgEnum("tier", ["S", "A", "B", "C", "D"]);
export const targetTypeEnum = pgEnum("target_type", ["content", "review", "post", "battle", "comment"]);
export const reactionKindEnum = pgEnum("reaction_kind", ["like", "dislike"]);
export const battleChoiceEnum = pgEnum("battle_choice", ["a", "b"]);
export const postTagEnum = pgEnum("post_tag", ["free", "debate", "question", "recommend"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const collectionStatusEnum = pgEnum("collection_status", ["running", "done", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ───────────────────────── profiles ───────────────────────── */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // = auth.users.id (FK 는 트리거로 보장, 시드 유저 삽입 편의를 위해 미선언)
    nickname: text("nickname").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isSeed: boolean("is_seed").notNull().default(false),
    isGuest: boolean("is_guest").notNull().default(false),
    ratingCount: integer("rating_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    badges: jsonb("badges").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (t) => [uniqueIndex("profiles_nickname_uq").on(t.nickname)],
);

/* ───────────────────────── categories ───────────────────────── */
export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull(),
    nameKo: text("name_ko").notNull(),
    nameEn: text("name_en").notNull(),
    icon: text("icon").notNull().default("🏆"),
    color: text("color").notNull().default("#5383e8"),
    description: text("description"),
    isOfficial: boolean("is_official").notNull().default(false),
    isApproved: boolean("is_approved").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    itemCount: integer("item_count").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(100),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_official_idx").on(t.isOfficial, t.sortOrder)],
);

/* ───────────────────────── contents ───────────────────────── */
export type ContentMetadata = {
  genres?: string[];
  platforms?: string[];
  providers?: string[];
  kind?: string; // movie|tv|variety|album|book|game|webtoon
  author?: string;
  artist?: string;
  authors?: string[];
  weekdays?: string[];
  status?: "ongoing" | "finished" | "rest" | string;
  age?: string;
  tags?: string[];
  developers?: string[];
  publishers?: string[];
  publisher?: string;
  runtime?: number;
  seasons?: number;
  episodes?: number;
  directors?: string[];
  cast?: string[];
  metacritic?: number | null;
  platform?: string; // naver|kakao
  title_ko?: string;
  title_en?: string;
  tagline?: string;
  origin_country?: string[];
  original_language?: string;
  stores?: string[];
  trackCount?: number;
  pageCount?: number;
  isbn?: string;
  [k: string]: unknown;
};

export const contents = pgTable(
  "contents",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    titleOriginal: text("title_original"),
    description: text("description"),
    posterUrl: text("poster_url"),
    backdropUrl: text("backdrop_url"),
    releaseDate: date("release_date"),
    releaseYear: integer("release_year"),
    externalSource: externalSourceEnum("external_source").notNull().default("user"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    externalScore: real("external_score"), // 0~10 normalized
    externalScoreCount: integer("external_score_count"),
    metadata: jsonb("metadata").$type<ContentMetadata>().notNull().default(sql`'{}'::jsonb`),
    isAdult: boolean("is_adult").notNull().default(false),
    isApproved: boolean("is_approved").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contents_category_slug_uq").on(t.categoryId, t.slug),
    uniqueIndex("contents_source_external_uq").on(t.externalSource, t.externalId),
    index("contents_category_idx").on(t.categoryId, t.isApproved),
    index("contents_year_idx").on(t.categoryId, t.releaseYear),
    index("contents_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
    index("contents_title_original_trgm_idx").using("gin", sql`${t.titleOriginal} gin_trgm_ops`),
    index("contents_metadata_gin_idx").using("gin", t.metadata),
  ],
);

/* ───────────────────────── genres ───────────────────────── */
export const genres = pgTable(
  "genres",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nameKo: text("name_ko").notNull(),
    nameEn: text("name_en").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("genres_category_slug_uq").on(t.categoryId, t.slug)],
);

export const contentGenres = pgTable(
  "content_genres",
  {
    contentId: integer("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.genreId] }), index("content_genres_genre_idx").on(t.genreId)],
);

/* ───────────────────────── content_stats (ranking cache) ───────────────────────── */
export const contentStats = pgTable(
  "content_stats",
  {
    contentId: integer("content_id")
      .primaryKey()
      .references(() => contents.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    ratingCount: integer("rating_count").notNull().default(0),
    ratingAvg: numeric("rating_avg", { precision: 4, scale: 3 }).notNull().default("0"), // 0.5~5.0
    bayesianScore: numeric("bayesian_score", { precision: 5, scale: 2 }).notNull().default("0"), // 0~10
    tier: tierEnum("tier"),
    rank: integer("rank"),
    prevRank: integer("prev_rank"),
    rankDelta: integer("rank_delta"),
    hotScore: real("hot_score").notNull().default(0),
    elo: real("elo").notNull().default(1500),
    eloWins: integer("elo_wins").notNull().default(0),
    eloLosses: integer("elo_losses").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    dist1: integer("dist_1").notNull().default(0),
    dist2: integer("dist_2").notNull().default(0),
    dist3: integer("dist_3").notNull().default(0),
    dist4: integer("dist_4").notNull().default(0),
    dist5: integer("dist_5").notNull().default(0),
    dist6: integer("dist_6").notNull().default(0),
    dist7: integer("dist_7").notNull().default(0),
    dist8: integer("dist_8").notNull().default(0),
    dist9: integer("dist_9").notNull().default(0),
    dist10: integer("dist_10").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("content_stats_category_rank_idx").on(t.categoryId, t.rank),
    index("content_stats_category_score_idx").on(t.categoryId, t.bayesianScore),
    index("content_stats_category_hot_idx").on(t.categoryId, t.hotScore),
    index("content_stats_category_elo_idx").on(t.categoryId, t.elo),
    index("content_stats_category_count_idx").on(t.categoryId, t.ratingCount),
  ],
);

/* ───────────────────────── rank_snapshots ───────────────────────── */
export const rankSnapshots = pgTable(
  "rank_snapshots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contentId: integer("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    rank: integer("rank"),
    bayesianScore: numeric("bayesian_score", { precision: 5, scale: 2 }).notNull().default("0"),
    tier: tierEnum("tier"),
    snapshotWeek: date("snapshot_week").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rank_snapshots_content_week_uq").on(t.contentId, t.snapshotWeek),
    index("rank_snapshots_category_week_idx").on(t.categoryId, t.snapshotWeek),
  ],
);

/* ───────────────────────── ratings ───────────────────────── */
export const ratings = pgTable(
  "ratings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contentId: integer("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 2, scale: 1 }).notNull(), // 0.5 ~ 5.0
    ...timestamps,
  },
  (t) => [
    uniqueIndex("ratings_content_user_uq").on(t.contentId, t.userId),
    index("ratings_user_idx").on(t.userId, t.createdAt),
    index("ratings_created_idx").on(t.createdAt),
  ],
);

/* ───────────────────────── reviews ───────────────────────── */
export const reviews = pgTable(
  "reviews",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contentId: integer("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ratingId: integer("rating_id").references(() => ratings.id, { onDelete: "set null" }),
    score: numeric("score", { precision: 2, scale: 1 }), // 작성 시점 별점 스냅샷
    body: text("body").notNull(),
    isSpoiler: boolean("is_spoiler").notNull().default(false),
    likeCount: integer("like_count").notNull().default(0),
    dislikeCount: integer("dislike_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    isHidden: boolean("is_hidden").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_content_user_uq").on(t.contentId, t.userId),
    index("reviews_content_idx").on(t.contentId, t.isHidden, t.createdAt),
    index("reviews_user_idx").on(t.userId, t.createdAt),
    index("reviews_created_idx").on(t.createdAt),
  ],
);

/* ───────────────────────── comments ───────────────────────── */
export const comments = pgTable(
  "comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    targetType: targetTypeEnum("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    parentId: integer("parent_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    dislikeCount: integer("dislike_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    isHidden: boolean("is_hidden").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId, t.createdAt),
    index("comments_parent_idx").on(t.parentId),
    index("comments_user_idx").on(t.userId, t.createdAt),
  ],
);

/* ───────────────────────── reactions ───────────────────────── */
export const reactions = pgTable(
  "reactions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetType: targetTypeEnum("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    kind: reactionKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] }), index("reactions_target_idx").on(t.targetType, t.targetId)],
);

/* ───────────────────────── battles ───────────────────────── */
export const battles = pgTable(
  "battles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    contentAId: integer("content_a_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    contentBId: integer("content_b_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    votesA: integer("votes_a").notNull().default(0),
    votesB: integer("votes_b").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("battles_category_idx").on(t.categoryId, t.isFeatured),
    index("battles_content_a_idx").on(t.contentAId),
    index("battles_content_b_idx").on(t.contentBId),
  ],
);

export const battleVotes = pgTable(
  "battle_votes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    battleId: integer("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    choice: battleChoiceEnum("choice").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("battle_votes_battle_user_uq").on(t.battleId, t.userId), index("battle_votes_created_idx").on(t.createdAt)],
);

/* ───────────────────────── posts ───────────────────────── */
export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentId: integer("content_id").references(() => contents.id, { onDelete: "set null" }), // 작품 태그
    title: text("title").notNull(),
    body: text("body").notNull(),
    tag: postTagEnum("tag").notNull().default("free"),
    likeCount: integer("like_count").notNull().default(0),
    dislikeCount: integer("dislike_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("posts_category_idx").on(t.categoryId, t.isHidden, t.createdAt),
    index("posts_category_tag_idx").on(t.categoryId, t.tag),
    index("posts_content_idx").on(t.contentId),
    index("posts_user_idx").on(t.userId),
  ],
);

/* ───────────────────────── reports ───────────────────────── */
export const reports = pgTable(
  "reports",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetType: targetTypeEnum("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reports_reporter_target_uq").on(t.reporterId, t.targetType, t.targetId),
    index("reports_status_idx").on(t.status, t.createdAt),
  ],
);

/* ───────────────────────── collection_runs ───────────────────────── */
export const collectionRuns = pgTable("collection_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: text("source").notNull(),
  status: collectionStatusEnum("status").notNull().default("running"),
  cursor: jsonb("cursor").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  itemsUpserted: integer("items_upserted").notNull().default(0),
  itemsFailed: integer("items_failed").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  ...timestamps,
});

/* ───────────────────────── content_views (세션당 1회 뷰 카운트) ───────────────────────── */
export const contentViews = pgTable(
  "content_views",
  {
    contentId: integer("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    sessionKey: text("session_key").notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.sessionKey] })],
);

/* ───────────────────────── relations ───────────────────────── */
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  contents: many(contents),
  creator: one(profiles, { fields: [categories.createdBy], references: [profiles.id] }),
}));

export const contentsRelations = relations(contents, ({ one, many }) => ({
  category: one(categories, { fields: [contents.categoryId], references: [categories.id] }),
  stats: one(contentStats, { fields: [contents.id], references: [contentStats.contentId] }),
  genres: many(contentGenres),
  reviews: many(reviews),
  ratings: many(ratings),
}));

export const contentStatsRelations = relations(contentStats, ({ one }) => ({
  content: one(contents, { fields: [contentStats.contentId], references: [contents.id] }),
}));

export const contentGenresRelations = relations(contentGenres, ({ one }) => ({
  content: one(contents, { fields: [contentGenres.contentId], references: [contents.id] }),
  genre: one(genres, { fields: [contentGenres.genreId], references: [genres.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  content: one(contents, { fields: [reviews.contentId], references: [contents.id] }),
  user: one(profiles, { fields: [reviews.userId], references: [profiles.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  content: one(contents, { fields: [ratings.contentId], references: [contents.id] }),
  user: one(profiles, { fields: [ratings.userId], references: [profiles.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(profiles, { fields: [comments.userId], references: [profiles.id] }),
}));

export const battlesRelations = relations(battles, ({ one }) => ({
  category: one(categories, { fields: [battles.categoryId], references: [categories.id] }),
  contentA: one(contents, { fields: [battles.contentAId], references: [contents.id] }),
  contentB: one(contents, { fields: [battles.contentBId], references: [contents.id] }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  user: one(profiles, { fields: [posts.userId], references: [profiles.id] }),
  content: one(contents, { fields: [posts.contentId], references: [contents.id] }),
}));

/* ───────────────────────── types ───────────────────────── */
export type Profile = typeof profiles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type ContentStat = typeof contentStats.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Battle = typeof battles.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Tier = (typeof tierEnum.enumValues)[number];
export type ExternalSource = (typeof externalSourceEnum.enumValues)[number];
