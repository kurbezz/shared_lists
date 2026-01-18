import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { apiClient } from '@/api/client';
import type { Page, User } from '@/types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

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
    const [slug, setSlug] = useState(page.public_slug || '');
    const [linkError, setLinkError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Collaborators States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [permError, setPermError] = useState<string | null>(null);

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
        onError: () => setPermError(t('share.grant_failed')),
    });

    const updatePermissionMutation = useMutation({
        mutationFn: ({ permId, canEdit }: { permId: string; canEdit: boolean }) =>
            apiClient.updatePermission(page.id, permId, { can_edit: canEdit }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permissions', page.id] });
        },
        onError: () => setPermError(t('share.update_perm_failed')),
    });

    const revokePermissionMutation = useMutation({
        mutationFn: (permId: string) => apiClient.revokePermission(page.id, permId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['permissions', page.id] });
        },
        onError: () => setPermError(t('share.revoke_failed')),
    });

    useEffect(() => {
        if (open) {
            setSlug(page.public_slug || '');
            setLinkError(null);
            setPermError(null);
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [open, page.public_slug]);

    // Memoize a stable key to avoid re-runs caused by reference changes
    const existingUserIdsKey = useMemo(() => permissions.map(p => p.user_id).sort().join(','), [permissions]);

    // Handle Search with debounce and cancellation; only active when dialog open and on collaborators tab
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
                // Filter out existing collaborators
                const filtered = users.filter(u => !exclude.has(u.id));
                setSearchResults(filtered);
            } catch (err) {
                console.error('Search failed', err);
            } finally {
                if (mounted) setIsSearching(false);
            }
        }, 300);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [searchQuery, existingUserIdsKey, open, activeTab]);

    const publicUrl = page.public_slug
        ? `${window.location.origin}/p/${page.public_slug}`
        : null;

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

    const handleRemoveLink = async () => {
        setLinkError(null);
        setPublicSlugMutation.mutate(null);
    };

    const handleCopy = async () => {
        if (!publicUrl) return;
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setLinkError(t('share.copy_failed'));
        }
    };

    const handleGrant = async (userId: string) => {
        setPermError(null);
        grantPermissionMutation.mutate(userId);
    };

    const handleUpdatePerm = async (permId: string, canEdit: boolean) => {
        updatePermissionMutation.mutate({ permId, canEdit });
    };

    const handleRevoke = async (permId: string) => {
        revokePermissionMutation.mutate(permId);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-background/50 backdrop-blur-sm border-primary/20 hover:border-primary/50 transition-all gap-2" data-cy="share-btn">
                    <Share2 className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">{t('share.button')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-md border-primary/10">
                <DialogHeader>
                    <DialogTitle>{t('share.title')}</DialogTitle>
                    <DialogDescription>
                        {activeTab === 'link' ? t('share.description') : t('share.collaborators_description')}
                    </DialogDescription>
                </DialogHeader>

                {/* Custom Tabs */}
                <div className="flex p-1 bg-muted/50 rounded-lg mb-4">
                    <button
                        onClick={() => setActiveTab('link')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all select-none outline-none",
                            activeTab === 'link' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        data-cy="share-tab-link"
                    >
                        <Link className="h-4 w-4" />
                        {t('share.tabs_link')}
                    </button>
                    <button
                        onClick={() => setActiveTab('collaborators')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all select-none outline-none",
                            activeTab === 'collaborators' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                        data-cy="share-tab-collab"
                    >
                        <Users className="h-4 w-4" />
                        {t('share.tabs_collaborators')}
                    </button>
                </div>

                <div className="space-y-4 min-h-[300px]">
                    {activeTab === 'link' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="space-y-2">
                                <Label htmlFor="slug" className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t('share.slug')}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="slug"
                                        placeholder="my-cool-list"
                                        value={slug}
                                        autoFocus
                                        onChange={(e) => {
                                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                            setLinkError(null);
                                        }}
                                        disabled={setPublicSlugMutation.isPending}
                                        className="bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                        data-cy="share-slug-input"
                                    />
                                    <Button
                                        onClick={handleSaveLink}
                                        disabled={setPublicSlugMutation.isPending || !slug.trim() || slug === page.public_slug}
                                        size="sm"
                                        data-cy="share-slug-btn"
                                    >
                                        {setPublicSlugMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : page.public_slug ? t('common.save') : t('common.add')}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    {t('share.slug_hint')}
                                </p>
                            </div>

                            {linkError && (
                                <p className="text-xs font-medium text-destructive bg-destructive/10 p-2 rounded">{linkError}</p>
                            )}

                            {publicUrl && (
                                <div className="space-y-2 pt-2 border-t border-primary/5">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t('share.current_link')}</Label>
                                    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                        <code className="flex-1 text-xs truncate font-mono text-primary/80">{publicUrl}</code>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                {copied ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <Copy className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={handleRemoveLink} disabled={setPublicSlugMutation.isPending} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-muted-foreground" data-cy="share-remove-slug-btn">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="space-y-2">
                                <Label htmlFor="user-search" className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t('share.add_collaborator')}
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="user-search"
                                        placeholder={t('share.search_placeholder')}
                                        value={searchQuery}
                                        autoFocus
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-primary/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ maxWidth: 'calc(100% - 3rem)' }}>
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {searchResults.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center justify-between p-3 hover:bg-primary/5 cursor-pointer transition-colors border-b last:border-0 border-primary/5"
                                                    onClick={() => handleGrant(user.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                                                            {user.profile_image_url ? (
                                                                <img src={user.profile_image_url} alt={user.username} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-primary text-xs font-bold">{user.username.substring(0, 2).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold leading-none">{user.display_name || user.username}</span>
                                                            <span className="text-[10px] text-muted-foreground">@{user.username}</span>
                                                        </div>
                                                    </div>
                                                    <UserPlus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {permError && (
                                <p className="text-xs font-medium text-destructive bg-destructive/10 p-2 rounded">{permError}</p>
                            )}

                            <div className="space-y-3 pt-2">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                                    {t('share.tabs_collaborators')}
                                </Label>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {isLoadingPermissions ? (
                                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-xs">{t('common.loading')}</span>
                                        </div>
                                    ) : permissions.length === 0 ? (
                                        <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
                                            <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                            <p className="text-xs text-muted-foreground">{t('share.no_users_found')}</p>
                                        </div>
                                    ) : (
                                        permissions.map(perm => (
                                            <div key={perm.id} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg border border-primary/5 hover:border-primary/20 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 group-hover:border-primary/30 transition-colors">
                                                        {perm.user.profile_image_url ? (
                                                            <img src={perm.user.profile_image_url} alt={perm.user.username} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-primary text-xs font-bold">{perm.user.username.substring(0, 2).toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium leading-none">{perm.user.display_name || perm.user.username}</span>
                                                        <Badge variant="secondary" className="h-4 px-1 text-[9px] w-fit mt-1 bg-primary/5 text-primary/70">
                                                            {perm.can_edit ? t('share.can_edit') : t('share.can_view')}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => handleUpdatePerm(perm.id, !perm.can_edit)}
                                                        title={perm.can_edit ? t('share.can_view') : t('share.can_edit')}
                                                    >
                                                        {perm.can_edit ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRevoke(perm.id)}
                                                        title={t('share.revoke_access')}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
