import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { PageHeader, PageShell, StateBlock } from './shared';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  createdAt: string;
}

interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  monthlyLimit: string;
}

export const SettingsPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Manager dialog state
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Budget limit dialog state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [editLimitValue, setEditLimitValue] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setCategoryError(null);
    try {
      const catsData = await apiClient<Category[]>('/categories');
      const budgetsData = await apiClient<Budget[]>('/budgets');

      setCategories(catsData);

      // Prepopulate limits state
      const initialLimits: Record<string, string> = {};
      catsData.forEach(cat => {
        const b = budgetsData.find(x => x.categoryId === cat.id);
        initialLimits[cat.id] = b ? parseFloat(b.monthlyLimit).toString() : '';
      });
      setLimits(initialLimits);
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    setCategorySuccess(null);

    if (!newCategoryName.trim()) {
      setCategoryError('Category name is required.');
      toast.error('Category name is required.');
      return;
    }

    setIsCreatingCategory(true);
    try {
      await apiClient('/categories', {
        method: 'POST',
        bodyData: { name: newCategoryName.trim() }
      });
      setNewCategoryName('');
      setCategorySuccess('Category created successfully!');
      toast.success('Category created successfully!');
      setIsAddCategoryOpen(false); // Close modal
      await fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create category.');
      toast.error(err.message || 'Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }
    setCategoryError(null);
    setCategorySuccess(null);
    try {
      await apiClient(`/categories/${id}`, {
        method: 'DELETE'
      });
      setCategorySuccess('Category deleted successfully!');
      toast.success('Category deleted successfully!');
      await fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to delete category.');
      toast.error(err.message || 'Failed to delete category.');
    }
  };

  const openBudgetDialog = (category: Category) => {
    setEditingCategory(category);
    setEditLimitValue(limits[category.id] || '');
    setBudgetError(null);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setBudgetError(null);
    setIsSavingBudget(true);

    const categoryId = editingCategory.id;

    // If limit is empty, 0, or cleared, clear/delete the budget limit row
    if (editLimitValue === '' || parseFloat(editLimitValue) === 0) {
      try {
        await apiClient(`/budgets/${categoryId}`, {
          method: 'DELETE'
        });

        // Update local limits and close dialog
        setLimits(prev => ({ ...prev, [categoryId]: '' }));
        setEditingCategory(null);
        toast.success('Budget limit cleared successfully!');
        await fetchData();
      } catch (err: any) {
        if (err.status === 404) {
          // If not found, it means no limit was set yet, which is fine
          setLimits(prev => ({ ...prev, [categoryId]: '' }));
          setEditingCategory(null);
        } else {
          setBudgetError(err.message || 'Failed to clear budget limit.');
          toast.error(err.message || 'Failed to clear budget limit.');
        }
      } finally {
        setIsSavingBudget(false);
      }
      return;
    }

    const numericLimit = parseFloat(editLimitValue);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      setBudgetError('Monthly limit must be greater than zero.');
      setIsSavingBudget(false);
      return;
    }

    try {
      await apiClient('/budgets', {
        method: 'POST',
        bodyData: {
          categoryId,
          monthlyLimit: numericLimit
        }
      });

      // Update limits and close dialog
      setLimits(prev => ({ ...prev, [categoryId]: numericLimit.toString() }));
      setEditingCategory(null);
      toast.success('Budget limit saved successfully!');
      await fetchData();
    } catch (err: any) {
      setBudgetError(err.message || 'Failed to save budget limit.');
      toast.error(err.message || 'Failed to save budget limit.');
    } finally {
      setIsSavingBudget(false);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Settings" description="Configure spending categories and standing monthly budget limits." />

      {categoryError && (
        <StateBlock type="error" title="Settings error" description={categoryError} />
      )}

      {categorySuccess && (
        <div className="p-4 rounded bg-success/10 border border-success text-success text-sm">
          {categorySuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* 1. Category Management Card */}
        <Card className="p-6">
          <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">Categories</h2>
            
            {/* Add Category Dialog */}
            <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-11 px-4 text-sm font-semibold">
                  + Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateCategory}>
                  <DialogHeader className="mb-4">
                    <DialogTitle>Add Category</DialogTitle>
                    <DialogDescription>Create a custom spending category. Names must be unique.</DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-1.5 mb-6">
                    <Label htmlFor="category-name">Category Name</Label>
                    <Input
                      id="category-name"
                      placeholder="e.g. Groceries, Transport"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      disabled={isCreatingCategory}
                    />
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddCategoryOpen(false)}
                      disabled={isCreatingCategory}
                      className="max-sm:w-full"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isCreatingCategory}
                      className="max-sm:w-full"
                    >
                      {isCreatingCategory ? 'Creating...' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <StateBlock type="loading" title="Loading categories..." />
          ) : categories.length === 0 ? (
            <StateBlock 
              title="No custom categories" 
              description="Categories let you group your expenses (e.g. food, rent, entertainment) to track budgets and analyze spending habits. Add a category above to get started." 
            />
          ) : (
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  className="flex justify-between items-center p-3 rounded border border-border bg-background"
                >
                  <span className="font-semibold text-text-primary text-sm truncate" title={cat.name}>{cat.name}</span>
                  <Button 
                    variant="outline" 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="text-danger border-danger/20 hover:bg-danger/10 hover:border-danger text-xs h-9 min-h-0 min-w-0"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. Budget limits Card */}
        <Card className="p-6">
          <div className="border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">Monthly Budget Limits</h2>
          </div>

          {loading ? (
            <StateBlock type="loading" title="Loading limits..." />
          ) : categories.length === 0 ? (
            <StateBlock title="No categories yet" description="Create a category first to set budget limits." />
          ) : (
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {categories.map(cat => {
                const limitAmount = limits[cat.id];
                return (
                  <div 
                    key={cat.id} 
                    className="flex justify-between items-center p-3 rounded border border-border bg-background gap-4"
                  >
                    <div className="min-w-0 flex-grow">
                      <span className="font-semibold text-text-primary text-sm block truncate">{cat.name}</span>
                      <span className="text-xs text-text-secondary font-mono">
                        {limitAmount ? `₹${parseFloat(limitAmount).toFixed(2)} / month` : 'No limit set'}
                      </span>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => openBudgetDialog(cat)}
                      className="text-xs h-9 min-h-0 px-3 shrink-0"
                    >
                      {limitAmount ? 'Edit Limit' : 'Set Limit'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Edit Budget Limit Modal Dialog */}
      <Dialog open={editingCategory !== null} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
        <DialogContent>
          {editingCategory && (
            <form onSubmit={handleSaveBudget}>
              <DialogHeader className="mb-4">
                <DialogTitle>Budget Limit: {editingCategory.name}</DialogTitle>
                <DialogDescription>
                  Configure the standing monthly spending limit for this category. Leave blank or enter 0 to disable.
                </DialogDescription>
              </DialogHeader>

              {budgetError && (
                <div className="p-3 text-xs rounded bg-danger/10 border border-danger text-danger mb-4">
                  {budgetError}
                </div>
              )}

              <div className="flex flex-col gap-1.5 mb-6">
                <Label htmlFor="budget-limit">Monthly Limit (₹)</Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-text-secondary font-mono text-sm">₹</span>
                  <Input
                    id="budget-limit"
                    type="number"
                    step="1"
                    placeholder="e.g. 5000"
                    value={editLimitValue}
                    onChange={(e) => setEditLimitValue(e.target.value)}
                    disabled={isSavingBudget}
                    className="pl-7 font-mono"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingCategory(null)}
                  disabled={isSavingBudget}
                  className="max-sm:w-full"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSavingBudget}
                  className="max-sm:w-full"
                >
                  {isSavingBudget ? 'Saving...' : 'Save Limit'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </PageShell>
  );
};

export default SettingsPage;
