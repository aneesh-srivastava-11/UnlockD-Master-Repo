import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { BudgetsPanel } from './BudgetsPanel';
import { ExpensesPanel } from './ExpensesPanel';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MetricCard, PageHeader, PageShell, StateBlock, StatusBadge } from './shared';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';

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

interface UnifiedRecord {
  id: string;
  type: 'TRANSFER' | 'EXPENSE';
  date: string;
  description: string | null;
  amount: number;
  accountName: string;
  status: string;
  direction: 'IN' | 'OUT';
}

interface GroupSummary {
  id: string;
  name: string;
  isSettled: boolean;
}

interface ImportSummary {
  id: string;
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
  const [recentRecords, setRecentRecords] = useState<UnifiedRecord[]>([]);
  const [activeGroups, setActiveGroups] = useState<GroupSummary[]>([]);
  const [pendingImports, setPendingImports] = useState<ImportSummary[]>([]);

  // Loading & Error States
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

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

  // Recipient search states
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingRecipients, setIsSearchingRecipients] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);

  // Activity & Insights Tab states
  const [activeTab, setActiveTab] = useState<'recent' | 'budgets' | 'queue'>('recent');
  const [expandedInsights, setExpandedInsights] = useState(false);

  // Helper to generate a unique idempotency key
  const generateIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'key-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  };

  const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || '0'), 0);

  const budgetRisk = budgets
    .map((budget: any) => {
      const spent = parseFloat(budget.spent || budget.currentSpend || budget.used || '0');
      const limit = parseFloat(budget.monthlyLimit || '0');
      return {
        ...budget,
        spent,
        limit,
        utilization: limit > 0 ? spent / limit : 0
      };
    })
    .filter((budget: any) => budget.limit > 0)
    .sort((a: any, b: any) => b.utilization - a.utilization)
    .slice(0, 3);

  // Fetch all user accounts
  const fetchAccounts = async (autoSelect = false) => {
    setLoadingAccounts(true);
    setGlobalError(null);
    try {
      const data = await apiClient<Account[]>('/accounts');
      setAccounts(data);
      if (data.length > 0) {
        const storedFrom = localStorage.getItem('financista_last_transfer_from');
        const matchedFrom = storedFrom && data.find(a => a.id === storedFrom);
        const defaultFrom = matchedFrom ? matchedFrom.id : data[0].id;

        if (autoSelect || !selectedAccountId) {
          setSelectedAccountId(data[0].id);
          setFromAccountId(defaultFrom);
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

  // Recurring Suggestions State
  interface RecurringSuggestion {
    id: string;
    accountId: string;
    merchant: string;
    suggestedAmount: string;
    categoryId: string | null;
    suggestedDate: string;
    status: string;
    account: { id: string; name: string; balance: string };
    category: { id: string; name: string } | null;
  }
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await apiClient<RecurringSuggestion[]>('/recurring-suggestions/check');
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load recurring suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleConfirmSuggestion = async (id: string) => {
    try {
      await apiClient(`/recurring-suggestions/${id}/confirm`, { method: 'POST' });
      toast.success('Recurring expense recorded successfully.');
      await handleRefreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log recurring expense.');
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await apiClient(`/recurring-suggestions/${id}/reject`, { method: 'POST' });
      toast.success('Recurring suggestion dismissed.');
      await handleRefreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss recurring suggestion.');
    }
  };

  const fetchOverviewData = async () => {
    setOverviewError(null);
    try {
      const [recordsData, groupsData, importsData] = await Promise.all([
        apiClient<{ records: UnifiedRecord[] }>('/records?page=1&pageSize=5'),
        apiClient<GroupSummary[]>('/groups'),
        apiClient<ImportSummary[]>('/imports')
      ]);
      setRecentRecords(recordsData.records);
      setActiveGroups(groupsData);
      setPendingImports(importsData);
    } catch (err: any) {
      setOverviewError(err.message || 'Failed to load overview data.');
    }
  };

  const handleRefreshAll = async () => {
    await fetchAccounts(false);
    if (selectedAccountId) {
      await fetchHistory(selectedAccountId);
    }
    await fetchExtraData();
    await fetchOverviewData();
    await fetchSuggestions();
  };

  // Initial load
  useEffect(() => {
    fetchAccounts(true);
    fetchExtraData();
    fetchOverviewData();
    fetchSuggestions();
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

  // Debounced search logic for transfer recipient
  useEffect(() => {
    if (recipientSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Skip query if it contains parenthesized account name (means selection has been made)
    if (recipientSearchQuery.includes('(') && recipientSearchQuery.includes(')')) {
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingRecipients(true);
      try {
        const token = localStorage.getItem('unlockd_auth_token');
        const response = await fetch(`http://localhost:3000/users/search?q=${encodeURIComponent(recipientSearchQuery)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search recipients:', err);
      } finally {
        setIsSearchingRecipients(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [recipientSearchQuery]);

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
      toast.success(`Account "${created.name}" created successfully.`);

      // Reload accounts and select the new one
      await fetchAccounts(false);
      setSelectedAccountId(created.id);
      setFromAccountId(created.id);
    } catch (err: any) {
      setCreateAccountError(err.message || 'Failed to create account.');
      toast.error(err.message || 'Failed to create account.');
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
        toast.error('Transfer failed: Insufficient funds or processing issue.');
      } else {
        setTransferSuccess(`Successfully transferred ₹${amountNum.toFixed(2)}.`);
        toast.success(`Successfully transferred ₹${amountNum.toFixed(2)}.`);
        localStorage.setItem('financista_last_transfer_from', fromAccountId);
        setToAccountId('');
        setTransferAmount('');
        setRecipientSearchQuery('');
      }

      // Reset idempotency key for the next transfer
      setIdempotencyKey(generateIdempotencyKey());

      // Refresh current balances, transaction log, budgets, and expenses
      await handleRefreshAll();
    } catch (err: any) {
      // If server returned 400 Bad Request with a FAILED transaction (overdraft)
      if (err instanceof ApiError && err.data?.transaction) {
        setTransferError(`Transfer failed: ${err.message}`);
        toast.error(`Transfer failed: ${err.message}`);
      } else {
        setTransferError(err.message || 'An unexpected error occurred during transfer.');
        toast.error(err.message || 'An unexpected error occurred during transfer.');
      }
      // Reset key to prevent resubmitting the failed request
      setIdempotencyKey(generateIdempotencyKey());
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Overview"
        description="Accounts, budgets, groups, history, imports, and analytics in one place."
        actions={<Button variant="outline" onClick={handleRefreshAll}>Refresh</Button>}
      />
      {globalError && (
        <StateBlock type="error" title="Dashboard error" description={globalError} />
      )}
      {overviewError && (
        <StateBlock type="error" title="Overview error" description={overviewError} />
      )}

      {loadingAccounts ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[130px] w-full rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-[108px] w-full rounded-xl animate-pulse" />
            <Skeleton className="h-[108px] w-full rounded-xl animate-pulse" />
            <Skeleton className="h-[108px] w-full rounded-xl animate-pulse" />
            <Skeleton className="h-[108px] w-full rounded-xl animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Large, visually dominant Total Balance Hero Card */}
          <Card className="p-6 bg-surface border-l-4 border-accent relative overflow-hidden flex flex-col justify-between min-h-[130px] shadow-lg shadow-accent/5">
            <div>
              <div className="text-xs font-bold text-text-secondary tracking-wide">Total Balance</div>
              <div className="mt-3 text-3xl sm:text-4xl font-extrabold text-text-primary font-mono tracking-tight">
                Rs {totalBalance.toFixed(2)}
              </div>
            </div>
            <div className="mt-4 text-xs text-text-secondary flex items-center gap-1.5 border-t border-border/40 pt-3">
              <span className="w-2 h-2 rounded-full bg-success/80 inline-block animate-pulse"></span>
              Active across {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </div>
          </Card>

          {/* Smaller, secondary stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Budget Watch" value={budgetRisk.length} detail="categories closest to limit" />
            <MetricCard label="Active Groups" value={activeGroups.length} detail={<Link to="/groups" className="text-accent hover:underline">Open groups</Link>} />
            <MetricCard label="Recent Activity" value={recentRecords.length} detail={<Link to="/history" className="text-accent hover:underline">View history</Link>} />
            <MetricCard label="Pending Imports" value={pendingImports.length} detail={<Link to="/imports" className="text-accent hover:underline">Review imports</Link>} />
          </div>
        </div>
      )}

      {/* Activity & Insights unified panel */}
      <Card className="p-6 flex flex-col gap-4 min-w-0 shadow-sm border border-border bg-surface">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border pb-4">
          <h2 className="text-lg font-bold text-text-primary">Activity & Insights</h2>
          <div className="flex bg-surface-elevated p-1 rounded-lg border border-border/80">
            <button
              type="button"
              onClick={() => { setActiveTab('recent'); setExpandedInsights(false); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'recent' 
                  ? 'bg-accent text-white shadow' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Recent Activity
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('budgets'); setExpandedInsights(false); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'budgets' 
                  ? 'bg-accent text-white shadow' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Budget Risk
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('queue'); setExpandedInsights(false); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'queue' 
                  ? 'bg-accent text-white shadow' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Action Queue
            </button>
          </div>
        </div>

        {/* Recurring suggestions inline review block */}
        {loadingSuggestions ? (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-accent/10 pb-2">
              <Skeleton className="h-4 w-1/3 rounded animate-pulse" />
              <Skeleton className="h-4 w-12 rounded-full animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <Skeleton className="h-[120px] w-full rounded-lg animate-pulse" />
              <Skeleton className="h-[120px] w-full rounded-lg animate-pulse" />
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b border-accent/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping shrink-0" />
                <h3 className="text-sm font-bold text-text-primary">Detected Recurring Expenses</h3>
              </div>
              <span className="text-[10px] text-accent font-semibold uppercase tracking-wider bg-accent/10 px-2 py-0.5 rounded-full font-sans">
                {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-surface border border-border rounded-lg p-3.5 flex flex-col gap-3 shadow-sm hover:border-accent/40 transition-colors">
                  <div className="flex justify-between items-start gap-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate" title={suggestion.merchant}>
                        {suggestion.merchant}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        Suggested for {new Date(suggestion.suggestedDate).toLocaleDateString()}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] bg-surface-elevated border border-border px-2 py-0.5 rounded text-text-primary font-medium">
                          Account: {suggestion.account.name}
                        </span>
                        {suggestion.category && (
                          <span className="text-[10px] bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-medium">
                            {suggestion.category.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-danger shrink-0">
                      -₹{parseFloat(suggestion.suggestedAmount).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 border-t border-border/40 pt-2.5 mt-1">
                    <Button
                      onClick={() => handleConfirmSuggestion(suggestion.id)}
                      className="h-8 text-xs font-semibold px-4 flex-grow bg-accent hover:bg-accent/90"
                    >
                      Log Expense
                    </Button>
                    <Button
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      variant="outline"
                      className="h-8 text-xs font-semibold px-3 text-text-secondary hover:text-text-primary"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1">
          {activeTab === 'recent' && (
            <div className="flex flex-col gap-3">
              {recentRecords.length === 0 ? (
                <StateBlock title="No activity yet" description="Transfers and expenses will appear here." />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {(expandedInsights ? recentRecords : recentRecords.slice(0, 3)).map((record) => (
                      <Link 
                        key={`${record.type}-${record.id}`} 
                        to={`/history?q=${encodeURIComponent(record.description || record.accountName || '')}`} 
                        className="rounded-lg border border-border/50 bg-background/50 p-3 hover:border-text-secondary/30 transition-colors flex justify-between items-center gap-3 min-w-0"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <StatusBadge tone={record.type === 'EXPENSE' ? 'warning' : 'accent'}>{record.type}</StatusBadge>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-text-primary truncate" title={record.description || record.accountName}>
                              {record.description || record.accountName}
                            </div>
                            <div className="text-[10px] text-text-secondary mt-0.5">{new Date(record.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <span className={`font-mono text-sm font-semibold shrink-0 ${record.direction === 'IN' ? 'text-success' : 'text-danger'}`}>
                          {record.direction === 'IN' ? '+' : '-'}Rs {record.amount.toFixed(2)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 border-t border-border/30 pt-3">
                    <Link to="/history" className="text-xs text-accent font-semibold hover:underline">Full history &rarr;</Link>
                    {recentRecords.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-text-secondary" 
                        onClick={() => setExpandedInsights(!expandedInsights)}
                      >
                        {expandedInsights ? 'Show Less' : `Show More (${recentRecords.length - 3} more)`}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="flex flex-col gap-3">
              {budgetRisk.length === 0 ? (
                <StateBlock title="No budget limits yet" description="Create categories and limits to track spending pressure." />
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    {(expandedInsights ? budgetRisk : budgetRisk.slice(0, 3)).map((budget: any) => (
                      <div key={budget.id || budget.categoryId} className="min-w-0 rounded-lg border border-border/50 bg-background/50 p-3">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate font-semibold text-text-primary">{budget.categoryName || budget.category?.name || 'Category'}</span>
                          <span className="font-mono text-xs text-text-secondary shrink-0">
                            Rs {parseFloat(budget.spent || '0').toFixed(2)} / Rs {parseFloat(budget.monthlyLimit || '0').toFixed(2)} ({Math.round(budget.utilization * 100)}%)
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded bg-background border border-border overflow-hidden">
                          <div className={`h-full transition-all duration-200 ${budget.utilization > 1 ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, budget.utilization * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 border-t border-border/30 pt-3">
                    <a href="/#budgets" className="text-xs text-accent font-semibold hover:underline">Manage budgets &rarr;</a>
                    {budgetRisk.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-text-secondary" 
                        onClick={() => setExpandedInsights(!expandedInsights)}
                      >
                        {expandedInsights ? 'Show Less' : `Show More (${budgetRisk.length - 3} more)`}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="flex flex-col gap-3">
              {pendingImports.length === 0 && activeGroups.length === 0 ? (
                <StateBlock title="Nothing needs attention" description="Pending imports and active groups appear here." />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {pendingImports.length > 0 && (
                      <Link to="/imports" className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-warning text-sm font-semibold flex justify-between items-center hover:bg-warning/10 transition-colors">
                        <span>{pendingImports.length} imported row{pendingImports.length === 1 ? '' : 's'} awaiting review</span>
                        <span className="text-xs underline">Review &rarr;</span>
                      </Link>
                    )}
                    {(expandedInsights ? activeGroups : activeGroups.slice(0, 3)).map((group) => (
                      <Link key={group.id} to={`/groups/${group.id}`} className="rounded-lg border border-border/50 bg-background/50 p-3 text-sm hover:border-text-secondary/30 transition-colors flex justify-between items-center gap-3 truncate" title={group.name}>
                        <span className="text-text-primary font-semibold truncate">Active group: {group.name}</span>
                        <span className="text-xs text-accent font-semibold underline shrink-0">Open &rarr;</span>
                      </Link>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-2 border-t border-border/30 pt-3">
                    <Link to="/groups" className="text-xs text-accent font-semibold hover:underline">View all groups &rarr;</Link>
                    {activeGroups.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs text-text-secondary" 
                        onClick={() => setExpandedInsights(!expandedInsights)}
                      >
                        {expandedInsights ? 'Show Less' : `Show More (${activeGroups.length - 3} more)`}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left column: Accounts List & Create Account & Budgets */}
        <div className="flex flex-col gap-6 w-full">
          <Card id="accounts" className="p-6 flex flex-col gap-4 scroll-mt-24">
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
                <div className="flex flex-col gap-2 w-full">
                  <Skeleton className="h-[76px] w-full rounded-lg animate-pulse" />
                  <Skeleton className="h-[76px] w-full rounded-lg animate-pulse" />
                  <Skeleton className="h-[76px] w-full rounded-lg animate-pulse" />
                </div>
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
          <div id="budgets" className="scroll-mt-24">
            <BudgetsPanel budgets={budgets} loading={loadingExtra} onRefresh={fetchExtraData} />
          </div>
        </div>

        {/* Right column: Transfer Form & Transaction History & Expenses */}
        <div className="flex flex-col gap-6 w-full">
          <Card id="transfers" className="p-6 flex flex-col gap-6 scroll-mt-24">
            
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

                  <div className="relative flex flex-col gap-1.5">
                    <Label htmlFor="transfer-recipient-search">Recipient Account Search</Label>
                    <Input
                      id="transfer-recipient-search"
                      type="text"
                      placeholder="Type email to search users..."
                      value={recipientSearchQuery}
                      onChange={(e) => {
                        setRecipientSearchQuery(e.target.value);
                        setShowResultsDropdown(true);
                        if (toAccountId) setToAccountId('');
                      }}
                      onFocus={() => setShowResultsDropdown(true)}
                      onBlur={() => setTimeout(() => setShowResultsDropdown(false), 200)}
                      disabled={isTransferring}
                      autoComplete="off"
                    />
                    <input type="hidden" name="toAccountId" value={toAccountId} />

                    {showResultsDropdown && recipientSearchQuery.trim().length >= 2 && (
                      <div className="absolute top-[100%] left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl max-h-[220px] overflow-y-auto z-[60] p-1 flex flex-col gap-1">
                        {isSearchingRecipients ? (
                          <div className="p-3 text-xs text-text-secondary text-center">Searching registered users...</div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-3 text-xs text-text-secondary text-center">No matching users found</div>
                        ) : (
                          searchResults.map((usr) => (
                            <div key={usr.id} className="p-2 border-b border-border/30 last:border-b-0">
                              <div className="text-xs font-semibold text-text-primary truncate">{usr.email}</div>
                              {usr.accounts.length === 0 ? (
                                <div className="text-[10px] text-text-disabled mt-1">No active accounts available</div>
                              ) : (
                                <div className="flex flex-col gap-1 mt-1">
                                  {usr.accounts.map((acc: any) => (
                                    <button
                                      key={acc.id}
                                      type="button"
                                      onClick={() => {
                                        setToAccountId(acc.id);
                                        setRecipientSearchQuery(`${usr.email} (${acc.name})`);
                                        setShowResultsDropdown(false);
                                      }}
                                      className="text-left w-full text-[11px] text-accent font-semibold px-2 py-1 rounded bg-accent/5 hover:bg-accent/15 border border-accent/10 transition-colors flex justify-between items-center"
                                    >
                                      <span>Select wallet: {acc.name}</span>
                                      <span className="font-mono text-[9px] text-text-secondary/70 truncate max-w-[120px]">{acc.id}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {toAccountId && (
                      <div className="text-[11px] text-success flex items-center gap-1 mt-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-success inline-block"></span>
                        Recipient Account Set: <code className="text-[9px] bg-background px-1 rounded border border-border">{toAccountId}</code>
                      </div>
                    )}
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
    </PageShell>
  );
};

export default Dashboard;
