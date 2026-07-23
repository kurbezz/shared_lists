import { useEffect, useState, useCallback } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { apiClient } from '@/api/client';
import useServerErrors from '@/hooks/useServerErrors';
import type { ApiKey } from '@/types';
import { UserMenu } from '@/components/UserMenu';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ChevronLeft, Key, X, Loader2, Copy, Check, Trash2, ShieldCheck } from 'lucide-react';

export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const _currentLang = i18n.language || 'en';

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const { user, refreshUser } = useAuth();
  const [imgError, setImgError] = useState(false);

  const profileForm = useForm({
    defaultValues: {
      display_name: '',
      profile_image_url: '',
      email: '',
    },
  });
  const profileServerErrors = useServerErrors();
  const { errors: profileErrors, setFrom: setProfileErrorsFrom, clear: clearProfileErrors, onChangeClear: onChangeClearProfile, applyToForm: applyProfileErrorsToForm } = profileServerErrors;

  const createKeyForm = useForm({
    defaultValues: {
      name: '',
      scopes: '',
    },
  });
  const createKeyServerErrors = useServerErrors();
  const { errors: createErrors, setFrom: setCreateErrorsFrom, clear: clearCreateErrors, onChangeClear: onChangeClearCreate, applyToForm: applyCreateKeyErrorsToForm } = createKeyServerErrors;
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const profileImageUrl = profileForm.getFieldValue('profile_image_url') ?? '';
  const displayName = profileForm.getFieldValue('display_name') ?? '';

  useEffect(() => {
    setImgError(false);
  }, [profileImageUrl]);

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    toast.success(t('profile.saved'));
  };

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const keys = await apiClient.getApiKeys();
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error(t('profile.fetch_failed'));
    } finally {
      setLoadingKeys(false);
    }
  }, [t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  useEffect(() => {
    if (user) {
      profileForm.setFieldValue('display_name', user.display_name || '');
      profileForm.setFieldValue('profile_image_url', user.profile_image_url || '');
      profileForm.setFieldValue('email', user.email || '');
    }
  }, [user, profileForm]);

  useEffect(() => {
    applyProfileErrorsToForm?.(profileForm);
  }, [profileErrors, applyProfileErrorsToForm, profileForm]);
  useEffect(() => {
    applyCreateKeyErrorsToForm?.(createKeyForm);
  }, [createErrors, applyCreateKeyErrorsToForm, createKeyForm]);

  const handleCreate = async () => {
    const values = (createKeyForm.state as unknown as { values: Record<string, unknown> }).values as { name?: string; scopes?: string };
    const scopesArr = (values.scopes || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    setCreating(true);
    try {
      const resp = await apiClient.createApiKey({ name: values.name || null, scopes: scopesArr });
      setCreatedToken(resp.token);
      clearCreateErrors();
      toast.success(t('profile.created_notify'));
      try {
        await navigator.clipboard.writeText(resp.token);
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } catch {
        // ignore clipboard errors
      }
      createKeyForm.setFieldValue('name', '');
      createKeyForm.setFieldValue('scopes', '');
      fetchKeys();
    } catch (err) {
      console.error('Create API key failed:', err);
      if (err instanceof Error) {
        const maybe = err as { validation?: unknown };
        if (maybe.validation) {
          setCreateErrorsFrom(maybe.validation);
          return;
        }
      }

      const msg = err instanceof Error ? err.message : t('profile.create_failed');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await apiClient.revokeApiKey(revokeId);
      toast.success(t('profile.revoked_success'));
      fetchKeys();
    } catch {
      toast.error(t('profile.revoke_failed'));
    } finally {
      setRevokeId(null);
    }
  };

  const handleSaveProfile = async () => {
    clearProfileErrors();
    try {
      const values = (profileForm.state as unknown as { values: Record<string, unknown> }).values as { display_name?: string; profile_image_url?: string; email?: string };
      const payload = {
        display_name: values.display_name || null,
        profile_image_url: values.profile_image_url || null,
        email: values.email || null,
      } as unknown as { display_name?: string | null; profile_image_url?: string | null; email?: string | null };
      await apiClient.updateCurrentUser(payload);
      toast.success(t('profile.saved'));
      try {
        await refreshUser();
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Update profile failed:', err);
      if (err instanceof Error) {
        const maybe = err as { validation?: unknown };
        if (maybe.validation) {
          setProfileErrorsFrom(maybe.validation);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : t('profile.save_failed');
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiClient.deleteApiKey(deleteId);
      toast.success(t('profile.delete_success'));
      fetchKeys();
    } catch {
      toast.error(t('profile.delete_failed'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleCopyToken = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopiedToken(true);
      toast.success(t('common.copied'));
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      toast.error(t('share.copy_failed'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-background">
        <div className="mx-auto flex h-full max-w-2xl items-center justify-between px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            aria-label={t('page.back_to_pages')}
            className="shrink-0"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 md:px-6 space-y-6">
        {/* Page heading */}
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t('profile.title')}</h1>

        {/* Profile Card */}
        <Card className="rounded-lg border border-border bg-surface">
          <CardHeader className="border-b border-border p-4">
            <CardTitle>{t('profile.settings_title')}</CardTitle>
            <CardDescription className="mt-1">
              {t('profile.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Avatar row */}
            <div className="flex items-center gap-3">
              {profileImageUrl && !imgError ? (
                <img
                  src={profileImageUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border border-border object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-accent-subtle flex items-center justify-center">
                  <span className="text-accent font-medium text-sm">
                    {(displayName || user?.display_name || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 grid gap-2">
                <Label htmlFor="profile_image_url">{t('profile.label_profile_image')}</Label>
                <Input
                  id="profile_image_url"
                  value={profileImageUrl}
                  onChange={(e) => {
                    profileForm.setFieldValue('profile_image_url', e.target.value);
                    if (onChangeClearProfile) onChangeClearProfile('profile_image_url')(e);
                  }}
                  placeholder="https://static-cdn.jtvnw.net/jtv_user_pictures/…"
                />
                {profileErrors['profile_image_url'] && (
                  <p className="text-xs text-destructive">{profileErrors['profile_image_url']}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display_name">{t('profile.label_display_name')}</Label>
              <Input
                id="display_name"
                value={profileForm.getFieldValue('display_name') ?? ''}
                onChange={(e) => {
                  profileForm.setFieldValue('display_name', e.target.value);
                  if (onChangeClearProfile) onChangeClearProfile('display_name')(e);
                }}
                placeholder="streamer_max"
              />
              {profileErrors['display_name'] && (
                <p className="text-xs text-destructive">{profileErrors['display_name']}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">{t('profile.label_email', 'Email')}</Label>
              <Input
                id="email"
                type="email"
                value={profileForm.getFieldValue('email') ?? ''}
                onChange={(e) => {
                  profileForm.setFieldValue('email', e.target.value);
                  if (onChangeClearProfile) onChangeClearProfile('email')(e);
                }}
                placeholder="anna.plays@gmail.com"
              />
              {profileErrors['email'] && (
                <p className="text-xs text-destructive">{profileErrors['email']}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="language">{t('profile.label_language', 'Language')}</Label>
              <div className="relative">
                <select
                  id="language"
                  onChange={handleLangChange}
                  defaultValue={_currentLang}
                  className="relative h-9 w-full appearance-none rounded-md border border-input-border bg-surface pl-3 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
                <ChevronLeft className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 -rotate-90 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t border-border p-4">
            <Button variant="primary" onClick={handleSaveProfile}>
              {t('common.save')}
            </Button>
          </CardFooter>
        </Card>

        {/* API Keys Card */}
        <Card className="rounded-lg border border-border bg-surface">
          <CardHeader className="border-b border-border p-4">
            <CardTitle>{t('profile.api_keys_title')}</CardTitle>
            <CardDescription className="mt-1">
              {t(
                'profile.api_keys_subtitle',
                'API keys give external applications access to your pages. Keep them like passwords.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Create API Key Form */}
            <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-2 flex-1">
                <Label htmlFor="key-name">{t('profile.label_name')}</Label>
                <Input
                  id="key-name"
                  value={createKeyForm.getFieldValue('name') ?? ''}
                  onChange={(e) => {
                    createKeyForm.setFieldValue('name', e.target.value);
                    if (onChangeClearCreate) onChangeClearCreate('name')(e);
                  }}
                  placeholder="Stream Bot"
                />
                {createErrors['name'] && (
                  <p className="text-xs text-destructive">{createErrors['name']}</p>
                )}
              </div>
              <div className="grid gap-2 flex-1">
                <Label htmlFor="key-scopes">{t('profile.label_scopes')}</Label>
                <Input
                  id="key-scopes"
                  value={createKeyForm.getFieldValue('scopes') ?? ''}
                  onChange={(e) => {
                    createKeyForm.setFieldValue('scopes', e.target.value);
                    if (onChangeClearCreate) onChangeClearCreate('scopes')(e);
                  }}
                  placeholder="pages:read, pages:write"
                />
                {createErrors['scopes'] && (
                  <p className="text-xs text-destructive">{createErrors['scopes']}</p>
                )}
              </div>
              <Button variant="primary" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
                {t('profile.create_api_key')}
              </Button>
            </div>

            {/* Created Token Display */}
            {createdToken && (
              <div className="rounded-md border border-accent bg-accent-subtle p-3">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  <ShieldCheck className="size-3.5 text-accent" />
                  {t('profile.api_key_created_note')}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-surface px-2 py-1.5 font-mono text-[13px]">
                    {createdToken}
                  </code>
                  <Button
                    size="icon-dense"
                    variant="ghost"
                    onClick={handleCopyToken}
                    aria-label={t('profile.copy_token', 'Copy token')}
                  >
                    {copiedToken ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                  <Button
                    size="icon-dense"
                    variant="ghost"
                    onClick={() => setCreatedToken(null)}
                    aria-label={t('profile.hide_token', 'Hide token')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* API Keys List */}
            <div className="divide-y divide-border">
              {loadingKeys ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-accent" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Key className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium mt-3">{t('profile.no_api_keys')}</p>
                  <p className="mt-1 text-[13px] text-secondary-foreground">
                    {t('profile.scopes_hint')}
                  </p>
                </div>
              ) : (
                apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className={cn('flex items-center gap-3 px-4 py-3', k.revoked && 'opacity-60')}
                  >
                    <Key className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{k.name || '—'}</span>
                        {k.scopes.map((scope) => (
                          <Badge key={scope} variant="counter">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('profile.created', { date: new Date(k.created_at).toLocaleString() })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={k.revoked ? 'revoked' : 'active'}>
                        {k.revoked ? t('profile.revoked', 'Revoked') : t('profile.active', 'Active')}
                      </Badge>
                      {!k.revoked && (
                        <Button variant="outline" size="sm" onClick={() => setRevokeId(k.id)}>
                          {t('profile.revoke')}
                        </Button>
                      )}
                      <Button
                        variant="ghost-destructive"
                        size="icon-dense"
                        onClick={() => setDeleteId(k.id)}
                        aria-label={t('profile.delete_key', 'Delete key')}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('profile.revoke_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>
              {t('profile.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('profile.delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
