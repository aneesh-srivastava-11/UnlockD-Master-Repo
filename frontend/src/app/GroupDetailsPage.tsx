import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface GroupMember {
  userId: string;
  user: {
    email: string;
  };
}

interface ExpenseSplit {
  userId: string;
  shareAmount: string;
  user: {
    email: string;
  };
}

interface GroupExpense {
  id: string;
  description: string;
  amount: string;
  createdAt: string;
  paidByUserId: string;
  paidBy: {
    email: string;
  };
  splits: ExpenseSplit[];
}

interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  status: 'PENDING' | 'COMPLETED';
  transactionId: string | null;
  fromUser: {
    email: string;
  };
  toUser: {
    email: string;
  };
}

interface GroupDetails {
  id: string;
  name: string;
  createdBy: string;
  isSettled: boolean;
  createdAt: string;
  members: GroupMember[];
  expenses: GroupExpense[];
  settlements: Settlement[];
}

interface UserAccount {
  id: string;
  name: string;
  balance: string;
}

interface Category {
  id: string;
  name: string;
}

export const GroupDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member State
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Add Expense State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [paidByUserId, setPaidByUserId] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [addExpenseLoading, setAddExpenseLoading] = useState(false);
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null);

  // Settle & Recalculate State
  const [settleLoading, setSettleLoading] = useState(false);

  // Pay Settlement Dialog State
  const [activePaySettlement, setActivePaySettlement] = useState<Settlement | null>(null);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [selectedPayAccountId, setSelectedPayAccountId] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  // Auto Prompt Modal for Creator Share
  const [creatorPromptOpen, setCreatorPromptOpen] = useState(false);
  const [creatorShareToLog, setCreatorShareToLog] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logCategoryId, setLogCategoryId] = useState('');
  const [logAccountId, setLogAccountId] = useState('');
  const [loggingExpense, setLoggingExpense] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const fetchGroupDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<GroupDetails>(`/groups/${id}`);
      setGroup(data);
      if (data.members.length > 0 && !paidByUserId) {
        setPaidByUserId(data.members[0].userId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAccounts = async () => {
    try {
      const data = await apiClient<UserAccount[]>('/accounts');
      setUserAccounts(data);
      if (data.length > 0) {
        setSelectedPayAccountId(data[0].id);
        setLogAccountId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts for payments', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiClient<Category[]>('/categories');
      setCategories(data);
      if (data.length > 0) {
        setLogCategoryId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
    fetchUserAccounts();
    fetchCategories();
  }, [id]);

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError(null);
    if (!newMemberEmail.trim()) {
      setAddMemberError('Email is required.');
      return;
    }

    setAddMemberLoading(true);
    try {
      await apiClient(`/groups/${id}/members`, {
        method: 'POST',
        bodyData: { email: newMemberEmail.trim() }
      });
      setNewMemberEmail('');
      await fetchGroupDetails();
    } catch (err: any) {
      setAddMemberError(err.message || 'Failed to add member.');
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Real-time custom shares sum check
  const getCustomSum = (): number => {
    let sum = 0;
    if (!group) return 0;
    group.members.forEach(m => {
      const val = parseFloat(customShares[m.userId] || '0');
      if (!isNaN(val)) sum += val;
    });
    return sum;
  };

  const totalExpenseNum = parseFloat(expenseAmount) || 0;
  const isCustomSumValid = splitType === 'equal' || Math.abs(getCustomSum() - totalExpenseNum) < 0.011;

  // Handle Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddExpenseError(null);

    if (!expenseDesc.trim()) {
      setAddExpenseError('Description is required.');
      return;
    }

    if (totalExpenseNum <= 0) {
      setAddExpenseError('Amount must be positive.');
      return;
    }

    setAddExpenseLoading(true);
    try {
      const splitsPayload = group!.members.map(m => ({
        userId: m.userId,
        shareAmount: splitType === 'custom' ? parseFloat(customShares[m.userId] || '0') : undefined
      }));

      await apiClient(`/groups/${id}/expenses`, {
        method: 'POST',
        bodyData: {
          description: expenseDesc.trim(),
          amount: totalExpenseNum,
          paidByUserId,
          splitType,
          splits: splitsPayload
        }
      });

      setExpenseDesc('');
      setExpenseAmount('');
      setCustomShares({});
      await fetchGroupDetails();
    } catch (err: any) {
      setAddExpenseError(err.message || 'Failed to record expense.');
    } finally {
      setAddExpenseLoading(false);
    }
  };

  // Creator Settle Up Netting Trigger
  const handleSettleUp = async () => {
    setSettleLoading(true);
    try {
      await apiClient(`/groups/${id}/settle`, { method: 'POST' });
      await fetchGroupDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to calculate settlements.');
    } finally {
      setSettleLoading(false);
    }
  };

  // Open pay modal
  const openPayDialog = (settlement: Settlement) => {
    setActivePaySettlement(settlement);
    setPayError(null);
  };

  // Submit Settlement Payment
  const handlePaySettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaySettlement) return;
    setPayError(null);
    setPayLoading(true);

    try {
      const response = await apiClient<{
        message: string;
        settlement: any;
        groupFullySettled: boolean;
        creatorUserId?: string;
        creatorShareAmount?: number;
      }>(`/settlements/${activePaySettlement.id}/pay`, {
        method: 'POST',
        bodyData: { accountId: selectedPayAccountId }
      });

      setActivePaySettlement(null);
      await fetchGroupDetails();
      await fetchUserAccounts(); // Refresh sender balance

      // Trigger creator share logging prompt if fully settled and caller is creator
      if (response.groupFullySettled && response.creatorUserId === currentUser?.id) {
        setCreatorShareToLog(response.creatorShareAmount || 0);
        setCreatorPromptOpen(true);
      }
    } catch (err: any) {
      setPayError(err.message || 'Failed to complete payment.');
    } finally {
      setPayLoading(false);
    }
  };

  // Creator logs their own share as personal Expense
  const handleLogCreatorExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError(null);
    setLoggingExpense(true);

    try {
      await apiClient('/expenses', {
        method: 'POST',
        bodyData: {
          accountId: logAccountId,
          categoryId: logCategoryId,
          amount: creatorShareToLog,
          description: `Group Share: ${group?.name || 'Group'}`
        }
      });
      setCreatorPromptOpen(false);
    } catch (err: any) {
      setLogError(err.message || 'Failed to log personal expense.');
    } finally {
      setLoggingExpense(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-text-secondary text-sm">Loading group details...</div>;
  }

  if (error || !group) {
    return (
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="p-4 rounded bg-danger/10 border border-danger text-danger text-sm mb-4">{error || 'Group not found'}</div>
        <Link to="/groups" className="text-accent underline text-sm">Back to Groups</Link>
      </div>
    );
  }

  const isCreator = group.createdBy === currentUser?.id;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">{group.name}</h1>
            {group.isSettled ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-success/15 text-success font-mono">
                SETTLED
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-warning/15 text-warning font-mono">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1">Created on {new Date(group.createdAt).toLocaleDateString()}</p>
        </div>
        <Link to="/groups" className="text-accent underline text-sm self-start sm:self-auto">
          Back to Groups
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left Column: Members list & Actions */}
        <div className="flex flex-col gap-6 w-full">
          {/* Members list */}
          <Card className="p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Group Members</h2>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {group.members.map(m => (
                <div key={m.userId} className="flex justify-between items-center text-xs p-2.5 rounded border border-border bg-background">
                  <span className="text-text-primary truncate">{m.user.email}</span>
                  {m.userId === group.createdBy && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono shrink-0">
                      CREATOR
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add Member form */}
            {!group.isSettled && (
              <form onSubmit={handleAddMember} className="border-t border-border pt-3 mt-1 flex flex-col gap-2.5">
                <Label htmlFor="add-member-email-input" className="text-xs font-semibold">Add Member by Email</Label>
                {addMemberError && <div className="text-[11px] text-danger p-2 bg-danger/10 border border-danger rounded">{addMemberError}</div>}
                <div className="flex gap-2">
                  <Input 
                    id="add-member-email-input"
                    type="email" 
                    placeholder="friend@email.com" 
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    disabled={addMemberLoading}
                    className="h-10 text-xs flex-grow"
                  />
                  <Button type="submit" disabled={addMemberLoading} className="h-10 min-h-0 text-xs shrink-0">
                    {addMemberLoading ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Settle Up card */}
          {isCreator && !group.isSettled && group.settlements.length === 0 && (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-text-primary">Creator Settlement Control</h2>
              <p className="text-xs text-text-secondary">Click Settle Up to net balances and generate settlements.</p>
              <Button onClick={handleSettleUp} disabled={settleLoading} className="w-full mt-1.5 h-11">
                {settleLoading ? 'Calculating Net Flow...' : 'Settle Up'}
              </Button>
            </Card>
          )}
        </div>

        {/* Right Column: Add Expense & Settlement & Log */}
        <div className="flex flex-col gap-6 w-full">
          {/* Settlements obligations display */}
          {group.settlements.length > 0 && (
            <Card className="p-6">
              <div className="border-b border-border pb-3 mb-4">
                <h2 className="text-lg font-semibold text-text-primary tracking-tight">Settlement Actions</h2>
              </div>
              
              <div className="flex flex-col gap-3">
                {group.settlements.map((settlement) => {
                  const isDebtor = settlement.fromUserId === currentUser?.id;
                  const statusBadgeClass = settlement.status === 'COMPLETED' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning';
                  
                  return (
                    <Card key={settlement.id} className="p-4 bg-background border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${statusBadgeClass}`}>
                            {settlement.status}
                          </span>
                          <span className="font-semibold text-sm text-text-primary">
                            {settlement.fromUser.email} pays {settlement.toUser.email}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-text-secondary mt-1">
                          Amount: ₹{parseFloat(settlement.amount).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex-shrink-0 self-end sm:self-auto">
                        {settlement.status === 'PENDING' && isDebtor ? (
                          <Button onClick={() => openPayDialog(settlement)} size="sm" className="h-10 min-h-0 text-xs px-3">
                            Pay Settlement
                          </Button>
                        ) : settlement.status === 'COMPLETED' ? (
                          <span className="text-[11px] text-text-secondary font-mono">
                            Paid via Tx: {settlement.transactionId?.substring(0, 8)}...
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Add Expense Form */}
          {!group.isSettled && group.settlements.length === 0 && (
            <Card className="p-6">
              <div className="border-b border-border pb-3 mb-4">
                <h2 className="text-lg font-semibold text-text-primary tracking-tight">Log Expense</h2>
              </div>

              <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
                {addExpenseError && (
                  <div className="p-3 text-xs rounded bg-danger/10 border border-danger text-danger">
                    {addExpenseError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="expense-desc">Description</Label>
                    <Input 
                      id="expense-desc"
                      placeholder="e.g. Dinner, Cab Fare"
                      value={expenseDesc}
                      onChange={e => setExpenseDesc(e.target.value)}
                      disabled={addExpenseLoading}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="expense-amount-val">Total Amount (₹)</Label>
                    <Input 
                      id="expense-amount-val"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      disabled={addExpenseLoading}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="paid-by-select">Paid By</Label>
                    <Select value={paidByUserId} onValueChange={setPaidByUserId} disabled={addExpenseLoading}>
                      <SelectTrigger id="paid-by-select">
                        <SelectValue placeholder="Select member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {group.members.map(m => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Split Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={splitType === 'equal' ? 'default' : 'outline'}
                        onClick={() => setSplitType('equal')}
                        className="flex-1 h-11"
                        disabled={addExpenseLoading}
                      >
                        Split Equally
                      </Button>
                      <Button
                        type="button"
                        variant={splitType === 'custom' ? 'default' : 'outline'}
                        onClick={() => setSplitType('custom')}
                        className="flex-1 h-11"
                        disabled={addExpenseLoading}
                      >
                        Custom Split
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Custom Split Inputs */}
                {splitType === 'custom' && (
                  <div className="border-t border-border pt-4 mt-2 flex flex-col gap-3">
                    <Label className="text-xs font-semibold text-text-primary">Custom Shares (₹)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.members.map(m => (
                        <div key={m.userId} className="flex items-center justify-between gap-4 p-2.5 rounded border border-border bg-background">
                          <span className="text-xs text-text-secondary truncate flex-grow">{m.user.email}</span>
                          <div className="relative flex items-center shrink-0 w-32">
                            <span className="absolute left-2.5 text-[11px] text-text-secondary font-mono">₹</span>
                            <Input 
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={customShares[m.userId] || ''}
                              onChange={e => setCustomShares(prev => ({ ...prev, [m.userId]: e.target.value }))}
                              disabled={addExpenseLoading}
                              className="pl-6 h-9 text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-baseline text-xs font-semibold mt-1">
                      <span className={isCustomSumValid ? 'text-success' : 'text-danger'}>
                        Sum of Shares: ₹{getCustomSum().toFixed(2)}
                      </span>
                      <span className="text-text-secondary">
                        Target: ₹{totalExpenseNum.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={addExpenseLoading || !isCustomSumValid || totalExpenseNum <= 0}
                  className="w-full sm:w-auto self-start mt-2 h-11"
                >
                  {addExpenseLoading ? 'Logging...' : 'Log Expense'}
                </Button>
              </form>
            </Card>
          )}

          {/* Expenses Log */}
          <Card className="p-6">
            <div className="border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-semibold text-text-primary tracking-tight">Expenses Log</h2>
            </div>

            {group.expenses.length === 0 ? (
              <div className="py-8 text-center text-text-secondary text-sm">No shared expenses logged yet.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {group.expenses.map((expense) => (
                  <Card key={expense.id} className="p-4 bg-background border-border flex flex-col gap-3">
                    <div className="flex justify-between items-baseline gap-4">
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary text-sm block truncate">{expense.description}</span>
                        <span className="text-[11px] text-text-secondary block">
                          Paid by: {expense.paidBy.email}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-text-primary shrink-0">
                        ₹{parseFloat(expense.amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="text-[11px] border-t border-border/60 pt-2 flex flex-col gap-1.5">
                      <span className="text-text-secondary font-medium">Split Breakdown:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[10px]">
                        {expense.splits.map(split => (
                          <div key={split.userId} className="flex justify-between p-1 bg-surface-elevated rounded border border-border/30">
                            <span className="truncate max-w-[170px]">{split.user.email}</span>
                            <span className="shrink-0">₹{parseFloat(split.shareAmount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Pay Settlement Account Picker Dialog */}
      <Dialog open={activePaySettlement !== null} onOpenChange={(open) => { if (!open) setActivePaySettlement(null); }}>
        <DialogContent>
          {activePaySettlement && (
            <form onSubmit={handlePaySettlement}>
              <DialogHeader className="mb-4">
                <DialogTitle>Pay Settlement</DialogTitle>
                <DialogDescription>
                  Send ₹{parseFloat(activePaySettlement.amount).toFixed(2)} to {activePaySettlement.toUser.email} using your primary wallet account.
                </DialogDescription>
              </DialogHeader>

              {payError && (
                <div className="p-3 text-xs rounded bg-danger/10 border border-danger text-danger mb-4">
                  {payError}
                </div>
              )}

              <div className="flex flex-col gap-1.5 mb-6">
                <Label htmlFor="pay-account-picker">Select Account to Pay From</Label>
                <Select value={selectedPayAccountId} onValueChange={setSelectedPayAccountId} disabled={payLoading}>
                  <SelectTrigger id="pay-account-picker">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} (₹{parseFloat(acc.balance).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setActivePaySettlement(null)}
                  disabled={payLoading}
                  className="max-sm:w-full"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={payLoading || userAccounts.length === 0}
                  className="max-sm:w-full"
                >
                  {payLoading ? 'Authorizing secure transfer...' : 'Confirm Payment'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Group Fully Settled Creator share log Modal */}
      <Dialog 
        open={creatorPromptOpen} 
        onOpenChange={() => {}} // Empty onOpenChange to enforce user action
      >
        <DialogContent 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <form onSubmit={handleLogCreatorExpense}>
            <DialogHeader className="mb-4">
              <DialogTitle>Log Your Share of Expenses</DialogTitle>
              <DialogDescription>
                This group is fully settled! As the creator, you paid the total sum externally. 
                Please log your own personal share of ₹{creatorShareToLog.toFixed(2)} as a personal Expense to keep your dashboard reports accurate.
              </DialogDescription>
            </DialogHeader>

            {logError && (
              <div className="p-3 text-xs rounded bg-danger/10 border border-danger text-danger mb-4">
                {logError}
              </div>
            )}

            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="creator-log-account">Select Source Account</Label>
                <Select value={logAccountId} onValueChange={setLogAccountId} disabled={loggingExpense}>
                  <SelectTrigger id="creator-log-account">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} (₹{parseFloat(acc.balance).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="creator-log-category">Select Spending Category</Label>
                <Select value={logCategoryId} onValueChange={setLogCategoryId} disabled={loggingExpense}>
                  <SelectTrigger id="creator-log-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex-row sm:justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCreatorPromptOpen(false)}
                disabled={loggingExpense}
                className="flex-1 sm:flex-none h-11"
              >
                Skip for now
              </Button>
              <Button 
                type="submit" 
                disabled={loggingExpense || userAccounts.length === 0 || categories.length === 0}
                className="flex-1 sm:flex-none h-11"
              >
                {loggingExpense ? 'Logging Expense...' : 'Log Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default GroupDetailsPage;
