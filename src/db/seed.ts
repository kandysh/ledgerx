import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { accounts, assetTypes, users } from "./schema.js";
import {
  createTransaction,
  payReferralBonus,
} from "../modules/wallet/wallet.service.js";
import { IdempotentReplayError } from "../lib/errors.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function findOrCreateAccount(
  ownerId: string,
  ownerType: "user" | "system",
  assetTypeId: string,
  isSystem: boolean,
) {
  const existing = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.ownerId, ownerId),
        eq(accounts.ownerType, ownerType),
        eq(accounts.assetTypeId, assetTypeId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [acct] = await db
    .insert(accounts)
    .values({ ownerId, ownerType, assetTypeId, isSystem, balance: 0 })
    .returning();
  return acct;
}

const [goldResult] = await db
  .insert(assetTypes)
  .values({ name: "Gold Coins", symbol: "GOLD" })
  .onConflictDoUpdate({
    target: assetTypes.symbol,
    set: { name: "Gold Coins" },
  })
  .returning();
const gold = goldResult;

const treasuryGold = await findOrCreateAccount(
  "treasury",
  "system",
  gold.id,
  true,
);

for (const { acct, label } of [
  { acct: treasuryGold, label: "treasury GOLD" },
]) {
  if (acct.balance === 0) {
    await db
      .update(accounts)
      .set({ balance: 10000 })
      .where(eq(accounts.id, acct.id));
    console.log(`Initialized ${label} balance to 10,000`);
  }
}

const [insertedUser1] = await db
  .insert(users)
  .values({ email: "user1@example.com", name: "User One" })
  .onConflictDoNothing()
  .returning();

const user1 =
  insertedUser1 ??
  (await db.query.users.findFirst({
    where: eq(users.email, "user1@example.com"),
  }))!;

const [insertedUser2] = await db
  .insert(users)
  .values({
    email: "user2@example.com",
    name: "User Two",
    referredById: user1.id,
  })
  .onConflictDoNothing()
  .returning();

const user2 =
  insertedUser2 ??
  (await db.query.users.findFirst({
    where: eq(users.email, "user2@example.com"),
  }))!;

console.log(`Users: user1=${user1.id}, user2=${user2.id}`);

await findOrCreateAccount(user1.id, "user", gold.id, false);
await findOrCreateAccount(user2.id, "user", gold.id, false);

const referralTx = await payReferralBonus(db, {
  referrerId: user1.id,
  newUserId: user2.id,
});
if (referralTx) {
  console.log(`Paid referral bonus to user1 (tx: ${referralTx.id})`);
} else {
  console.log("Referral bonus skipped (already paid or asset not found)");
}

// ─── Opening balances ────────────────────────────────────────────────────────

const openingBalances = [
  {
    userId: user1.id,
    sourceAccountId: treasuryGold.id,
    assetTypeId: gold.id,
    amount: 500,
    key: "seed:opening:user1:GOLD",
  },
  {
    userId: user2.id,
    sourceAccountId: treasuryGold.id,
    assetTypeId: gold.id,
    amount: 300,
    key: "seed:opening:user2:GOLD",
  },
];

for (const {
  userId,
  sourceAccountId,
  assetTypeId,
  amount,
  key,
} of openingBalances) {
  const userAcct = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.ownerId, userId),
      eq(accounts.ownerType, "user"),
      eq(accounts.assetTypeId, assetTypeId),
    ),
  });
  if (!userAcct) throw new Error(`User account not found for ${userId}`);

  try {
    await createTransaction(db, {
      idempotencyKey: key,
      type: "topup",
      metadata: { seed: true, userId },
      entries: [
        { accountId: sourceAccountId, direction: "DEBIT", amount },
        { accountId: userAcct.id, direction: "CREDIT", amount },
      ],
    });
    console.log(`Created opening balance: ${key}`);
  } catch (e) {
    if (e instanceof IdempotentReplayError) {
      console.log(`Skipping ${key} — already exists`);
      continue;
    }
    throw e;
  }
}

console.log("\nSeed complete");
console.log(`  user1 ID           : ${user1.id}`);
console.log(`  user1 referral code: ${user1.referralCode}`);
console.log(`  user2 ID           : ${user2.id}`);
console.log(`  GOLD ID  : ${gold.id}`);

await pool.end();
