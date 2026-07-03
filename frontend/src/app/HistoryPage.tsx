import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Edit3, Filter, Search, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface Account {
  id: string;
  name: string;
  balance: string;
}

interface Category {
  id: string;
  name: string;
}

interface RecordCategory {
  id: string;
  name: string;
}

interface MoneyRecord {
  id: string;
  type: 'TRANSFER' | 'EXPENSE';
  date: string;
  description: string | null;
  amount: number;
  category: RecordCategory | null;
  accountName: string;
  status: string;
  direction: 'IN' | 'OUT';
}

interface RecordsResponse {
  records: MoneyRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 25;

export const HistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<MoneyRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [accountId, setAccountId] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('UNCATEGORIZED');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const filtersActive = useMemo(() => {
    return Boolean(
      debouncedSearch ||
      startDate ||
      endDate ||
      categoryId !== 'ALL' ||
      accountId !== 'ALL' ||
      type !== 'ALL' ||
      minAmount ||
      maxAmount
    );
  }, [accountId, categoryId, debouncedSearch, endDate, maxAmount, minAmount, startDate, type]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (categoryId !== 'ALL') params.set('categoryId', categoryId);
    if (accountId !== 'ALL') params.set('accountId', accountId);
    if (type !== 'ALL') params.set('type', type);
    if (minAmount) params.set('minAmount', minAmount);
    if (maxAmount) params.set('maxAmount', maxAmount);
    return params;
  }, [accountId, categoryId, debouncedSearch, endDate, maxAmount, minAmount, startDate, type]);

  const loadLookups = async () => {
    const [accountData, categoryData] = await Promise.all([
      apiClient<Account[]>('/accounts'),
      apiClient<Category[]>('/categories')
    ]);
    setAccounts(accountData);
    setCategories(categoryData);
  };

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(queryParams);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      const data = await apiClient<RecordsResponse>(`/records?${params.toString()}`);
      setRecords(data.records);
      setTotalPages(Math.max(1, data.pagination.totalPages));
    } catch (err: any) {
      setError(err.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups().catch((err) => setError(err.message || 'Failed to load filters.'));
  }, []);

  useEffect(() => {
    loadRecords();
  }, [queryParams, page]);

  const resetFilters = () => {
    setSearchText('');
    setDebouncedSearch('');
    setStartDate('');
    setEndDate('');
    setCategoryId('ALL');
    setAccountId('ALL');
    setType('ALL');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const startTransactionEdit = (record: MoneyRecord) => {
    setEditingId(record.id);
    setEditDescription(record.description || '');
    setEditCategoryId(record.category?.id || 'UNCATEGORIZED');
    setEditError(null);
  };

  const saveTransactionEdit = async () => {
    if (!editingId) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      await apiClient(`/transactions/${editingId}/categorize`, {
        method: 'PATCH',
        bodyData: {
          description: editDescription.trim() || null,
          categoryId: editCategoryId === 'UNCATEGORIZED' ? null : editCategoryId
        }
      });
      setEditingId(null);
      await loadRecords();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update transaction.');
    } finally {
      setSavingEdit(false);
    }
  };

  const exportRecords = async (format: 'csv' | 'pdf', includeFilters: boolean) => {
    const key = `${includeFilters ? 'filtered' : 'all'}-${format}`;
    setExporting(key);
    setError(null);
    try {
      const params = new URLSearchParams(includeFilters ? queryParams : undefined);
      params.set('format', format);
      const token = localStorage.getItem('unlockd_auth_token');
      const response = await fetch(`http://localhost:3000/records/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Export failed.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = includeFilters ? `filtered-history.${format}` : `full-history.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const renderFilters = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-start-date">Start Date</Label>
        <Input id="history-start-date" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-end-date">End Date</Label>
        <Input id="history-end-date" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Account</Label>
        <Select value={accountId} onValueChange={(value) => { setAccountId(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="All accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Accounts</SelectItem>
            {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="All movement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="TRANSFER">Transfers</SelectItem>
            <SelectItem value="EXPENSE">Expenses</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-min-amount">Min Amount</Label>
        <Input id="history-min-amount" type="number" min="0" step="0.01" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); setPage(1); }} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="history-max-amount">Max Amount</Label>
        <Input id="history-max-amount" type="number" min="0" step="0.01" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }} />
      </div>
      <div className="flex items-end">
        <Button type="button" variant="outline" className="w-full gap-2" onClick={resetFilters}>
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 w-full max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
          <p className="text-sm text-text-secondary mt-1">Unified transfer and expense history</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filtersActive ? (
            <>
              <Button variant="secondary" className="gap-2" onClick={() => exportRecords('csv', true)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> Filtered CSV
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => exportRecords('pdf', true)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> Filtered PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => exportRecords('csv', false)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> All CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => exportRecords('pdf', false)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> All PDF
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="gap-2" onClick={() => exportRecords('csv', false)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => exportRecords('pdf', false)} disabled={!!exporting}>
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <div className="p-3 rounded border border-danger bg-danger/10 text-danger text-sm">{error}</div>}

      <Card className="p-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search descriptions"
              className="pl-10"
            />
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="lg:hidden gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filters</DialogTitle>
              </DialogHeader>
              {renderFilters()}
            </DialogContent>
          </Dialog>
        </div>

        <div className="hidden lg:block">
          {renderFilters()}
        </div>
      </Card>

      {loading ? (
        <div className="py-14 text-center text-text-secondary text-sm border border-border rounded bg-surface">Loading history...</div>
      ) : records.length === 0 ? (
        <div className="py-14 text-center border border-border rounded bg-surface">
          <div className="text-text-primary font-semibold">No records found</div>
          <div className="text-text-secondary text-sm mt-1">Try adjusting filters or export all history.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((record) => {
            const isOut = record.direction === 'OUT';
            const amountPrefix = isOut ? '-' : '+';
            const typeClass = record.type === 'TRANSFER' ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning';

            return (
              <Card key={`${record.type}-${record.id}`} className="p-4 bg-surface flex flex-col md:grid md:grid-cols-[120px_1fr_140px_96px] gap-3 md:items-center">
                <div className="flex md:flex-col items-center md:items-start gap-2">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded ${typeClass}`}>{record.type}</span>
                  <span className="text-xs text-text-secondary">{new Date(record.date).toLocaleDateString()}</span>
                </div>

                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">
                    {record.description || <span className="italic text-text-secondary">No description</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-text-secondary">
                    {record.category && <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border">{record.category.name}</span>}
                    <span className="truncate">{record.accountName}</span>
                  </div>
                </div>

                <div className={`font-mono text-sm font-semibold md:text-right ${isOut ? 'text-danger' : 'text-success'}`}>
                  {amountPrefix}Rs {record.amount.toFixed(2)}
                </div>

                <div className="flex md:justify-end items-center gap-2">
                  <span className="text-[10px] px-2 py-1 rounded bg-surface-elevated border border-border text-text-secondary">{record.status}</span>
                  {record.type === 'TRANSFER' ? (
                    <Button type="button" size="icon" variant="ghost" title="Edit transaction details" onClick={() => startTransactionEdit(record)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button asChild type="button" size="sm" variant="outline" className="text-xs">
                      <Link to="/">Edit</Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
        <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
        <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</Button>
      </div>

      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {editError && <div className="p-3 rounded border border-danger bg-danger/10 text-danger text-sm">{editError}</div>}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transaction-edit-description">Description</Label>
              <Input id="transaction-edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={savingEdit} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={editCategoryId} onValueChange={setEditCategoryId} disabled={savingEdit}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNCATEGORIZED">Uncategorized</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
              <Button onClick={saveTransactionEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
