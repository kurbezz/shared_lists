import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { LogOut, Settings, ChevronDown } from 'lucide-react';

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2"
        data-cy="user-menu-btn"
      >
        {user?.profile_image_url ? (
          <img src={user.profile_image_url} alt={user.username} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">{user?.username?.charAt(0).toUpperCase() || '?'}</div>
        )}
        <span className="hidden sm:inline text-sm truncate max-w-[10rem]">{user?.display_name || user?.username}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-card border rounded-md shadow-md z-20 overflow-hidden">
          <button
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
            data-cy="user-menu-settings"
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm">{t('dashboard.settings') /* fallback to dashboard settings */}</span>
          </button>

          <button
            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50 text-destructive"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            data-cy="user-menu-logout"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">{t('dashboard.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
