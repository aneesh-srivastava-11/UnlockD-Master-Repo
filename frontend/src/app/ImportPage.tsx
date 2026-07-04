import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileUp, RefreshCcw, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PageHeader, PageShell, StateBlock } from './shared';
import { Skeleton } from '../components/ui/skeleton';
import { FullPageError } from '../components/ErrorDisplay';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
  balance: string;
}

interface Category {
  id: string;
  name: string;
}

interface ImportedTransaction {
  id: string;
  accountId: string;
  rawDescription: string;
  merchant: string | null;
  amount: string | number;
  date: string;
  suggestedCategoryId: string | null;
  isRecurring: boolean;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  account?: { id: string; name: string; balance?: string };
  suggestedCategory?: Category | null;
}

interface ParseSummary {
  message: string;
  linesProcessed: number;
  transactionsExtracted: number;
  skipped: number;
}

type RowResult = { success: boolean; error?: string };

const toDateInput = (value: string | null | undefined) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};

export const ImportPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imports, setImports] = useState<ImportedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowResults, setRowResults] = useState<Record<string, RowResult>>({});

  const pendingIds = useMemo(() => imports.map((item) => item.id), [imports]);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  const loadLookups = async () => {
    const [accountData, categoryData] = await Promise.all([
      apiClient<Account[]>('/accounts'),
      apiClient<Category[]>('/categories')
    ]);
    setAccounts(accountData);
    setCategories(categoryData);
    if (!selectedAccountId && accountData.length > 0) {
      setSelectedAccountId(accountData[0].id);
    }
  };

  const loadImports = async () => {
    const data = await apiClient<ImportedTransaction[]>('/imports');
    setImports(data);
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadLookups(), loadImports()]);
    } catch (err: any) {
      setError(err.message || 'Failed to load imports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateLocalImport = (id: string, patch: Partial<ImportedTransaction>) => {
    setImports((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const getRowAccount = (item: ImportedTransaction) => {
    return accounts.find((account) => account.id === item.accountId);
  };

  const getRowBalance = (item: ImportedTransaction) => {
    return Number(item.account?.balance || getRowAccount(item)?.balance || 0);
  };

  const uploadStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSummary(null);

    if (!selectedAccountId) {
      setError('Please select an account.');
      toast.error('Please select an account.');
      return;
    }
    if (!file) {
      setError('Please choose a CSV or PDF statement.');
      toast.error('Please choose a CSV or PDF statement.');
      return;
    }

    const formData = new FormData();
    formData.set('accountId', selectedAccountId);
    formData.set('file', file);

    setUploading(true);
    try {
      const token = localStorage.getItem('unlockd_auth_token');
      const response = await fetch('http://localhost:3000/imports/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Upload failed.');
      }

      setSummary(data.summary);
      setFile(null);
      toast.success('Bank statement uploaded and parsed successfully.');
      await loadImports();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
      toast.error(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const saveRow = async (item: ImportedTransaction) => {
    const amount = Number(item.amount);
    if (!item.suggestedCategoryId) {
      throw new Error('Choose a category before confirming.');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    await apiClient(`/imports/${item.id}`, {
      method: 'PATCH',
      bodyData: {
        merchant: item.merchant || null,
        amount,
        date: toDateInput(item.date),
        categoryId: item.suggestedCategoryId,
        accountId: item.accountId
      }
    });
  };

  const confirmRow = async (item: ImportedTransaction) => {
    setRowResults((current) => ({ ...current, [item.id]: { success: false } }));
    try {
      await saveRow(item);
      await apiClient(`/imports/${item.id}/confirm`, { method: 'POST' });
      setRowResults((current) => ({ ...current, [item.id]: { success: true } }));
      toast.success('Staged transaction confirmed successfully.');
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      await Promise.all([loadLookups(), loadImports()]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm transaction.');
      setRowResults((current) => ({ ...current, [item.id]: { success: false, error: err.message || 'Confirm failed.' } }));
    }
  };

  const rejectRow = async (id: string) => {
    try {
      await apiClient(`/imports/${id}/reject`, { method: 'POST' });
      setRowResults((current) => ({ ...current, [id]: { success: true } }));
      toast.success('Staged transaction rejected.');
      await loadImports();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject transaction.');
      setRowResults((current) => ({ ...current, [id]: { success: false, error: err.message || 'Reject failed.' } }));
    }
  };

  const bulkConfirm = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const invalid = imports.find((item) => selectedIds.has(item.id) && !item.suggestedCategoryId);
    if (invalid) {
      setError('Every selected row needs a category before bulk confirm.');
      toast.error('Every selected row needs a category before bulk confirm.');
      return;
    }

    setBulkSaving(true);
    setError(null);
    const nextResults: Record<string, RowResult> = {};

    let successCount = 0;
    let failCount = 0;

    for (const item of imports.filter((entry) => selectedIds.has(entry.id))) {
      try {
        await saveRow(item);
        await apiClient(`/imports/${item.id}/confirm`, { method: 'POST' });
        nextResults[item.id] = { success: true };
        successCount++;
      } catch (err: any) {
        nextResults[item.id] = { success: false, error: err.message || 'Confirm failed.' };
        failCount++;
      }
    }

    setRowResults((current) => ({ ...current, ...nextResults }));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (nextResults[id]?.success) {
          next.delete(id);
        }
      }
      return next;
    });

    setBulkSaving(false);

    if (successCount > 0) {
      toast.success(`Successfully confirmed ${successCount} transactions.`);
    }
    if (failCount > 0) {
      toast.error(`Failed to confirm ${failCount} transactions.`);
    }

    await Promise.all([loadLookups(), loadImports()]);
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(pendingIds));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Statement Import"
        description="Stage bank statement rows for review before creating expenses."
        actions={
          <Button variant="outline" className="gap-2" onClick={refresh}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <FullPageError title="Failed to Load Imports" description={error} onRetry={refresh} />}
      {summary && (
        <div className="p-3 rounded border border-success bg-success/10 text-success text-sm">
          {summary.message}
        </div>
      )}

      <Card className="p-5">
        <form onSubmit={uploadStatement} className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label>Statement Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statement-file">CSV or PDF Statement</Label>
            <Input id="statement-file" type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <Button type="submit" disabled={uploading || !selectedAccountId} className="gap-2">
            <FileUp className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </Card>

      <Card className="p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-lg font-semibold">Pending Review</h2>
            <p className="text-sm text-text-secondary">{imports.length} staged rows waiting for review</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleAll} disabled={imports.length === 0}>
              {allSelected ? 'Clear Selection' : 'Select All'}
            </Button>
            <Button type="button" onClick={bulkConfirm} disabled={selectedIds.size === 0 || bulkSaving}>
              {bulkSaving ? 'Confirming...' : `Bulk Confirm (${selectedIds.size})`}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-[96px] w-full rounded-lg animate-pulse" />
            <Skeleton className="h-[96px] w-full rounded-lg animate-pulse" />
            <Skeleton className="h-[96px] w-full rounded-lg animate-pulse" />
          </div>
        ) : imports.length === 0 ? (
          <StateBlock 
            title="No pending imports" 
            description="Importing statements lets you parse transactions from your bank statements to review, categorize, and confirm them as real expenses in bulk." 
          />
        ) : (
          <div className="flex flex-col gap-3">
            {imports.map((item) => {
              const result = rowResults[item.id];
              const rowAccount = getRowAccount(item);
              const rowBalance = getRowBalance(item);
              const rowAmount = Number(item.amount);
              const isOverBalance = Number.isFinite(rowAmount) && rowAmount > rowBalance;
              return (
                <Card key={item.id} className="p-4 bg-background flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-[32px_150px_minmax(160px,220px)_minmax(220px,1fr)] gap-3 md:items-start">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="h-5 w-5 md:mt-3"
                      aria-label="Select row"
                    />

                    <Input
                      type="date"
                      value={toDateInput(item.date)}
                      onChange={(e) => updateLocalImport(item.id, { date: e.target.value })}
                    />

                    <div className="flex flex-col gap-1">
                      <Select value={item.accountId} onValueChange={(value) => updateLocalImport(item.id, { accountId: value, account: accounts.find((account) => account.id === value) })}>
                        <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className={`text-[11px] font-mono break-words ${isOverBalance ? 'text-danger' : 'text-text-secondary'}`}>
                        {rowAccount?.name || 'Selected account'} balance Rs {rowBalance.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 min-w-0">
                    <Input
                      value={item.merchant || ''}
                      onChange={(e) => updateLocalImport(item.id, { merchant: e.target.value })}
                      placeholder={item.rawDescription}
                    />
                    <div className="flex gap-2 text-xs text-text-secondary">
                      <span className="truncate">{item.rawDescription}</span>
                      {item.isRecurring && <span className="shrink-0 px-2 py-0.5 rounded bg-warning/10 text-warning">Recurring</span>}
                    </div>
                  </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(180px,240px)_minmax(190px,auto)] gap-3 sm:items-start">
                    <Input
                      type="number"
                      step="0.01"
                      value={String(item.amount)}
                      onChange={(e) => updateLocalImport(item.id, { amount: e.target.value })}
                      className="font-mono"
                    />

                    <Select value={item.suggestedCategoryId || 'NONE'} onValueChange={(value) => updateLocalImport(item.id, { suggestedCategoryId: value === 'NONE' ? null : value })}>
                      <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Choose Category</SelectItem>
                        {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button size="sm" className="gap-1 flex-1" onClick={() => confirmRow(item)}>
                        <Check className="h-4 w-4" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => rejectRow(item.id)}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                    {result && (
                      <span className={`text-xs ${result.success ? 'text-success' : 'text-danger'}`}>
                        {result.success ? (
                          <Link to={`/history?q=${encodeURIComponent(item.merchant || item.rawDescription)}`} className="text-success underline-offset-4 hover:underline">
                            Applied - view in History
                          </Link>
                        ) : result.error}
                      </span>
                    )}
                  </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </PageShell>
  );
};

export default ImportPage;
