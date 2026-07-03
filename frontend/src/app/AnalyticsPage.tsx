import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface AnalyticsData {
  byCategory: Array<{ category: string; total: number }>;
  byMonth: Array<{ month: string; total: number }>;
  recurringExpenses: Array<{ id: string; merchant: string; amount: number; date: string; category: string }>;
}

const currency = (value: unknown) => `Rs ${Number(value || 0).toFixed(2)}`;

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({ byCategory: [], byMonth: [], recurringExpenses: [] });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Analytics</h1>
          <p className="text-sm text-text-secondary mt-1">Committed expense trends and recurring imported charges.</p>
        </div>
      </div>

      {error && <div className="p-3 rounded border border-danger bg-danger/10 text-danger text-sm">{error}</div>}

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
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
          </div>
          {loading ? (
            <div className="h-[320px] flex items-center justify-center text-text-secondary text-sm">Loading chart...</div>
          ) : data.byCategory.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-text-secondary text-sm">No expenses in this range.</div>
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
            <div className="h-[320px] flex items-center justify-center text-text-secondary text-sm">Loading chart...</div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byMonth} margin={{ left: 8, right: 24 }}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(value) => `Rs ${value}`} />
                  <Tooltip formatter={(value) => currency(value)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="total" stroke="var(--success)" strokeWidth={2} dot={{ fill: 'var(--success)' }} />
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
          <div className="py-8 text-center text-text-secondary text-sm">Loading recurring expenses...</div>
        ) : data.recurringExpenses.length === 0 ? (
          <div className="py-8 text-center text-text-secondary text-sm">No recurring imported expenses confirmed yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.recurringExpenses.map((expense) => (
              <Card key={expense.id} className="p-4 bg-background flex justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{expense.merchant}</div>
                  <div className="text-xs text-text-secondary">{expense.category} / {new Date(expense.date).toLocaleDateString()}</div>
                </div>
                <div className="font-mono text-danger text-sm shrink-0">-Rs {expense.amount.toFixed(2)}</div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AnalyticsPage;
