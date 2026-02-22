import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "../../configs/env";
import type { Database } from "../../db/index";
import {
  accounts,
  assetTypes,
  ledgerEntries,
  transactions,
} from "../../db/schema";
import {
  AccountNotFoundError,
  IdempotentReplayError,
  InsufficientFundsError,
} from "../../lib/errors";
import { mockPayment } from "../payment.routes";

async function findSystemAccount(db: Database, assetTypeId: string) {
  const acct = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.ownerId, "treasury"),
      eq(accounts.ownerType, "system"),
      eq(accounts.assetTypeId, assetTypeId),
    ),
  });
  if (!acct)
    throw new AccountNotFoundError(
      `System account for ${assetTypeId} not found`,
    );
  return acct;
}

async function findUserAccount(
  db: Database,
  userId: string,
  assetTypeId: string,
) {
  const acct = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.ownerId, userId),
      eq(accounts.ownerType, "user"),
      eq(accounts.assetTypeId, assetTypeId),
    ),
  });
  if (!acct)
    throw new AccountNotFoundError(`User account not found for ${userId}`);
  return acct;
}

export async function createTransaction(
  db: Database,
  params: {
    idempotencyKey: string;
    type: "topup" | "bonus" | "spend";
    metadata: Record<string, unknown>;
    entries: Array<{
      accountId: string;
      direction: "DEBIT" | "CREDIT";
      amount: number;
    }>;
  },
) {
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.idempotencyKey, params.idempotencyKey),
  });
  if (existing) throw new IdempotentReplayError(existing);

  const debitEntries = params.entries.filter((e) => e.direction === "DEBIT");
  const debitIds = debitEntries.map((e) => e.accountId).sort();

  return db.transaction(async (tx) => {
    for (const accountId of debitIds) {
      await tx.execute(
        sql`SELECT id FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`,
      );
    }

    for (const entry of debitEntries) {
      const [acct] = await tx
        .select({ balance: accounts.balance })
        .from(accounts)
        .where(eq(accounts.id, entry.accountId));
      if (!acct) throw new AccountNotFoundError(entry.accountId);
      if (acct.balance < entry.amount) throw new InsufficientFundsError();
    }

    const [txRecord] = await tx
      .insert(transactions)
      .values({
        idempotencyKey: params.idempotencyKey,
        type: params.type,
        status: "completed",
        metadata: params.metadata,
      })
      .returning();

    await tx.insert(ledgerEntries).values(
      params.entries.map((e) => ({
        transactionId: txRecord.id,
        accountId: e.accountId,
        direction: e.direction,
        amount: e.amount,
      })),
    );

    for (const entry of params.entries) {
      if (entry.direction === "DEBIT") {
        await tx.execute(
          sql`UPDATE accounts SET balance = balance - ${entry.amount} WHERE id = ${entry.accountId}::uuid`,
        );
      } else {
        await tx.execute(
          sql`UPDATE accounts SET balance = balance + ${entry.amount} WHERE id = ${entry.accountId}::uuid`,
        );
      }
    }

    return txRecord;
  });
}

export async function topup(
  db: Database,
  params: {
    userId: string;
    assetTypeId: string;
    amount: number;
    idempotencyKey: string;
    paymentRef?: string;
  },
) {
  const { paymentId } = await mockPayment({
    userId: params.userId,
    amount: params.amount,
    currency: params.assetTypeId,
  });

  const treasury = await findSystemAccount(db, params.assetTypeId);
  const userAcct = await findUserAccount(db, params.userId, params.assetTypeId);

  return createTransaction(db, {
    idempotencyKey: params.idempotencyKey,
    type: "topup",
    metadata: {
      userId: params.userId,
      paymentRef: params.paymentRef ?? paymentId,
    },
    entries: [
      { accountId: treasury.id, direction: "DEBIT", amount: params.amount },
      { accountId: userAcct.id, direction: "CREDIT", amount: params.amount },
    ],
  });
}

export async function bonus(
  db: Database,
  params: {
    userId: string;
    assetTypeId: string;
    amount: number;
    idempotencyKey: string;
  },
) {
  const bonusPool = await findSystemAccount(db, params.assetTypeId);
  const userAcct = await findUserAccount(db, params.userId, params.assetTypeId);

  return createTransaction(db, {
    idempotencyKey: params.idempotencyKey,
    type: "bonus",
    metadata: { userId: params.userId },
    entries: [
      { accountId: bonusPool.id, direction: "DEBIT", amount: params.amount },
      { accountId: userAcct.id, direction: "CREDIT", amount: params.amount },
    ],
  });
}

export async function spend(
  db: Database,
  params: {
    userId: string;
    assetTypeId: string;
    amount: number;
    idempotencyKey: string;
  },
) {
  const treasury = await findSystemAccount(db, params.assetTypeId);
  const userAcct = await findUserAccount(db, params.userId, params.assetTypeId);

  return createTransaction(db, {
    idempotencyKey: params.idempotencyKey,
    type: "spend",
    metadata: { userId: params.userId },
    entries: [
      { accountId: userAcct.id, direction: "DEBIT", amount: params.amount },
      { accountId: treasury.id, direction: "CREDIT", amount: params.amount },
    ],
  });
}

export async function getBalance(db: Database, userId: string) {
  return db
    .select({ assetTypeId: accounts.assetTypeId, balance: accounts.balance })
    .from(accounts)
    .where(and(eq(accounts.ownerId, userId), eq(accounts.ownerType, "user")));
}

export async function getHistory(db: Database, userId: string) {
  return db
    .select({
      entryId: ledgerEntries.id,
      accountId: ledgerEntries.accountId,
      transactionId: ledgerEntries.transactionId,
      direction: ledgerEntries.direction,
      amount: ledgerEntries.amount,
      entryCreatedAt: ledgerEntries.createdAt,
      txId: transactions.id,
      txType: transactions.type,
      txStatus: transactions.status,
      txMetadata: transactions.metadata,
      txIdempotencyKey: transactions.idempotencyKey,
      txCreatedAt: transactions.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(accounts, eq(ledgerEntries.accountId, accounts.id))
    .innerJoin(transactions, eq(ledgerEntries.transactionId, transactions.id))
    .where(and(eq(accounts.ownerId, userId), eq(accounts.ownerType, "user")))
    .orderBy(desc(ledgerEntries.createdAt));
}

export async function payReferralBonus(
  db: Database,
  params: { referrerId: string; newUserId: string },
) {
  const { REFERRAL_BONUS_AMOUNT, REFERRAL_BONUS_ASSET_SYMBOL } = env;

  const assetType = await db.query.assetTypes.findFirst({
    where: eq(assetTypes.symbol, REFERRAL_BONUS_ASSET_SYMBOL),
  });
  if (!assetType) {
    console.warn(
      `Referral bonus skipped: asset '${REFERRAL_BONUS_ASSET_SYMBOL}' not found`,
    );
    return null;
  }

  const bonusPoolAcct = await findSystemAccount(db, assetType.id);
  const referrerAcct = await findUserAccount(
    db,
    params.referrerId,
    assetType.id,
  );

  try {
    return await createTransaction(db, {
      idempotencyKey: `referral:bonus:${params.newUserId}:${REFERRAL_BONUS_ASSET_SYMBOL}`,
      type: "bonus",
      metadata: {
        referrerId: params.referrerId,
        newUserId: params.newUserId,
        source: "referral",
      },
      entries: [
        {
          accountId: bonusPoolAcct.id,
          direction: "DEBIT",
          amount: REFERRAL_BONUS_AMOUNT,
        },
        {
          accountId: referrerAcct.id,
          direction: "CREDIT",
          amount: REFERRAL_BONUS_AMOUNT,
        },
      ],
    });
  } catch (e) {
    if (e instanceof IdempotentReplayError) return e.existingTransaction;
    throw e;
  }
}
