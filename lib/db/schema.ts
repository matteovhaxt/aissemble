import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const uploads = pgTable(
  "uploads",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex("uploads_key_idx").on(table.key),
  })
);

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  requestSummary: text("request_summary").notNull(),
  project: text("project"),
  checklist: text("checklist")
    .array()
    .$type<string[]>()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  uploadId: integer("upload_id").references(() => uploads.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const steps = pgTable(
  "steps",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    stepIdentifier: text("step_identifier"),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    notes: text("notes"),
    illustrationKey: text("illustration_key"),
    illustrationUrl: text("illustration_url"),
    animationStatus: text("animation_status"),
    animationOperationId: text("animation_operation_id"),
    animationKey: text("animation_key"),
    animationUrl: text("animation_url"),
    animationError: text("animation_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    planStepIdx: uniqueIndex("steps_plan_position_idx").on(
      table.planId,
      table.position
    ),
  })
);

export type Upload = typeof uploads.$inferSelect;
export type Plan = typeof plans.$inferSelect;
