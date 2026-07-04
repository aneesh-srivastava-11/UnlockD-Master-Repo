import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui/button';
import { Menu, X, Search } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center justify-center rounded-lg text-xs font-semibold px-4 h-10 transition-all w-full lg:w-auto ${
      isActive 
        ? 'bg-accent text-white shadow-md shadow-accent/10' 
        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
    }`;

  const inactiveLinkClass = 
    "inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated text-xs font-semibold px-4 h-10 transition-all w-full lg:w-auto text-center";

  return (
    <header className="relative flex flex-col lg:flex-row justify-between items-stretch lg:items-center p-4 bg-surface border-b border-border w-full box-border z-50">
      <div className="flex justify-between items-center w-full lg:w-auto">
        {/* Brand logo & name */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white font-mono font-bold text-sm shrink-0">
            F
          </span>
          <span className="font-semibold text-text-primary text-base tracking-tight">Financista</span>
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex items-center justify-end gap-4 flex-1 min-w-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-elevated/80 rounded-lg border border-border/80 transition-colors shadow-inner font-medium shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="bg-background text-[10px] px-1.5 py-0.5 rounded font-mono border border-border/60">⌘K</kbd>
        </button>

        <span className="font-mono text-xs text-text-secondary truncate max-w-[180px] mr-2" title={user.email}>
          {user.email}
        </span>
        <nav className="flex items-center gap-1.5 flex-wrap min-w-0">
          <NavLink to="/" className={linkClass} end>Overview</NavLink>
          <a href="/#accounts" className={inactiveLinkClass}>Accounts</a>
          <a href="/#transfers" className={inactiveLinkClass}>Transfers</a>
          <a href="/#budgets" className={inactiveLinkClass}>Budgets</a>
          <NavLink to="/groups" className={linkClass}>Groups</NavLink>
          <NavLink to="/history" className={linkClass}>History</NavLink>
          <NavLink to="/imports" className={linkClass}>Import</NavLink>
          <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
          <NavLink to="/settings" className={linkClass}>Settings</NavLink>
          <Button 
            variant="outline" 
            onClick={logout} 
            className="h-10 px-4 text-xs rounded-lg border-border bg-transparent text-text-primary hover:bg-surface-elevated shrink-0 transition-colors ml-2"
          >
            Log Out
          </Button>
        </nav>
      </div>

      {/* Mobile Navigation Dropdown Overlay */}
      {mobileMenuOpen && (
        <div className="absolute top-[100%] left-0 right-0 bg-surface border-b border-border shadow-xl p-4 flex flex-col gap-3 lg:hidden z-50 animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-1 border-b border-border pb-3">
            <span className="text-[10px] text-text-secondary uppercase font-semibold">Logged in as</span>
            <span className="font-mono text-xs text-text-primary truncate" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.dispatchEvent(new CustomEvent('open-command-palette'));
              }}
              className="flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-surface-elevated rounded-lg border border-border/80 transition-colors mt-2 w-full font-medium"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Search application...</span>
              </div>
              <kbd className="bg-background text-[10px] px-1.5 py-0.5 rounded font-mono border border-border/60">⌘K</kbd>
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" className={linkClass} end onClick={() => setMobileMenuOpen(false)}>Overview</NavLink>
            <a href="/#accounts" className={inactiveLinkClass} onClick={() => setMobileMenuOpen(false)}>Accounts</a>
            <a href="/#transfers" className={inactiveLinkClass} onClick={() => setMobileMenuOpen(false)}>Transfers</a>
            <a href="/#budgets" className={inactiveLinkClass} onClick={() => setMobileMenuOpen(false)}>Budgets</a>
            <NavLink to="/groups" className={linkClass} onClick={() => setMobileMenuOpen(false)}>Groups</NavLink>
            <NavLink to="/history" className={linkClass} onClick={() => setMobileMenuOpen(false)}>History</NavLink>
            <NavLink to="/imports" className={linkClass} onClick={() => setMobileMenuOpen(false)}>Import</NavLink>
            <NavLink to="/analytics" className={linkClass} onClick={() => setMobileMenuOpen(false)}>Analytics</NavLink>
            <NavLink to="/settings" className={linkClass} onClick={() => setMobileMenuOpen(false)}>Settings</NavLink>
          </nav>
          <Button 
            variant="outline" 
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }} 
            className="h-10 w-full text-xs rounded-lg border-border bg-transparent text-text-primary hover:bg-surface-elevated transition-colors mt-2"
          >
            Log Out
          </Button>
        </div>
      )}
    </header>
  );
};

export default TopBar;
