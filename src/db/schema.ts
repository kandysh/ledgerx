import { InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timeStamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  ...timeStamps,
});

export const assetTypes = pgTable("asset_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  symbol: text("symbol").notNull().unique(),
  ...timeStamps,
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  type: text("type", { enum: ["topup", "bonus", "spend", "refund"] }).notNull(),
  status: text("status", { enum: ["pending", "completed", "failed"] })
    .notNull()
    .default("pending"),
  metadata: jsonb("metadata").notNull().default({}),
  ...timeStamps,
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assetTypeId: uuid("asset_type_id")
      .notNull()
      .references(() => assetTypes.id),
    balance: numeric("balance", {
      precision: 20,
      scale: 4,
      mode: "number",
    }).default(0),
    isSystem: boolean("is_system").notNull().default(false),
    ...timeStamps,
  },
  (t) => [check("postive_balance", sql`${t.balance}>= 0`)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id),
    amount: numeric("amount", {
      precision: 20,
      scale: 4,
      mode: "number",
    }).notNull(),
    direction: text("direction", { enum: ["debit", "credit"] }).notNull(),
    ...timeStamps,
  },
  (t) => [check("positive_amount", sql`${t.amount}>= 0`)],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const assetTypesRelations = relations(assetTypes, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  assetType: one(assetTypes, {
    fields: [accounts.assetTypeId],
    references: [assetTypes.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));

export const transactionsRelations = relations(transactions, ({ many }) => ({
  ledgerEntries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(accounts, {
    fields: [ledgerEntries.accountId],
    references: [accounts.id],
  }),
  transaction: one(transactions, {
    fields: [ledgerEntries.transactionId],
    references: [transactions.id],
  }),
}));

export type User = InferSelectModel<typeof users>;
export type AssetType = InferSelectModel<typeof assetTypes>;
export type Account = InferSelectModel<typeof accounts>;
export type LedgerEntry = InferSelectModel<typeof ledgerEntries>;
export type Transaction = InferSelectModel<typeof transactions>;
