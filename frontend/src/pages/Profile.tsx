import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { apiClient } from '@/api/client';
import type { ApiKey } from '@/types';
import { UserMenu } from '@/components/UserMenu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChevronLeft, Key, X, Loader2, Copy, Check, Trash2, Globe, ListTodo } from 'lucide-react';

export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const currentLang = i18n.language || 'en';

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

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

  const handleCreate = async () => {
    const scopesArr = scopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setCreating(true);
    try {
      const resp = await apiClient.createApiKey({ name: name || null, scopes: scopesArr });
      setCreatedToken(resp.token);
      toast.success(t('profile.created_notify'));
      try {
        await navigator.clipboard.writeText(resp.token);
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } catch {
        // ignore clipboard errors
      }
      setName('');
      setScopes('');
      fetchKeys();
    } catch (err) {
      console.error('Create API key failed:', err);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <ListTodo className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    {t('profile.title')}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('profile.description')}
                  </p>
                </div>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Language Settings */}
        <Card className="bg-white dark:bg-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-violet-500" />
              {t('profile.settings_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 max-w-sm">
              <div className="grid gap-2">
                <Label htmlFor="language">{t('profile.label_language')}</Label>
                <select
                  id="language"
                  value={currentLang}
                  onChange={handleLangChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="bg-white dark:bg-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5 text-violet-500" />
              {t('profile.api_keys_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create API Key Form */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="key-name">{t('profile.label_name')}</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My bot key"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="key-scopes">{t('profile.label_scopes')}</Label>
                  <Input
                    id="key-scopes"
                    value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                    placeholder="read,write"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.scopes_hint')}</p>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-violet-500 hover:bg-violet-600"
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('profile.create_api_key')}
              </Button>
            </div>

            {/* Created Token Display */}
            {createdToken && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <code className="block text-sm font-mono break-all bg-white dark:bg-slate-800 p-2 rounded border border-green-200 dark:border-green-700">
                      {createdToken}
                    </code>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                      {t('profile.api_key_created_note')}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopyToken}
                      className="h-8 w-8"
                    >
                      {copiedToken ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCreatedToken(null)}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('profile.your_api_keys')}
              </h3>

              {loadingKeys ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                </div>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                  {t('profile.no_api_keys')}
                </p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {k.name || '—'}
                          </span>
                          {k.revoked && (
                            <Badge variant="destructive" className="text-xs">
                              {t('profile.revoked')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {t('profile.scopes_label', { scopes: k.scopes.join(', ') || '—' })}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {t('profile.created', { date: new Date(k.created_at).toLocaleString() })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!k.revoked ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRevokeId(k.id)}
                          >
                            {t('profile.revoke')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(k.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}