import React, { useState } from 'react';
import { apiClient } from '../api/client';

export interface Account {
  id: string;
  name: string;
  balance: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: string;
  description: string | null;
  createdAt: string;
  category: {
    id: string;
    name: string;
  };
  account: {
    name: string;
  };
}

interface ExpensesPanelProps {
  accounts: Account[];
  categories: Category[];
  expenses: Expense[];
  loading: boolean;
  onRefresh: () => void;
}

export const ExpensesPanel: React.FC<ExpensesPanelProps> = ({
  accounts,
  categories,
  expenses,
  loading,
  onRefresh
}) => {
  // Expense Entry Form State
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedAccountId) {
      setFormError('Please select an account.');
      return;
    }
    if (!selectedCategoryId) {
      setFormError('Please select a category.');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }

    setIsCreating(true);
    try {
      await apiClient('/expenses', {
        method: 'POST',
        bodyData: {
          accountId: selectedAccountId,
          categoryId: selectedCategoryId,
          amount: amt,
          description: description.trim() || undefined
        }
      });

      setFormSuccess('Expense recorded successfully!');
      setAmount('');
      setDescription('');
      
      // Notify parent to fetch updated data (balances, budgets, expenses)
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record expense.');
    } finally {
      setIsCreating(false);
    }
  };

  // Start Inline Editing
  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditCategoryId(expense.categoryId);
    setEditAmount(parseFloat(expense.amount).toString());
    setEditDescription(expense.description || '');
    setEditError(null);
  };

  // Cancel Inline Editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  // Save Inline Edit
  const handleSaveEdit = async (id: string) => {
    setEditError(null);

    if (!editCategoryId) {
      setEditError('Category is required.');
      return;
    }

    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      setEditError('Amount must be greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient(`/expenses/${id}`, {
        method: 'PATCH',
        bodyData: {
          categoryId: editCategoryId,
          amount: amt,
          description: editDescription.trim() || null
        }
      });

      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update expense.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Deleting Expense
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? The amount will be credited back to your account.')) {
      return;
    }

    try {
      await apiClient(`/expenses/${id}`, {
        method: 'DELETE'
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Record Expense Form */}
      <div className="panel">
        <div className="panel-header">
          <h2>Record Expense</h2>
        </div>

        <form onSubmit={handleSubmit} className="dashboard-form">
          {formError && <div className="error-message">{formError}</div>}
          {formSuccess && <div className="success-message">{formSuccess}</div>}

          <div className="form-grid-dashboard">
            <div className="form-group-dashboard">
              <label>Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={isCreating}
              >
                <option value="" disabled>Select account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (₹{parseFloat(acc.balance).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-dashboard">
              <label>Category</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={isCreating}
              >
                <option value="" disabled>Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-dashboard">
            <div className="form-group-dashboard">
              <label>Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isCreating}
                className="monospace-input"
              />
            </div>

            <div className="form-group-dashboard">
              <label>Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Weekly Groceries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
              />
            </div>
          </div>

          <button type="submit" className="btn-accent" disabled={isCreating || accounts.length === 0 || categories.length === 0}>
            {isCreating ? 'Recording expense...' : 'Record Expense'}
          </button>
        </form>
      </div>

      {/* 2. Expense List */}
      <div className="panel">
        <div className="panel-header">
          <h2>Expenses Log (Current Month)</h2>
        </div>

        {loading ? (
          <div className="panel-loading">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="panel-empty">No expenses logged for this month.</div>
        ) : (
          <div className="history-list">
            {expenses.map((expense) => {
              const isEditing = editingId === expense.id;

              return (
                <div 
                  key={expense.id} 
                  className="history-item"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '10px',
                    borderColor: 'var(--border)'
                  }}
                >
                  {isEditing ? (
                    // Inline Editing Sub-Form
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {editError && <div className="error-message" style={{ fontSize: '12px' }}>{editError}</div>}
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group-dashboard">
                          <label style={{ fontSize: '11px' }}>Category</label>
                          <select
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            disabled={isSaving}
                            style={{ padding: '6px' }}
                          >
                            <option value="" disabled>Select category...</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group-dashboard">
                          <label style={{ fontSize: '11px' }}>Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            disabled={isSaving}
                            className="monospace-input"
                            style={{ padding: '6px' }}
                          />
                        </div>
                      </div>

                      <div className="form-group-dashboard">
                        <label style={{ fontSize: '11px' }}>Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={isSaving}
                          style={{ padding: '6px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn-secondary" 
                          onClick={cancelEdit} 
                          disabled={isSaving}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn-accent" 
                          onClick={() => handleSaveEdit(expense.id)} 
                          disabled={isSaving}
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Regular Display Row
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '14px' }}>
                            {expense.category?.name || 'Uncategorized'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                            {expense.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No description</span>}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="tx-amount sent" style={{ color: 'var(--error)' }}>
                            -₹{parseFloat(expense.amount).toFixed(2)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                            via {expense.account?.name}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text)' }}>
                          {new Date(expense.createdAt).toLocaleString()}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn-secondary" 
                            onClick={() => startEdit(expense)}
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn-danger-outline" 
                            onClick={() => handleDelete(expense.id)}
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default ExpensesPanel;
