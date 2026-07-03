import { z } from 'zod';

/**
 * Validation schema for POST /accounts
 */
export const createAccountSchema = z.object({
  name: z.string({
    required_error: "Account name is required",
    invalid_type_error: "Account name must be a string"
  }).trim().min(1, "Account name cannot be empty"),
  balance: z.number({
    invalid_type_error: "Starting balance must be a number"
  }).nonnegative("Starting balance cannot be negative").optional().default(0)
});

/**
 * Validation schema for POST /transactions
 */
export const createTransactionSchema = z.object({
  fromAccountId: z.string({
    required_error: "Sender account ID (fromAccountId) is required"
  }).uuid("Sender account ID (fromAccountId) must be a valid UUID"),
  toAccountId: z.string({
    required_error: "Recipient account ID (toAccountId) is required"
  }).uuid("Recipient account ID (toAccountId) must be a valid UUID"),
  amount: z.number({
    required_error: "Transfer amount is required",
    invalid_type_error: "Transfer amount must be a number"
  }).positive("Transfer amount must be greater than zero"),
  idempotencyKey: z.string({
    required_error: "Idempotency key is required"
  }).trim().min(1, "Idempotency key cannot be empty")
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: "Sender and recipient accounts must be different",
  path: ["toAccountId"] // attach error to toAccountId
});

/**
 * Validation schema for POST /auth/signup
 */
export const signupSchema = z.object({
  email: z.string({
    required_error: "Email is required"
  }).email("Invalid email format").trim(),
  password: z.string({
    required_error: "Password is required"
  }).min(6, "Password must be at least 6 characters long")
});

/**
 * Validation schema for POST /auth/login
 */
export const loginSchema = z.object({
  email: z.string({
    required_error: "Email is required"
  }).email("Invalid email format").trim(),
  password: z.string({
    required_error: "Password is required"
  }).min(1, "Password cannot be empty")
});

