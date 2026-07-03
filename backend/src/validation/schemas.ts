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
  }).trim().min(1, "Idempotency key cannot be empty"),
  description: z.string().trim().optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID").optional()
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

/**
 * Validation schema for POST /groups
 */
export const createGroupSchema = z.object({
  name: z.string({
    required_error: "Group name is required",
    invalid_type_error: "Group name must be a string"
  }).trim().min(1, "Group name cannot be empty")
});

/**
 * Validation schema for POST /groups/:id/members
 */
export const addMemberSchema = z.object({
  email: z.string({
    required_error: "Email is required"
  }).email("Invalid email format").trim()
});

/**
 * Validation schema for POST /groups/:id/expenses
 */
export const createGroupExpenseSchema = z.object({
  description: z.string({
    required_error: "Description is required",
    invalid_type_error: "Description must be a string"
  }).trim().min(1, "Description cannot be empty"),
  amount: z.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number"
  }).positive("Amount must be greater than zero"),
  paidByUserId: z.string({
    required_error: "paidByUserId is required"
  }).uuid("paidByUserId must be a valid UUID"),
  splitType: z.enum(["equal", "custom"], {
    required_error: "splitType must be 'equal' or 'custom'"
  }),
  splits: z.array(
    z.object({
      userId: z.string().uuid("userId must be a valid UUID"),
      shareAmount: z.number().positive("shareAmount must be positive").optional()
    })
  ).optional().default([])
}).superRefine((data, ctx) => {
  if (data.splitType === 'custom') {
    if (!data.splits || data.splits.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one split member must be defined for custom splits",
        path: ["splits"]
      });
      return;
    }
    let sum = 0;
    for (const split of data.splits) {
      if (split.shareAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "shareAmount is required for custom splits",
          path: ["splits"]
        });
        return;
      }
      sum += split.shareAmount;
    }
    // Compare with decimal tolerance (within 1 cent)
    if (Math.abs(sum - data.amount) > 0.011) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum of custom splits (${sum.toFixed(2)}) must exactly equal the total expense amount (${data.amount.toFixed(2)})`,
        path: ["splits"]
      });
    }
  }
});

/**
 * Validation schema for POST /settlements/:id/pay
 */
export const paySettlementSchema = z.object({
  accountId: z.string({
    required_error: "Account ID is required"
  }).uuid("Account ID must be a valid UUID")
});

const recordsQueryBaseSchema = z.object({
  q: z.string().trim().optional(),
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "startDate must be a valid date string" }).optional(),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "endDate must be a valid date string" }).optional(),
  categoryId: z.string().uuid("categoryId must be a valid UUID").optional(),
  minAmount: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().nonnegative().optional()),
  maxAmount: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().nonnegative().optional()),
  accountId: z.string().uuid("accountId must be a valid UUID").optional(),
  type: z.enum(["TRANSFER", "EXPENSE"], {
    invalid_type_error: "type must be either TRANSFER or EXPENSE"
  }).optional(),
  page: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().int().positive().optional().default(1)),
  pageSize: z.preprocess((val) => (val === undefined || val === '' ? undefined : Number(val)), z.number().int().positive().optional().default(25))
});

const validateRecordQueryRange = (data: z.infer<typeof recordsQueryBaseSchema>, ctx: z.RefinementCtx) => {
  if (data.minAmount !== undefined && data.maxAmount !== undefined) {
    if (data.minAmount > data.maxAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minAmount must be less than or equal to maxAmount",
        path: ["minAmount"]
      });
    }
  }
  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startDate must be before or equal to endDate",
      path: ["startDate"]
    });
  }
};

/**
 * Validation schema for GET /records query parameters
 */
export const recordsQuerySchema = recordsQueryBaseSchema.superRefine(validateRecordQueryRange);

/**
 * Validation schema for GET /records/export query parameters
 */
export const recordsExportQuerySchema = recordsQueryBaseSchema.extend({
  format: z.enum(["csv", "pdf"], {
    invalid_type_error: "format must be either csv or pdf"
  }).default("csv")
}).superRefine(validateRecordQueryRange);

/**
 * Validation schema for PATCH /transactions/:id/categorize
 */
export const categorizeTransactionSchema = z.object({
  description: z.string().trim().nullable().optional(),
  categoryId: z.string().uuid("Category ID must be a valid UUID").nullable().optional()
}).superRefine((data, ctx) => {
  if (data.description === undefined && data.categoryId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one field (description or categoryId) must be provided for update",
      path: ["description"]
    });
  }
});
