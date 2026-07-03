import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import './settings.css';

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

  // Form & action feedback states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySuccess, setCategorySuccess] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [limits, setLimits] = useState<Record<string, string>>({});
  const [budgetFeedback, setBudgetFeedback] = useState<Record<string, { success?: string; error?: string; saving?: boolean }>>({});

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
      await fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoryError(null);
    setCategorySuccess(null);

    try {
      await apiClient(`/categories/${id}`, {
        method: 'DELETE'
      });
      setCategorySuccess('Category deleted successfully!');
      await fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to delete category.');
    }
  };

  const handleLimitChange = (categoryId: string, val: string) => {
    setLimits(prev => ({ ...prev, [categoryId]: val }));
    // Clear feedback when typing
    setBudgetFeedback(prev => ({ ...prev, [categoryId]: {} }));
  };

  const handleSaveBudget = async (categoryId: string) => {
    const rawLimit = limits[categoryId];
    
    setBudgetFeedback(prev => ({
      ...prev,
      [categoryId]: { saving: true }
    }));

    // If limit is empty or 0, clear/delete the budget limit row
    if (rawLimit === '' || rawLimit === undefined || parseFloat(rawLimit) === 0) {
      try {
        await apiClient(`/budgets/${categoryId}`, {
          method: 'DELETE'
        });

        setBudgetFeedback(prev => ({
          ...prev,
          [categoryId]: { success: 'Limit cleared!' }
        }));
        setLimits(prev => ({ ...prev, [categoryId]: '' }));
      } catch (err: any) {
        // If not found, it means no limit was set yet, which is fine
        if (err.status === 404) {
          setBudgetFeedback(prev => ({
            ...prev,
            [categoryId]: { success: 'No limit set.' }
          }));
          setLimits(prev => ({ ...prev, [categoryId]: '' }));
        } else {
          setBudgetFeedback(prev => ({
            ...prev,
            [categoryId]: { error: err.message || 'Failed to clear.' }
          }));
        }
      }
      return;
    }

    const numericLimit = parseFloat(rawLimit);
    if (isNaN(numericLimit) || numericLimit <= 0) {
      setBudgetFeedback(prev => ({
        ...prev,
        [categoryId]: { error: 'Must be greater than 0.' }
      }));
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

      setBudgetFeedback(prev => ({
        ...prev,
        [categoryId]: { success: 'Saved!' }
      }));

      // Refresh budget list to reflect changes
      const budgetsData = await apiClient<Budget[]>('/budgets');
      
      // Update limits state with the newly saved budget limit
      const b = budgetsData.find(x => x.categoryId === categoryId);
      if (b) {
        setLimits(prev => ({ ...prev, [categoryId]: parseFloat(b.monthlyLimit).toString() }));
      }
    } catch (err: any) {
      setBudgetFeedback(prev => ({
        ...prev,
        [categoryId]: { error: err.message || 'Failed to save.' }
      }));
    }
  };

  return (
    <div className="settings-container animate-fade-in">
      <div className="settings-grid">
        {/* Left Panel: Category Management */}
        <div className="panel">
          <div className="settings-section-header">
            <h2>Manage Categories</h2>
          </div>

          {categoryError && <div className="error-alert">{categoryError}</div>}
          {categorySuccess && <div className="success-message" style={{ marginBottom: '14px' }}>{categorySuccess}</div>}

          {loading ? (
            <div className="panel-loading">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="panel-empty">No categories found. Create one below to begin.</div>
          ) : (
            <div className="category-manager-list">
              {categories.map(cat => (
                <div key={cat.id} className="category-manager-item">
                  <span className="category-name-tag">{cat.name}</span>
                  <button 
                    className="btn-danger-outline" 
                    onClick={() => handleDeleteCategory(cat.id)}
                    title="Delete Category"
                  >
                    ✕ Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="panel-divider"></div>

          <div className="create-account-section">
            <h3>Add New Category</h3>
            <form onSubmit={handleCreateCategory} className="dashboard-form">
              <div className="form-group-dashboard">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Groceries, Entertainment)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={isCreatingCategory}
                />
              </div>
              <button type="submit" className="btn-accent w-full" disabled={isCreatingCategory}>
                {isCreatingCategory ? 'Adding...' : 'Add Category'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel: Budget Limits */}
        <div className="panel">
          <div className="settings-section-header">
            <h2>Budget Limits</h2>
          </div>

          <p style={{ fontSize: '13px', marginBottom: '16px', color: 'var(--text)' }}>
            Set a standing monthly spending limit per category. These limits automatically apply every month.
          </p>

          {loading ? (
            <div className="panel-loading">Loading budget editor...</div>
          ) : categories.length === 0 ? (
            <div className="panel-empty">Please create a category first before setting a budget.</div>
          ) : (
            <div className="budget-limits-list">
              {categories.map(cat => {
                const feedback = budgetFeedback[cat.id] || {};
                return (
                  <div key={cat.id} className="budget-limit-row">
                    <label title={cat.name}>{cat.name}</label>
                    <div className="budget-limit-input-wrapper">
                      <span className="budget-currency-symbol">₹</span>
                      <input
                        type="number"
                        step="1"
                        placeholder="Limit amount"
                        value={limits[cat.id] || ''}
                        onChange={(e) => handleLimitChange(cat.id, e.target.value)}
                        disabled={feedback.saving}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <button
                        className="btn-accent"
                        onClick={() => handleSaveBudget(cat.id)}
                        disabled={feedback.saving}
                      >
                        {feedback.saving ? 'Saving...' : 'Save'}
                      </button>
                      {feedback.success && <span style={{ fontSize: '11px', color: '#10b981' }}>{feedback.success}</span>}
                      {feedback.error && <span style={{ fontSize: '11px', color: 'var(--error)' }}>{feedback.error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
