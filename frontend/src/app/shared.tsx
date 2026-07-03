import React from 'react';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/card';

export const PageShell: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('w-full max-w-6xl mx-auto px-4 py-5 sm:px-6 sm:py-6 flex flex-col gap-5 overflow-hidden', className)} {...props} />
);

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold text-text-primary truncate" title={title}>{title}</h1>
      {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);

export const StatusBadge: React.FC<{
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  children: React.ReactNode;
}> = ({ tone = 'default', children }) => {
  const classes = {
    default: 'bg-surface-elevated text-text-secondary border-border',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    accent: 'bg-accent/10 text-accent border-accent/30'
  };
  return <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold font-mono', classes[tone])}>{children}</span>;
};

export const StateBlock: React.FC<{
  type?: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ type = 'empty', title, description, action }) => (
  <div className={cn(
    'rounded border bg-surface p-6 text-center',
    type === 'error' ? 'border-danger text-danger' : 'border-border text-text-secondary'
  )}>
    <div className={cn('text-sm font-semibold', type === 'error' ? 'text-danger' : 'text-text-primary')}>{title}</div>
    {description && <div className="text-sm mt-1 text-text-secondary">{description}</div>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ label, value, detail }) => (
  <Card className="p-4 bg-surface min-w-0">
    <div className="text-xs font-semibold uppercase tracking-normal text-text-secondary">{label}</div>
    <div className="mt-2 text-xl font-semibold text-text-primary font-mono truncate">{value}</div>
    {detail && <div className="mt-1 text-xs text-text-secondary truncate">{detail}</div>}
  </Card>
);
