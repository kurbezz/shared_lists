import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut } from 'lucide-react';

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          {user?.profile_image_url ? (
            <img
              src={user.profile_image_url}
              alt={user.display_name || user.username}
              className="h-8 w-8 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle">
              <span className="text-xs font-medium text-accent">
                {(user?.display_name || user?.username || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          <span className="hidden text-sm font-medium sm:inline">
            {user?.display_name || user?.username}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="text-[13px] font-medium">{user?.display_name || user?.username}</div>
          <div className="text-xs text-muted-foreground">{user?.username}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <Settings className="size-4" />
          {t('dashboard.settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="size-4" />
          {t('dashboard.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
