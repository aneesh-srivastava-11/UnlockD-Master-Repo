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

/**
 * Validation schema for POST /categories
 */
export const createCategorySchema = z.object({
  name: z.string({
    required_error: "Category name is required"
  }).trim().min(1, "Category name cannot be empty")
});

/**
 * Validation schema for POST /expenses
 */
export const createExpenseSchema = z.object({
  accountId: z.string({
    required_error: "Account ID is required"
  }).uuid("Account ID must be a valid UUID"),
  categoryId: z.string({
    required_error: "Category ID is required"
  }).uuid("Category ID must be a valid UUID"),
  amount: z.number({
    required_error: "Expense amount is required",
    invalid_type_error: "Expense amount must be a number"
  }).positive("Expense amount must be greater than zero"),
  description: z.string().trim().optional()
});

/**
 * Validation schema for PATCH /expenses/:id
 */
export const updateExpenseSchema = z.object({
  amount: z.number({
    invalid_type_error: "Expense amount must be a number"
  }).positive("Expense amount must be greater than zero").optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID").optional(),
  description: z.string().trim().optional()
}).refine(data => data.amount !== undefined || data.categoryId !== undefined || data.description !== undefined, {
  message: "At least one field (amount, categoryId, or description) must be provided for update",
  path: ["amount"]
});

/**
 * Validation schema for POST /budgets
 */
export const upsertBudgetSchema = z.object({
  categoryId: z.string({
    required_error: "Category ID is required"
  }).uuid("Category ID must be a valid UUID"),
  monthlyLimit: z.number({
    required_error: "Monthly limit is required",
    invalid_type_error: "Monthly limit must be a number"
  }).positive("Monthly limit must be greater than zero")
});

/**
 * Validation schema for GET /expenses query parameters
 */
export const expenseQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format").optional()
});


