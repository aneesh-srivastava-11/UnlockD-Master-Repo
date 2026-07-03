import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

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
    <div className="flex flex-col gap-6">
      
      {/* 1. Record Expense Form */}
      <Card className="p-6">
        <div className="border-b border-border pb-3 mb-4">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">Record Expense</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <div className="p-3 text-sm rounded bg-danger/10 border border-danger text-danger">{formError}</div>}
          {formSuccess && <div className="p-3 text-sm rounded bg-success/10 border border-success text-success">{formSuccess}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-account">Account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={isCreating}
              >
                <SelectTrigger id="expense-account">
                  <SelectValue placeholder="Select account..." />
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
              <Label htmlFor="expense-category">Category</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
                disabled={isCreating}
              >
                <SelectTrigger id="expense-category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isCreating}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-description">Description (Optional)</Label>
              <Input
                id="expense-description"
                type="text"
                placeholder="e.g. Weekly Groceries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full sm:w-auto self-start mt-2" 
            disabled={isCreating || accounts.length === 0 || categories.length === 0}
          >
            {isCreating ? 'Recording expense...' : 'Record Expense'}
          </Button>
        </form>
      </Card>

      {/* 2. Expense List */}
      <Card className="p-6">
        <div className="border-b border-border pb-3 mb-4">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">Expenses Log (Current Month)</h2>
        </div>

        {loading ? (
          <div className="py-8 text-center text-text-secondary text-sm">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="py-8 text-center text-text-secondary text-sm">No expenses logged for this month.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {expenses.map((expense) => {
              const isEditing = editingId === expense.id;

              return (
                <Card 
                  key={expense.id} 
                  className="p-4 bg-background border-border flex flex-col gap-3"
                >
                  {isEditing ? (
                    // Inline Editing Sub-Form
                    <div className="flex flex-col gap-3">
                      {editError && <div className="p-2 text-xs rounded bg-danger/10 border border-danger text-danger">{editError}</div>}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Category</Label>
                          <Select
                            value={editCategoryId}
                            onValueChange={setEditCategoryId}
                            disabled={isSaving}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select category..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Amount (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            disabled={isSaving}
                            className="font-mono h-10"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={isSaving}
                          className="h-10"
                        />
                      </div>

                      <div className="flex gap-2 justify-end mt-1">
                        <Button 
                          variant="outline"
                          onClick={cancelEdit} 
                          disabled={isSaving}
                          className="h-10 min-h-0 text-xs px-3"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleSaveEdit(expense.id)} 
                          disabled={isSaving}
                          className="h-10 min-h-0 text-xs px-4"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Regular Display Row
                    <>
                      <div className="flex justify-between items-baseline gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold text-text-primary text-sm truncate">
                            {expense.category?.name || 'Uncategorized'}
                          </span>
                          <span className="text-xs text-text-secondary truncate">
                            {expense.description || <span className="italic opacity-60">No description</span>}
                          </span>
                        </div>
                        <div className="text-right flex flex-col gap-1 flex-shrink-0">
                          <span className="font-mono text-sm font-semibold text-danger">
                            -₹{parseFloat(expense.amount).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            via {expense.account?.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] border-t border-border pt-2 mt-1">
                        <span className="text-text-secondary">
                          {new Date(expense.createdAt).toLocaleString()}
                        </span>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => startEdit(expense)}
                            className="h-9 min-h-0 text-[11px] px-2.5"
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDelete(expense.id)}
                            className="h-9 min-h-0 text-[11px] px-2.5"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

    </div>
  );
};

export default ExpensesPanel;
