import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import accountRoutes from './routes/accountRoutes';
import transactionRoutes from './routes/transactionRoutes';
import categoryRoutes from './routes/categoryRoutes';
import expenseRoutes from './routes/expenseRoutes';
import budgetRoutes from './routes/budgetRoutes';
import groupRoutes from './routes/groupRoutes';
import groupExpenseRoutes from './routes/groupExpenseRoutes';
import settlementRoutes from './routes/settlementRoutes';
import recordsRoutes from './routes/recordsRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing (CORS) for frontend interaction
app.use(cors({
  origin: '*', // Allow all origins for the build-a-thon, or customize if necessary
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json());

// Register API Routes
app.use('/auth', authRoutes);
app.use('/accounts', accountRoutes);
app.use('/transactions', transactionRoutes);
app.use('/categories', categoryRoutes);
app.use('/expenses', expenseRoutes);
app.use('/budgets', budgetRoutes);
app.use('/groups', groupRoutes);
app.use('/groups', groupExpenseRoutes);
app.use('/', settlementRoutes);
app.use('/records', recordsRoutes);

// Global Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler Log:", err);
  
  const statusCode = err.status || 500;
  const message = err.message || "An unexpected internal server error occurred";
  
  return res.status(statusCode).json({
    error: message
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
