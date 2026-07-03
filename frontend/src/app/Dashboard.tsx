import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '../api/client';
import './app.css';

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

  // Initial load
  useEffect(() => {
    fetchAccounts(true);
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

      // Refresh current balances and transaction log
      await fetchAccounts(false);
      if (selectedAccountId) {
        await fetchHistory(selectedAccountId);
      }
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
    <div className="dashboard-container">
      {globalError && <div className="error-alert">{globalError}</div>}

      <div className="dashboard-grid">
        {/* Left column: Accounts List & Create Account */}
        <div className="panel accounts-panel">
          <div className="panel-header">
            <h2>Your Accounts</h2>
            <button className="btn-icon" onClick={() => fetchAccounts(false)} title="Refresh accounts">
              ↻
            </button>
          </div>

          {loadingAccounts ? (
            <div className="panel-loading">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="panel-empty">No accounts found. Create one below to begin.</div>
          ) : (
            <div className="accounts-list">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className={`account-card ${selectedAccountId === acc.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setFromAccountId(acc.id);
                  }}
                >
                  <div className="account-card-header">
                    <span className="account-name">{acc.name}</span>
                    <span className="account-balance">₹{parseFloat(acc.balance).toFixed(2)}</span>
                  </div>
                  <div className="account-id">{acc.id}</div>
                </div>
              ))}
            </div>
          )}

          <div className="panel-divider"></div>

          {/* Create Account Form */}
          <div className="create-account-section">
            <h3>Create New Account</h3>
            <form onSubmit={handleCreateAccount} className="dashboard-form">
              {createAccountError && <div className="error-message">{createAccountError}</div>}

              <div className="form-group-dashboard">
                <input
                  type="text"
                  placeholder="Account Name (e.g. Checking)"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  disabled={isCreatingAccount}
                />
              </div>

              <div className="form-group-dashboard">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Starting Balance (optional, defaults to ₹0.00)"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value)}
                  disabled={isCreatingAccount}
                />
              </div>

              <button type="submit" className="btn-secondary w-full" disabled={isCreatingAccount}>
                {isCreatingAccount ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Transfer Form & Transaction History */}
        <div className="panel transfer-history-panel">

          {/* Transfer Funds Form */}
          <div className="transfer-section">
            <h2>Transfer Funds</h2>
            <form onSubmit={handleTransfer} className="dashboard-form">
              {transferError && <div className="error-message">{transferError}</div>}
              {transferSuccess && <div className="success-message">{transferSuccess}</div>}

              <div className="form-grid-dashboard">
                <div className="form-group-dashboard">
                  <label>Source Account</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    disabled={isTransferring}
                  >
                    <option value="" disabled>Select source account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (₹{parseFloat(acc.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-dashboard">
                  <label>Recipient Account UUID</label>
                  <input
                    type="text"
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    disabled={isTransferring}
                  />
                </div>
              </div>

              <div className="form-grid-dashboard">
                <div className="form-group-dashboard">
                  <label>Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    disabled={isTransferring}
                  />
                </div>

                <div className="form-group-dashboard">
                  <label>Idempotency Key (Auto-Generated)</label>
                  <input
                    type="text"
                    value={idempotencyKey}
                    readOnly
                    className="monospace-input"
                  />
                </div>
              </div>

              <button type="submit" className="btn-accent" disabled={isTransferring || accounts.length === 0}>
                {isTransferring ? 'Processing secure transfer...' : 'Initiate Transfer'}
              </button>
            </form>
          </div>

          <div className="panel-divider"></div>

          {/* Selected Account's Transaction History */}
          <div className="history-section">
            <h2>Transaction History</h2>
            {selectedAccountId ? (
              loadingHistory ? (
                <div className="panel-loading">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="panel-empty">No transaction history found for this account.</div>
              ) : (
                <div className="history-list">
                  {transactions.map((tx) => {
                    const isSender = tx.fromAccountId === selectedAccountId;
                    const amountText = (isSender ? '-' : '+') + `₹${parseFloat(tx.amount).toFixed(2)}`;

                    return (
                      <div key={tx.id} className={`history-item ${tx.status.toLowerCase()}`}>
                        <div className="history-item-left">
                          <span className={`status-badge ${tx.status.toLowerCase()}`}>
                            {tx.status}
                          </span>
                          <span className="tx-details">
                            {isSender
                              ? `To: ${tx.toAccountId}`
                              : `From: ${tx.fromAccountId}`
                            }
                          </span>
                        </div>
                        <div className="history-item-right">
                          <span className={`tx-amount ${isSender ? 'sent' : 'received'} ${tx.status.toLowerCase()}`}>
                            {amountText}
                          </span>
                          <span className="tx-date">
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="panel-empty">Select or create an account to view transaction history.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
