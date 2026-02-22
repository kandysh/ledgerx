import { randomBytes } from "node:crypto";
import { InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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
  referralCode: text("referral_code")
    .notNull()
    .unique()
    .$defaultFn(() => randomBytes(4).toString("hex").toUpperCase()),
  referredById: uuid("referred_by_id"),
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
    ownerId: text("owner_id").notNull(),
    ownerType: text("owner_type", { enum: ["user", "system"] }).notNull(),
    assetTypeId: uuid("asset_type_id")
      .notNull()
      .references(() => assetTypes.id),
    balance: numeric("balance", {
      precision: 20,
      scale: 4,
      mode: "number",
    })
      .notNull()
      .default(0),
    isSystem: boolean("is_system").notNull().default(false),
    ...timeStamps,
  },
  (t) => [
    check("positive_balance", sql`${t.balance} >= 0`),
    index("accounts_owner_id_asset_type_id_idx").on(t.ownerId, t.assetTypeId),
  ],
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
    direction: text("direction", { enum: ["DEBIT", "CREDIT"] }).notNull(),
    ...timeStamps,
  },
  (t) => [
    check("positive_amount", sql`${t.amount} > 0`),
    index("ledger_entries_account_id_idx").on(t.accountId),
    index("ledger_entries_transaction_id_idx").on(t.transactionId),
  ],
);

export const usersRelations = relations(users, ({ one }) => ({
  referredBy: one(users, {
    fields: [users.referredById],
    references: [users.id],
    relationName: "referrals",
  }),
}));

export const assetTypesRelations = relations(assetTypes, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
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
