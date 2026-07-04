import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader, PageShell, StateBlock } from './shared';
import { Skeleton } from '../components/ui/skeleton';
import { FullPageError } from '../components/ErrorDisplay';

interface AnalyticsData {
  byCategory: Array<{ category: string; total: number }>;
  byMonth: Array<{ month: string; total: number }>;
  recurringExpenses: Array<{ id: string; merchant: string; amount: number; date: string; category: string }>;
}

const currency = (value: unknown) => `Rs ${Number(value || 0).toFixed(2)}`;

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({ byCategory: [], byMonth: [], recurringExpenses: [] });
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getStartOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };
  const [startDate, setStartDate] = useState(getStartOfMonthStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiClient<AnalyticsData>(`/analytics/spending${suffix}`);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <PageShell>
      <PageHeader title="Analytics" description="Committed expense trends and recurring imported charges." />

      {error && <StateBlock type="error" title="Analytics error" description={error} />}

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-start">Category Range Start</Label>
            <Input id="analytics-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-end">Category Range End</Label>
            <Input id="analytics-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={loadAnalytics}>Apply</Button>
        </div>
      </Card>      {error && <FullPageError title="Failed to Load Analytics" description={error} onRetry={loadAnalytics} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3 h-[320px] justify-center">
              <Skeleton className="h-6 w-3/4 rounded animate-pulse" />
              <Skeleton className="h-6 w-1/2 rounded animate-pulse" />
              <Skeleton className="h-6 w-5/8 rounded animate-pulse" />
            </div>
          ) : data.byCategory.length === 0 ? (
            <StateBlock 
              title="No expenses in this range" 
              description="Log personal expenses or confirm imports to see category spending breakdowns."
            />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tickFormatter={(value) => `Rs ${value}`} />
                  <YAxis dataKey="category" type="category" stroke="var(--text-secondary)" width={96} />
                  <Tooltip formatter={(value) => currency(value)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="total" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-semibold">Monthly Spend Trend</h2>
          </div>
          {loading ? (
            <div className="h-[320px] flex items-end justify-between gap-2 border-b border-border/40 pb-4">
              <Skeleton className="h-[40%] w-[12%] rounded-t animate-pulse" />
              <Skeleton className="h-[65%] w-[12%] rounded-t animate-pulse" />
              <Skeleton className="h-[50%] w-[12%] rounded-t animate-pulse" />
              <Skeleton className="h-[80%] w-[12%] rounded-t animate-pulse" />
              <Skeleton className="h-[35%] w-[12%] rounded-t animate-pulse" />
              <Skeleton className="h-[90%] w-[12%] rounded-t animate-pulse" />
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byMonth} margin={{ left: 8, right: 24 }}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(value) => `Rs ${value}`} />
                  <Tooltip formatter={(value) => currency(value)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="border-b border-border pb-3 mb-4">
          <h2 className="text-lg font-semibold">Recurring Expenses</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-[68px] w-full rounded-lg animate-pulse" />
            <Skeleton className="h-[68px] w-full rounded-lg animate-pulse" />
          </div>
        ) : data.recurringExpenses.length === 0 ? (
          <StateBlock 
            title="No recurring imported expenses confirmed yet" 
            description="Recurring expenses are detected automatically from your import cadence (2+ occurrences of similar amounts and merchants)."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recurringExpenses.map((expense) => (
              <Link key={expense.id} to={`/history?q=${encodeURIComponent(expense.merchant)}`} className="rounded-lg border border-border bg-background p-4 flex justify-between gap-4 hover:border-text-secondary/40 transition-colors min-w-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{expense.merchant}</div>
                  <div className="text-xs text-text-secondary">{expense.category} / {new Date(expense.date).toLocaleDateString()}</div>
                </div>
                <div className="font-mono text-danger text-sm shrink-0">-Rs {expense.amount.toFixed(2)}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
};

export default AnalyticsPage;
