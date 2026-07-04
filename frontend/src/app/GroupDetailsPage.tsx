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
import { PageHeader, PageShell, StateBlock, StatusBadge } from './shared';
import { toast } from 'sonner';

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
      }
    } catch (err) {
      console.error('Failed to load accounts for payments', err);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
    fetchUserAccounts();
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
      toast.success('Member added successfully.');
      await fetchGroupDetails();
    } catch (err: any) {
      setAddMemberError(err.message || 'Failed to add member.');
      toast.error(err.message || 'Failed to add member.');
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
      toast.success('Group expense added successfully.');
      await fetchGroupDetails();
    } catch (err: any) {
      setAddExpenseError(err.message || 'Failed to record expense.');
      toast.error(err.message || 'Failed to record expense.');
    } finally {
      setAddExpenseLoading(false);
    }
  };

  // Creator Settle Up Netting Trigger
  const handleSettleUp = async () => {
    setSettleLoading(true);
    try {
      await apiClient(`/groups/${id}/settle`, { method: 'POST' });
      toast.success('Balances settled up successfully!');
      await fetchGroupDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to calculate settlements.');
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
      toast.success('Settlement marked as paid successfully!');
      await fetchGroupDetails();
      await fetchUserAccounts(); // Refresh sender balance

      // Trigger creator share logging prompt if fully settled and caller is creator
      if (response.groupFullySettled && response.creatorUserId === currentUser?.id) {
        setCreatorShareToLog(response.creatorShareAmount || 0);
        setCreatorPromptOpen(true);
      }
    } catch (err: any) {
      setPayError(err.message || 'Failed to complete payment.');
      toast.error(err.message || 'Failed to complete payment.');
    } finally {
      setPayLoading(false);
    }
  };



  if (loading) {
    return <PageShell><StateBlock type="loading" title="Loading group details..." /></PageShell>;
  }

  if (error || !group) {
    return (
      <PageShell>
        <StateBlock type="error" title="Group error" description={error || 'Group not found'} />
        <Link to="/groups" className="text-accent underline text-sm">Back to Groups</Link>
      </PageShell>
    );
  }

  const isCreator = group.createdBy === currentUser?.id;

  return (
    <PageShell>
      <PageHeader
        title={group.name}
        description={`Created on ${new Date(group.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <StatusBadge tone={group.isSettled ? 'success' : 'warning'}>{group.isSettled ? 'SETTLED' : 'ACTIVE'}</StatusBadge>
            <Link to="/groups" className="inline-flex items-center justify-center rounded border border-border bg-transparent text-text-primary hover:bg-surface-elevated text-xs font-semibold px-3 h-10 transition-colors">
              Back to Groups
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left Column: Members list & Actions */}
        <div className="flex flex-col gap-6 w-full">
          {/* Members list */}
          <Card className="p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Group Members</h2>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {group.members.map(m => (
                <div key={m.userId} className="flex justify-between items-center text-xs p-2.5 rounded border border-border bg-background">
                  <span className="text-text-primary truncate" title={m.user.email}>{m.user.email}</span>
                  {m.userId === group.createdBy && (
                    <StatusBadge tone="accent">CREATOR</StatusBadge>
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
              <p className="text-xs text-text-secondary">
                This calculates the minimum payments needed to settle everyone up. Click below to net balances and generate settlements.
              </p>
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
                  
                  return (
                    <Card key={settlement.id} className="p-4 bg-background border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge tone={settlement.status === 'COMPLETED' ? 'success' : 'warning'}>{settlement.status}</StatusBadge>
                          <span className="font-semibold text-sm text-text-primary break-words">
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

                    {/* Live running total message */}
                    <div className={`text-xs mt-2 font-semibold p-2.5 rounded-lg border flex items-center gap-2 ${
                      Math.abs(totalExpenseNum - getCustomSum()) < 0.011 && totalExpenseNum > 0
                        ? 'bg-success/5 border-success/30 text-success'
                        : (totalExpenseNum - getCustomSum()) > 0
                          ? 'bg-warning/5 border-warning/30 text-warning'
                          : 'bg-danger/5 border-danger/30 text-danger'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      <span>
                        ₹{getCustomSum().toFixed(2)} of ₹{totalExpenseNum.toFixed(2)} allocated — {
                          Math.abs(totalExpenseNum - getCustomSum()) < 0.011 && totalExpenseNum > 0
                            ? 'fully allocated'
                            : (totalExpenseNum - getCustomSum()) > 0
                              ? `₹${(totalExpenseNum - getCustomSum()).toFixed(2)} remaining`
                              : `₹${Math.abs(totalExpenseNum - getCustomSum()).toFixed(2)} over-allocated`
                        }
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
              <StateBlock title="No shared expenses logged yet" />
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
        onOpenChange={(open) => { if (!open) setCreatorPromptOpen(false); }}
      >
        <DialogContent>
          <DialogHeader className="mb-4">
            <DialogTitle>Group Fully Settled!</DialogTitle>
            <DialogDescription>
              All settlements are paid and completed. 
              Your personal expense share of ₹{creatorShareToLog.toFixed(2)} has been automatically logged under your <strong>Settlement</strong> category to keep your dashboard reports accurate.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button 
              type="button" 
              onClick={() => setCreatorPromptOpen(false)}
              className="w-full sm:w-auto h-11"
            >
              Great, thanks!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageShell>
  );
};

export default GroupDetailsPage;
