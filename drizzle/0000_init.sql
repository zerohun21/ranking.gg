CREATE TYPE "public"."battle_choice" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."external_source" AS ENUM('tmdb', 'rawg', 'naver', 'kakao', 'apple', 'google_books', 'aladin', 'user');--> statement-breakpoint
CREATE TYPE "public"."post_tag" AS ENUM('free', 'debate', 'question', 'recommend');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('like', 'dislike');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('content', 'review', 'post', 'battle', 'comment');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('S', 'A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TABLE "battle_votes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "battle_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"battle_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"choice" "battle_choice" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "battles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"content_a_id" integer NOT NULL,
	"content_b_id" integer NOT NULL,
	"votes_a" integer DEFAULT 0 NOT NULL,
	"votes_b" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name_ko" text NOT NULL,
	"name_en" text NOT NULL,
	"icon" text DEFAULT '🏆' NOT NULL,
	"color" text DEFAULT '#5383e8' NOT NULL,
	"description" text,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"item_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"status" "collection_status" DEFAULT 'running' NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"items_upserted" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" "target_type" NOT NULL,
	"target_id" integer NOT NULL,
	"parent_id" integer,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_genres" (
	"content_id" integer NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "content_genres_content_id_genre_id_pk" PRIMARY KEY("content_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "content_stats" (
	"content_id" integer PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"rating_avg" numeric(4, 3) DEFAULT '0' NOT NULL,
	"bayesian_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tier" "tier",
	"rank" integer,
	"prev_rank" integer,
	"rank_delta" integer,
	"hot_score" real DEFAULT 0 NOT NULL,
	"elo" real DEFAULT 1500 NOT NULL,
	"elo_wins" integer DEFAULT 0 NOT NULL,
	"elo_losses" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"dist_1" integer DEFAULT 0 NOT NULL,
	"dist_2" integer DEFAULT 0 NOT NULL,
	"dist_3" integer DEFAULT 0 NOT NULL,
	"dist_4" integer DEFAULT 0 NOT NULL,
	"dist_5" integer DEFAULT 0 NOT NULL,
	"dist_6" integer DEFAULT 0 NOT NULL,
	"dist_7" integer DEFAULT 0 NOT NULL,
	"dist_8" integer DEFAULT 0 NOT NULL,
	"dist_9" integer DEFAULT 0 NOT NULL,
	"dist_10" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_views" (
	"content_id" integer NOT NULL,
	"session_key" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_views_content_id_session_key_pk" PRIMARY KEY("content_id","session_key")
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_original" text,
	"description" text,
	"poster_url" text,
	"backdrop_url" text,
	"release_date" date,
	"release_year" integer,
	"external_source" "external_source" DEFAULT 'user' NOT NULL,
	"external_id" text,
	"external_url" text,
	"external_score" real,
	"external_score_count" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "genres_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name_ko" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"content_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tag" "post_tag" DEFAULT 'free' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"is_guest" boolean DEFAULT false NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rank_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"rank" integer,
	"bayesian_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tier" "tier",
	"snapshot_week" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ratings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"score" numeric(2, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"user_id" uuid NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" integer NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reporter_id" uuid NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"rating_id" integer,
	"score" numeric(2, 1),
	"body" text NOT NULL,
	"is_spoiler" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_votes" ADD CONSTRAINT "battle_votes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_content_a_id_contents_id_fk" FOREIGN KEY ("content_a_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_content_b_id_contents_id_fk" FOREIGN KEY ("content_b_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_genres" ADD CONSTRAINT "content_genres_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_genres" ADD CONSTRAINT "content_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_stats" ADD CONSTRAINT "content_stats_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_stats" ADD CONSTRAINT "content_stats_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genres" ADD CONSTRAINT "genres_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_id_ratings_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."ratings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_votes_battle_user_uq" ON "battle_votes" USING btree ("battle_id","user_id");--> statement-breakpoint
CREATE INDEX "battle_votes_created_idx" ON "battle_votes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "battles_category_idx" ON "battles" USING btree ("category_id","is_featured");--> statement-breakpoint
CREATE INDEX "battles_content_a_idx" ON "battles" USING btree ("content_a_id");--> statement-breakpoint
CREATE INDEX "battles_content_b_idx" ON "battles" USING btree ("content_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_official_idx" ON "categories" USING btree ("is_official","sort_order");--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "content_genres_genre_idx" ON "content_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "content_stats_category_rank_idx" ON "content_stats" USING btree ("category_id","rank");--> statement-breakpoint
CREATE INDEX "content_stats_category_score_idx" ON "content_stats" USING btree ("category_id","bayesian_score");--> statement-breakpoint
CREATE INDEX "content_stats_category_hot_idx" ON "content_stats" USING btree ("category_id","hot_score");--> statement-breakpoint
CREATE INDEX "content_stats_category_elo_idx" ON "content_stats" USING btree ("category_id","elo");--> statement-breakpoint
CREATE INDEX "content_stats_category_count_idx" ON "content_stats" USING btree ("category_id","rating_count");--> statement-breakpoint
CREATE UNIQUE INDEX "contents_category_slug_uq" ON "contents" USING btree ("category_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "contents_source_external_uq" ON "contents" USING btree ("external_source","external_id");--> statement-breakpoint
CREATE INDEX "contents_category_idx" ON "contents" USING btree ("category_id","is_approved");--> statement-breakpoint
CREATE INDEX "contents_year_idx" ON "contents" USING btree ("category_id","release_year");--> statement-breakpoint
CREATE INDEX "contents_title_trgm_idx" ON "contents" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "contents_title_original_trgm_idx" ON "contents" USING gin ("title_original" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "contents_metadata_gin_idx" ON "contents" USING gin ("metadata");--> statement-breakpoint
CREATE UNIQUE INDEX "genres_category_slug_uq" ON "genres" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category_id","is_hidden","created_at");--> statement-breakpoint
CREATE INDEX "posts_category_tag_idx" ON "posts" USING btree ("category_id","tag");--> statement-breakpoint
CREATE INDEX "posts_content_idx" ON "posts" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "posts_user_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_nickname_uq" ON "profiles" USING btree ("nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "rank_snapshots_content_week_uq" ON "rank_snapshots" USING btree ("content_id","snapshot_week");--> statement-breakpoint
CREATE INDEX "rank_snapshots_category_week_idx" ON "rank_snapshots" USING btree ("category_id","snapshot_week");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_content_user_uq" ON "ratings" USING btree ("content_id","user_id");--> statement-breakpoint
CREATE INDEX "ratings_user_idx" ON "ratings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ratings_created_idx" ON "ratings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reactions_target_idx" ON "reactions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_target_uq" ON "reports" USING btree ("reporter_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_content_user_uq" ON "reviews" USING btree ("content_id","user_id");--> statement-breakpoint
CREATE INDEX "reviews_content_idx" ON "reviews" USING btree ("content_id","is_hidden","created_at");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_created_idx" ON "reviews" USING btree ("created_at");