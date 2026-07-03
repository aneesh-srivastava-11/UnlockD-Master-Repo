import React from 'react';

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
    <div className="panel budgets-panel">
      <div className="panel-header">
        <h2>Smart Budgets (Current Month)</h2>
        <button className="btn-icon" onClick={onRefresh} title="Refresh budgets">
          ↻
        </button>
      </div>

      {loading ? (
        <div className="panel-loading">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="panel-empty">
          No budgets configured for this month. 
          Go to Settings to set monthly limits for your categories.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {budgets.map((b) => {
            const spentNum = parseFloat(b.spent);
            const limitNum = parseFloat(b.monthlyLimit);
            const remainingNum = parseFloat(b.remaining);
            const percent = b.percentUsed;

            // Determine bar color
            let barColor = '#71717a'; // zinc-500 (neutral under 80%)
            if (percent >= 100) {
              barColor = 'var(--error)'; // red-500 (100%+)
            } else if (percent >= 80) {
              barColor = '#f59e0b'; // amber-500 (80-99%)
            }

            // Cap the progress display width to 100%
            const displayPercent = Math.min(percent, 100);

            return (
              <div 
                key={b.id} 
                className="budget-card-item"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '14.5px' }}>
                    {b.categoryName}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text)' }}>
                    ₹{spentNum.toFixed(2)} / ₹{limitNum.toFixed(2)}
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div 
                  style={{
                    height: '8px',
                    borderRadius: '4px',
                    background: 'rgba(39, 39, 42, 0.5)',
                    border: '1px solid var(--border)',
                    overflow: 'hidden'
                  }}
                >
                  <div 
                    style={{
                      height: '100%',
                      width: `${displayPercent}%`,
                      background: barColor,
                      borderRadius: '4px',
                      transition: 'width 0.4s ease-out, background-color 0.2s'
                    }}
                  />
                </div>

                {/* Progress Details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: percent >= 100 ? 'var(--error)' : percent >= 80 ? '#f59e0b' : 'var(--text)' }}>
                    {percent.toFixed(0)}% used
                  </span>
                  <span>
                    {remainingNum >= 0 ? (
                      <span style={{ color: 'var(--text)' }}>
                        ₹{remainingNum.toFixed(2)} remaining
                      </span>
                    ) : (
                      <span style={{ color: 'var(--error)' }}>
                        Overdraft by ₹{Math.abs(remainingNum).toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BudgetsPanel;
