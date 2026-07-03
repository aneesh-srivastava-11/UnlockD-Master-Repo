import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../api/client';
import { BudgetsPanel } from './BudgetsPanel';
import { ExpensesPanel } from './ExpensesPanel';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface Account {
  id: string;
  name: string;
  balance: string; // Prisma Decimal returns as a string representation of decimal
  createdAt: string;
}

interface Transaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  idempotencyKey: string;
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Smart Budgeting States
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Loading & Error States
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Form state: Create Account
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Form state: Money Transfer
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Helper to generate a unique idempotency key
  const generateIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'key-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  };

  // Fetch all user accounts
  const fetchAccounts = async (autoSelect = false) => {
    setLoadingAccounts(true);
    setGlobalError(null);
    try {
      const data = await apiClient<Account[]>('/accounts');
      setAccounts(data);
      if (data.length > 0) {
        if (autoSelect || !selectedAccountId) {
          setSelectedAccountId(data[0].id);
          setFromAccountId(data[0].id);
        }
      } else {
        setSelectedAccountId('');
        setFromAccountId('');
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to load accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Fetch transaction history for selected account
  const fetchHistory = async (accountId: string) => {
    if (!accountId) return;
    setLoadingHistory(true);
    try {
      const data = await apiClient<Transaction[]>(`/transactions/${accountId}`);
      setTransactions(data);
    } catch (err: any) {
      console.error('Error fetching transaction history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch categories, budgets, and expenses
  const fetchExtraData = async () => {
    setLoadingExtra(true);
    try {
      const cats = await apiClient<any[]>('/categories');
      const bdg = await apiClient<any[]>('/budgets');
      const exp = await apiClient<any[]>('/expenses');
      setCategories(cats);
      setBudgets(bdg);
      setExpenses(exp);
    } catch (err) {
      console.error("Error loading category/budget/expense details", err);
    } finally {
      setLoadingExtra(false);
    }
  };

  const handleRefreshAll = async () => {
    await fetchAccounts(false);
    if (selectedAccountId) {
      await fetchHistory(selectedAccountId);
    }
    await fetchExtraData();
  };

  // Initial load
  useEffect(() => {
    fetchAccounts(true);
    fetchExtraData();
    setIdempotencyKey(generateIdempotencyKey());
  }, []);

  // Refresh history when selected account changes
  useEffect(() => {
    if (selectedAccountId) {
      fetchHistory(selectedAccountId);
    } else {
      setTransactions([]);
    }
  }, [selectedAccountId]);

  // Handle account creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAccountError(null);

    if (!newAccountName.trim()) {
      setCreateAccountError('Account name is required.');
      return;
    }

    const startBalance = parseFloat(newAccountBalance);
    if (newAccountBalance && (isNaN(startBalance) || startBalance < 0)) {
      setCreateAccountError('Starting balance must be a non-negative number.');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const payload: any = { name: newAccountName.trim() };
      if (newAccountBalance) {
        payload.balance = startBalance;
      }

      const created = await apiClient<Account>('/accounts', {
        method: 'POST',
        bodyData: payload
      });

      setNewAccountName('');
      setNewAccountBalance('');

      // Reload accounts and select the new one
      await fetchAccounts(false);
      setSelectedAccountId(created.id);
      setFromAccountId(created.id);
    } catch (err: any) {
      setCreateAccountError(err.message || 'Failed to create account.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Handle transaction submission
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(null);

    if (!fromAccountId) {
      setTransferError('Please select a source account.');
      return;
    }

    if (!toAccountId.trim()) {
      setTransferError('Recipient account ID (UUID) is required.');
      return;
    }

    if (fromAccountId === toAccountId.trim()) {
      setTransferError('Sender and recipient accounts must be different.');
      return;
    }

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTransferError('Transfer amount must be greater than zero.');
      return;
    }

    setIsTransferring(true);
    try {
      const payload = {
        fromAccountId,
        toAccountId: toAccountId.trim(),
        amount: amountNum,
        idempotencyKey
      };

      const result = await apiClient<Transaction>('/transactions', {
        method: 'POST',
        bodyData: payload
      });

      if (result.status === 'FAILED') {
        setTransferError('Transfer failed: Insufficient funds or processing issue.');
      } else {
        setTransferSuccess(`Successfully transferred ₹${amountNum.toFixed(2)}.`);
        setToAccountId('');
        setTransferAmount('');
      }

      // Reset idempotency key for the next transfer
      setIdempotencyKey(generateIdempotencyKey());

      // Refresh current balances, transaction log, budgets, and expenses
      await handleRefreshAll();
    } catch (err: any) {
      // If server returned 400 Bad Request with a FAILED transaction (overdraft)
      if (err instanceof ApiError && err.data?.transaction) {
        setTransferError(`Transfer failed: ${err.message}`);
      } else {
        setTransferError(err.message || 'An unexpected error occurred during transfer.');
      }
      // Reset key to prevent resubmitting the failed request
      setIdempotencyKey(generateIdempotencyKey());
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-6xl mx-auto">
      {globalError && (
        <div className="p-4 rounded bg-danger/10 border border-danger text-danger text-sm">
          {globalError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left column: Accounts List & Create Account & Budgets */}
        <div className="flex flex-col gap-6 w-full">
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-lg font-semibold text-text-primary tracking-tight">Your Accounts</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => fetchAccounts(false)} 
                title="Refresh accounts"
                className="h-11 w-11 text-text-secondary hover:text-text-primary"
              >
                ↻
              </Button>
            </div>

            <div className="min-h-[140px] flex flex-col justify-center">
              {loadingAccounts ? (
                <div className="py-8 text-center text-text-secondary text-sm">Loading accounts...</div>
              ) : accounts.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm">No accounts found. Create one below to begin.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 py-1">
                  {accounts.map((acc) => (
                    <Card
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setFromAccountId(acc.id);
                      }}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedAccountId === acc.id
                          ? 'border-accent bg-surface-elevated'
                          : 'bg-background hover:border-text-secondary/40'
                      }`}
                    >
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-semibold text-text-primary text-sm truncate">{acc.name}</span>
                        <span className="font-mono text-text-primary text-sm shrink-0">₹{parseFloat(acc.balance).toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] font-mono text-text-secondary truncate mt-1">{acc.id}</div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Create New Account</h3>
              <form onSubmit={handleCreateAccount} className="flex flex-col gap-3">
                {createAccountError && (
                  <div className="p-2 text-xs rounded bg-danger/10 border border-danger text-danger">
                    {createAccountError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-account-name">Account Name</Label>
                  <Input
                    id="create-account-name"
                    type="text"
                    placeholder="e.g. Checking"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    disabled={isCreatingAccount}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="create-starting-balance">Starting Balance (Optional)</Label>
                  <Input
                    id="create-starting-balance"
                    type="number"
                    step="0.01"
                    placeholder="₹0.00"
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(e.target.value)}
                    disabled={isCreatingAccount}
                    className="font-mono"
                  />
                </div>

                <Button type="submit" disabled={isCreatingAccount} className="w-full mt-1">
                  {isCreatingAccount ? 'Creating...' : 'Create Account'}
                </Button>
              </form>
            </div>
          </Card>

          {/* Budgets Panel */}
          <BudgetsPanel budgets={budgets} loading={loadingExtra} onRefresh={fetchExtraData} />
        </div>

        {/* Right column: Transfer Form & Transaction History & Expenses */}
        <div className="flex flex-col gap-6 w-full">
          <Card className="p-6 flex flex-col gap-6">
            
            {/* Transfer Funds Form */}
            <div>
              <div className="border-b border-border pb-3 mb-4">
                <h2 className="text-lg font-semibold text-text-primary tracking-tight">Transfer Funds</h2>
              </div>
              
              <form onSubmit={handleTransfer} className="flex flex-col gap-4">
                {transferError && (
                  <div className="p-3 text-sm rounded bg-danger/10 border border-danger text-danger">
                    {transferError}
                  </div>
                )}
                {transferSuccess && (
                  <div className="p-3 text-sm rounded bg-success/10 border border-success text-success">
                    {transferSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="transfer-source-select">Source Account</Label>
                    <Select
                      value={fromAccountId}
                      onValueChange={setFromAccountId}
                      disabled={isTransferring}
                    >
                      <SelectTrigger id="transfer-source-select">
                        <SelectValue placeholder="Select source account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} (₹{parseFloat(acc.balance).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="transfer-recipient-id">Recipient Account UUID</Label>
                    <Input
                      id="transfer-recipient-id"
                      type="text"
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      disabled={isTransferring}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="transfer-amount-input">Amount (₹)</Label>
                    <Input
                      id="transfer-amount-input"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      disabled={isTransferring}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="transfer-idempotency-key">Idempotency Key (Auto-Generated)</Label>
                    <Input
                      id="transfer-idempotency-key"
                      value={idempotencyKey}
                      readOnly
                      className="font-mono text-text-secondary bg-surface"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isTransferring || accounts.length === 0}
                  className="w-full sm:w-auto self-start mt-2"
                >
                  {isTransferring ? 'Processing secure transfer...' : 'Initiate Transfer'}
                </Button>
              </form>
            </div>

            {/* Selected Account's Transaction History */}
            <div className="border-t border-border pt-6">
              <div className="pb-3 mb-4">
                <h2 className="text-lg font-semibold text-text-primary tracking-tight">Transaction History</h2>
              </div>
              
              {selectedAccountId ? (
                loadingHistory ? (
                  <div className="py-8 text-center text-text-secondary text-sm">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="py-8 text-center text-text-secondary text-sm">No transaction history found for this account.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {transactions.map((tx) => {
                      const isSender = tx.fromAccountId === selectedAccountId;
                      const amountText = (isSender ? '-' : '+') + `₹${parseFloat(tx.amount).toFixed(2)}`;
                      const statusClass = tx.status === 'COMPLETED' ? 'border-success/30' : 'border-danger/30';
                      const statusBadgeClass = tx.status === 'COMPLETED' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger';

                      return (
                        <Card 
                          key={tx.id} 
                          className={`p-4 bg-background border ${statusClass} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${statusBadgeClass}`}>
                                {tx.status}
                              </span>
                              <span className="text-[10px] text-text-secondary font-mono truncate">
                                {tx.id}
                              </span>
                            </div>
                            <span className="text-xs text-text-secondary font-mono truncate mt-1">
                              {isSender
                                ? `To: ${tx.toAccountId}`
                                : `From: ${tx.fromAccountId}`
                              }
                            </span>
                          </div>
                          
                          <div className="text-left sm:text-right flex flex-col sm:items-end gap-1 flex-shrink-0">
                            <span className={`font-mono text-sm font-semibold ${isSender ? 'text-text-primary' : 'text-success'}`}>
                              {amountText}
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              {new Date(tx.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="py-8 text-center text-text-secondary text-sm">Select or create an account to view transaction history.</div>
              )}
            </div>
          </Card>

          {/* Expenses Panel */}
          <ExpensesPanel 
            accounts={accounts} 
            categories={categories} 
            expenses={expenses} 
            loading={loadingExtra} 
            onRefresh={handleRefreshAll} 
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
