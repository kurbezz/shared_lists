import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { LogOut, Settings, ChevronDown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { PageWithPermission } from '../types';
import { apiClient } from '../api/client';

// Top-level PagesList component to prevent remounting loops
const PagesList: React.FC<{ open: boolean; onNavigate: (path: string) => void }> = ({ open, onNavigate }) => {
  const { t } = useTranslation();
  const { data: pages = [], isLoading: isPagesLoading } = useQuery<PageWithPermission[]>({
    queryKey: ['pages'],
    queryFn: () => apiClient.getPages(),
    enabled: open,
    staleTime: 1000 * 60 * 2,
  });

  if (!open) return null;

  const createdPages = pages.filter((p) => p.is_creator);

  if (isPagesLoading) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground px-1 mb-2">{t('dashboard.my_pages', { count: 0 })}</div>
        </div>
        <div className="flex items-center justify-center p-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!createdPages || createdPages.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground px-1 mb-2">{t('dashboard.my_pages', { count: 0 })}</div>
        </div>
        <div className="text-sm text-muted-foreground p-2">{t('dashboard.no_pages')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground px-1 mb-2">{t('dashboard.my_pages', { count: createdPages.length })}</div>
      </div>

      <div className="max-h-56 overflow-auto">
        {createdPages.slice(0, 6).map((p) => (
          <button
            key={p.id}
            className="w-full text-left px-2 py-2 hover:bg-muted/50 text-sm truncate"
            onClick={() => onNavigate(`/pages/${p.id}`)}
            title={p.title}
            data-cy={`user-menu-page-${p.id}`}
          >
            {p.title}
          </button>
        ))}

        {createdPages.length > 6 && (
          <button
            className="w-full text-left px-2 py-2 text-sm text-muted-foreground"
            onClick={() => onNavigate('/')}
          >
            {t('dashboard.view_all_pages') || 'View all'}
          </button>
        )}
      </div>
    </div>
  );
};

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
        <div className="absolute right-0 mt-2 w-64 bg-card border rounded-md shadow-md z-20 overflow-hidden">
          <div className="p-2 border-b">
            {/* Pages list (includes heading with count) */}
            <PagesList open={open} onNavigate={(path) => { setOpen(false); navigate(path); }} />
          </div>

          <div>
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
        </div>
      )}
    </div>
  );
};

export default UserMenu;
