import type { Transaction } from "../db/schema.js";

export class InsufficientFundsError extends Error {
  readonly statusCode = 422;
  constructor(msg = "Insufficient funds") {
    super(msg);
    this.name = "InsufficientFundsError";
  }
}

export class AccountNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(msg = "Account not found") {
    super(msg);
    this.name = "AccountNotFoundError";
  }
}

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(msg: string) {
    super(msg);
    this.name = "ValidationError";
  }
}

export class IdempotentReplayError extends Error {
  constructor(public readonly existingTransaction: Transaction) {
    super("Idempotent replay");
    this.name = "IdempotentReplayError";
  }
}
