import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { apiClient } from '../api/client';
import { Search, Compass, Play, FileText, X } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const navigate = useNavigate();

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced search for records
  useEffect(() => {
    if (query.trim().length < 3) {
      setRecords([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiClient<{ records: any[] }>(`/records?q=${encodeURIComponent(query)}`);
        setRecords(response.records || []);
      } catch (err) {
        console.error('Failed to search records in palette:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Global event listener to open from navigation button click
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  if (!open) return null;

  const handleSelectPage = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSelectRecord = (desc: string) => {
    setOpen(false);
    navigate(`/history?q=${encodeURIComponent(desc)}`);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh] p-4">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => setOpen(false)} />

      <div className="w-full max-w-[550px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-150">
        <Command label="Global Command Palette" className="flex flex-col">
          <div className="flex items-center gap-3 px-4 border-b border-border py-3">
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Search pages, actions, or transaction descriptions..."
              value={query}
              onValueChange={setQuery}
              className="bg-transparent border-0 outline-none text-sm text-text-primary placeholder:text-text-secondary flex-grow"
            />
            <button
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-surface-elevated transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1.5 scrollbar-thin">
            <Command.Empty className="p-4 text-xs text-text-secondary text-center">
              No matching pages, actions, or transactions found
            </Command.Empty>

            {query.trim().length === 0 && (
              <>
                <Command.Group heading="Navigation" className="text-[10px] text-text-secondary font-bold uppercase tracking-wider px-2 py-1">
                  <Command.Item
                    onSelect={() => handleSelectPage('/')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Dashboard / Overview</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/#accounts')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Accounts</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/#transfers')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Transfers</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/#budgets')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Budgets</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/groups')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Groups</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/history')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Transaction History</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/imports')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Statement Import</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/analytics')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Analytics</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/settings')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    <span>Go to Settings</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Quick Actions" className="text-[10px] text-text-secondary font-bold uppercase tracking-wider px-2 py-1 mt-2">
                  <Command.Item
                    onSelect={() => handleSelectPage('/#transfers')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Play className="h-4 w-4 shrink-0" />
                    <span>New Transfer (Go to Transfer Funds form)</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/#expenses')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Play className="h-4 w-4 shrink-0" />
                    <span>New Expense (Go to Record Expense form)</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/groups?action=new-group')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Play className="h-4 w-4 shrink-0" />
                    <span>New Group (Open Create Group dialog)</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelectPage('/imports')}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <Play className="h-4 w-4 shrink-0" />
                    <span>Import Statement (Go to Upload Statement page)</span>
                  </Command.Item>
                </Command.Group>
              </>
            )}

            {query.trim().length > 0 && records.length > 0 && (
              <Command.Group heading="Matching Transactions" className="text-[10px] text-text-secondary font-bold uppercase tracking-wider px-2 py-1">
                {records.map((r) => (
                  <Command.Item
                    key={r.id}
                    onSelect={() => handleSelectRecord(r.description || r.accountName || '')}
                    className="flex justify-between items-center px-2.5 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-white cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-text-secondary shrink-0" />
                      <span className="truncate font-semibold">{r.description || 'No description'}</span>
                      <span className="text-[10px] opacity-70">({r.accountName})</span>
                    </div>
                    <span className="font-mono text-xs font-semibold shrink-0">
                      {r.direction === 'OUT' ? '-' : '+'}₹{parseFloat(r.amount).toFixed(2)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
