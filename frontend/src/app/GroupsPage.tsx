import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { PageHeader, PageShell, StateBlock, StatusBadge } from './shared';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';

interface Group {
  id: string;
  name: string;
  createdBy: string;
  isSettled: boolean;
  createdAt: string;
  settledAt: string | null;
  members: {
    userId: string;
    user: {
      email: string;
    };
  }[];
}

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [settledGroups, setSettledGroups] = useState<Group[]>([]);
  const [showSettled, setShowSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Group Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new-group') {
      setIsCreateOpen(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('action');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await apiClient<Group[]>('/groups');
      const settled = await apiClient<Group[]>('/groups/settled');
      setActiveGroups(active);
      setSettledGroups(settled);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!groupName.trim()) {
      setCreateError('Group name is required.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await apiClient<Group>('/groups', {
        method: 'POST',
        bodyData: { name: groupName.trim() }
      });
      setGroupName('');
      setIsCreateOpen(false);
      toast.success(`Group "${created.name}" created successfully.`);
      // Redirect straight to new group page
      navigate(`/groups/${created.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create group.');
    } finally {
      setIsCreating(false);
    }
  };

  const groupsToDisplay = showSettled ? settledGroups : activeGroups;

  return (
    <PageShell>
      <PageHeader
        title="Shared Groups"
        description="Split expenses and track balances with friends and travel companions."
        actions={
          <>
          <Button 
            variant="outline" 
            onClick={() => setShowSettled(!showSettled)}
            className="h-11 px-4 text-xs sm:text-sm font-semibold"
          >
            {showSettled ? 'Show Active Groups' : 'Show Settled History'}
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-4 text-xs sm:text-sm font-semibold">
                + Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateGroup}>
                <DialogHeader className="mb-4">
                  <DialogTitle>Create Shared Group</DialogTitle>
                  <DialogDescription>Start a group to log and settle expenses. You can add other members next.</DialogDescription>
                </DialogHeader>

                {createError && (
                  <div className="p-3 text-xs rounded bg-danger/10 border border-danger text-danger mb-4">
                    {createError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 mb-6">
                  <Label htmlFor="group-name-input">Group Name</Label>
                  <Input
                    id="group-name-input"
                    placeholder="e.g. Goa Trip 2026, Roommates"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateOpen(false)}
                    disabled={isCreating}
                    className="max-sm:w-full"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isCreating}
                    className="max-sm:w-full"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      {error && (
        <StateBlock type="error" title="Groups error" description={error} />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[148px] w-full rounded-xl animate-pulse" />
          <Skeleton className="h-[148px] w-full rounded-xl animate-pulse" />
          <Skeleton className="h-[148px] w-full rounded-xl animate-pulse" />
        </div>
      ) : groupsToDisplay.length === 0 ? (
        <StateBlock
          title={showSettled ? 'No settled groups found' : 'No active groups'}
          description={
            showSettled 
              ? 'Groups move here once all settlements are paid and completed.' 
              : 'Shared groups let you split expenses (like trip costs, rent, or dinner) with friends, track who paid, and settle up balances easily.'
          }
          action={!showSettled && (
            <Button onClick={() => setIsCreateOpen(true)} size="sm">
              Create your first group
            </Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupsToDisplay.map((group) => (
            <Card 
              key={group.id} 
              onClick={() => navigate(`/groups/${group.id}`)}
              className="p-5 cursor-pointer hover:border-text-secondary/40 transition-colors flex flex-col gap-4 bg-surface"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-text-primary text-base truncate">{group.name}</h3>
                  <span className="text-xs text-text-secondary">
                    {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <StatusBadge tone={group.isSettled ? 'success' : 'warning'}>{group.isSettled ? 'SETTLED' : 'ACTIVE'}</StatusBadge>
              </div>

              <div className="text-xs text-text-secondary border-t border-border pt-3 mt-auto">
                <p className="truncate">Members: {group.members.map(m => m.user.email).join(', ')}</p>
                <p className="text-[10px] opacity-75 mt-1">
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default GroupsPage;
