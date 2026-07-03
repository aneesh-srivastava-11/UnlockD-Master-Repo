import React from 'react';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';

export interface BudgetUtilization {
  id: string;
  categoryId: string;
  categoryName: string;
  monthlyLimit: string;
  spent: string;
  remaining: string;
  percentUsed: number;
}

interface BudgetsPanelProps {
  budgets: BudgetUtilization[];
  loading: boolean;
  onRefresh: () => void;
}

export const BudgetsPanel: React.FC<BudgetsPanelProps> = ({ budgets, loading, onRefresh }) => {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
        <h2 className="text-lg font-semibold text-text-primary tracking-tight">Smart Budgets (Current Month)</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onRefresh} 
          title="Refresh budgets"
          className="h-11 w-11 text-text-secondary hover:text-text-primary"
        >
          ↻
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-text-secondary text-sm">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="py-8 text-center text-text-secondary text-sm">
          No budgets configured for this month. 
          Go to Settings to set monthly limits for your categories.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {budgets.map((b) => {
            const spentNum = parseFloat(b.spent);
            const limitNum = parseFloat(b.monthlyLimit);
            const remainingNum = parseFloat(b.remaining);
            const percent = b.percentUsed;

            // Determine bar color and text color class based on budget usage
            let indicatorClass = 'bg-success'; // success (< 80%)
            let textClass = 'text-success';
            if (percent >= 100) {
              indicatorClass = 'bg-danger'; // danger (100%+)
              textClass = 'text-danger';
            } else if (percent >= 80) {
              indicatorClass = 'bg-warning'; // warning (80-99%)
              textClass = 'text-warning';
            }

            return (
              <Card key={b.id} className="p-4 bg-background border-border flex flex-col gap-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-text-primary text-sm">
                    {b.categoryName}
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    ₹{spentNum.toFixed(2)} / ₹{limitNum.toFixed(2)}
                  </span>
                </div>

                <Progress 
                  value={percent} 
                  indicatorClassName={indicatorClass}
                  className="h-2.5 border border-border"
                  aria-label={`${b.categoryName} budget utilization`}
                />

                <div className="flex justify-between text-xs">
                  <span className={`${textClass} font-medium`}>
                    {percent.toFixed(0)}% used
                  </span>
                  <span>
                    {remainingNum >= 0 ? (
                      <span className="text-text-secondary">
                        ₹{remainingNum.toFixed(2)} remaining
                      </span>
                    ) : (
                      <span className="text-danger font-medium">
                        Overdraft by ₹{Math.abs(remainingNum).toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default BudgetsPanel;
