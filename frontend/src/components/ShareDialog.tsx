import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Page, User } from '@/types';
import { apiClient } from '@/api/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Share2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Search,
  Users,
  Link,
  UserPlus,
  Shield,
  ShieldCheck,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getValidationFromError, parseValidationErrors } from '@/lib/validation';

interface ShareDialogProps {
  page: Page;
}

type Tab = 'link' | 'collaborators';

export function ShareDialog({ page }: ShareDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('link');

  // Link States
  const [slug, setSlug] = useState(page.public_slug ? page.public_slug.slice(0, 50) : '');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Collaborators States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Queries
  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissions', page.id],
    queryFn: () => apiClient.getPagePermissions(page.id),
    enabled: open && activeTab === 'collaborators',
  });

  // Mutations
  const setPublicSlugMutation = useMutation({
    mutationFn: (newSlug: string | null) => apiClient.setPublicSlug(page.id, { public_slug: newSlug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page', page.id] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (err) => {
      // If the backend returned structured validation errors, prefer the field message
      try {
        const v = getValidationFromError(err) ?? err;
        const parsed = parseValidationErrors(v);
        if (parsed['public_slug']) {
          setLinkError(parsed['public_slug']);
          return;
        }
      } catch {
        /* fallthrough */
      }

      const errorMessage = err instanceof Error ? err.message : t('share.save_failed');
      setLinkError(errorMessage);
    },
  });

  const grantPermissionMutation = useMutation({
    mutationFn: (userId: string) => apiClient.grantPermission(page.id, { user_id: userId, can_edit: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', page.id] });
      setSearchQuery('');
      setSearchResults([]);
    },
    onError: () => {
      toast.error(t('share.grant_failed'));
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ permId, canEdit }: { permId: string; canEdit: boolean }) =>
      apiClient.updatePermission(page.id, permId, { can_edit: canEdit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', page.id] });
    },
    onError: () => {
      toast.error(t('share.update_perm_failed'));
    },
  });

  const revokePermissionMutation = useMutation({
    mutationFn: (permId: string) => apiClient.revokePermission(page.id, permId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', page.id] });
    },
    onError: () => {
      toast.error(t('share.revoke_failed'));
    },
  });

  useEffect(() => {
    if (open) {
      setSlug((page.public_slug || '').slice(0, 50));
      setLinkError(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open, page.public_slug]);

  // Memoize existing user IDs to avoid re-runs
  const existingUserIdsKey = useMemo(
    () => permissions.map((p) => p.user_id).sort().join(','),
    [permissions]
  );

  // Handle Search with debounce
  useEffect(() => {
    if (!open || activeTab !== 'collaborators') {
      setSearchResults([]);
      return;
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    let mounted = true;
    const exclude = new Set(existingUserIdsKey ? existingUserIdsKey.split(',') : []);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await apiClient.searchUsers(searchQuery);
        if (!mounted) return;
        const filtered = users.filter((u) => !exclude.has(u.id));
        setSearchResults(filtered);
      } catch {
        /* search error is non-fatal; mutation errors are shown via toast */
      } finally {
        if (mounted) setIsSearching(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, existingUserIdsKey, open, activeTab]);

  const publicUrl = page.public_slug ? `${window.location.origin}/p/${page.public_slug}` : null;

  const handleSaveLink = async () => {
    if (!slug.trim()) {
      setLinkError(t('share.slug_empty'));
      return;
    }

    const slugRegex = /^[a-z0-9-]{3,50}$/;
    if (!slugRegex.test(slug)) {
      setLinkError(t('share.slug_invalid'));
      return;
    }

    setLinkError(null);
    setPublicSlugMutation.mutate(slug);
  };

  const handleRemoveLink = () => {
    setLinkError(null);
    setPublicSlugMutation.mutate(null);
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success(t('common.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('share.copy_failed'));
    }
  };

  const handleGrant = (userId: string) => {
    grantPermissionMutation.mutate(userId);
  };

  const handleUpdatePerm = (permId: string, canEdit: boolean) => {
    updatePermissionMutation.mutate({ permId, canEdit });
  };

  const handleRevoke = (permId: string) => {
    revokePermissionMutation.mutate(permId);
  };

  const avatarFallback = (displayName?: string | null, username?: string) => {
    return (displayName || username || '?')[0].toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          <span className="hidden sm:inline">{t('share.button')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4 text-accent" />
            {t('share.title')}
          </DialogTitle>
          <DialogDescription>{t('share.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="mt-4">
          <TabsList>
            <TabsTrigger value="link" className="gap-2">
              <Link className="size-4" />
              {t('share.tabs_link')}
            </TabsTrigger>
            <TabsTrigger value="collaborators" className="gap-2">
              <Users className="size-4" />
              {t('share.tabs_collaborators')}
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="slug">{t('share.slug')}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-page"
                className={cn(linkError && 'border-destructive')}
              />
              <p className="text-xs text-muted-foreground">{t('share.slug_hint')}</p>
              {linkError && <p className="text-xs text-destructive">{linkError}</p>}
            </div>

            {publicUrl && (
              <div className="space-y-2">
                <Label>{t('share.current_link')}</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-[13px]" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
                  </Button>
                  <Button size="icon" variant="outline" asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {publicUrl ? (
                <>
                  <Button
                    onClick={handleSaveLink}
                    disabled={setPublicSlugMutation.isPending}
                    variant="primary"
                    className="flex-1"
                  >
                    {setPublicSlugMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    {t('share.update_link')}
                  </Button>
                  <Button
                    onClick={handleRemoveLink}
                    variant="destructive"
                    disabled={setPublicSlugMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                    {t('share.remove_link')}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleSaveLink}
                  disabled={setPublicSlugMutation.isPending}
                  variant="primary"
                  className="w-full"
                >
                  {setPublicSlugMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('share.create_link')}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Collaborators Tab */}
          <TabsContent value="collaborators" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('share.collaborators_description')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('share.search_placeholder')}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    size="icon-dense"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search Results */}
            {isSearching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-5 animate-spin text-accent" />
                <span className="ml-2 text-sm text-muted-foreground">{t('share.searching')}</span>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t('share.search_results')}</Label>
                <div className="max-h-[150px] space-y-1 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-subtle"
                    >
                      <div className="flex items-center gap-2">
                        {user.profile_image_url ? (
                          <img
                            src={user.profile_image_url}
                            alt={user.username}
                            className="h-8 w-8 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle">
                            <span className="text-xs font-medium text-accent">
                              {avatarFallback(user.display_name, user.username)}
                            </span>
                          </div>
                        )}
                        <span className="text-sm font-medium">{user.display_name || user.username}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleGrant(user.id)}
                        disabled={grantPermissionMutation.isPending}
                      >
                        <UserPlus className="size-3" />
                        {t('share.add_collaborator')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('share.no_users_found')}
              </p>
            )}

            {/* Current Collaborators */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">{t('share.current_collaborators')}</Label>
              {isLoadingPermissions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-accent" />
                </div>
              ) : permissions.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t('share.no_collaborators')}
                </p>
              ) : (
                <div className="max-h-[200px] space-y-1 overflow-y-auto">
                  {permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between rounded-md bg-subtle p-2"
                    >
                      <div className="flex items-center gap-2">
                        {perm.user.profile_image_url ? (
                          <img
                            src={perm.user.profile_image_url}
                            alt={perm.user.username}
                            className="h-8 w-8 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle">
                            <span className="text-xs font-medium text-accent">
                              {avatarFallback(perm.user.display_name, perm.user.username)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {perm.user.display_name || perm.user.username}
                          </span>
                          <div className="flex items-center gap-1">
                            {perm.can_edit ? (
                              <Badge variant="editor" className="text-xs gap-1">
                                <ShieldCheck className="size-3" />
                                {t('share.can_edit')}
                              </Badge>
                            ) : (
                              <Badge variant="viewer" className="text-xs gap-1">
                                <Shield className="size-3" />
                                {t('share.can_view')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdatePerm(perm.id, !perm.can_edit)}
                          disabled={updatePermissionMutation.isPending}
                        >
                          {perm.can_edit ? t('share.can_view') : t('share.can_edit')}
                        </Button>
                        <Button
                          size="icon-dense"
                          variant="ghost-destructive"
                          onClick={() => handleRevoke(perm.id)}
                          disabled={revokePermissionMutation.isPending}
                          aria-label={t('share.revoke_access')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
