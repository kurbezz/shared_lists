import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import UserMenu from '../components/UserMenu';
import i18n from '../i18n';
import { useToast } from '@/components/ui/useToast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { ApiKey } from '@/types';

export const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useToast();

  const currentLang = i18n.language || 'en';

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    notify(t('profile.saved'));
  };

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const keys = await apiClient.getApiKeys();
      setApiKeys(keys);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      notify(t('profile.fetch_failed'));
    } finally {
      setLoadingKeys(false);
    }
  }, [notify, t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    const scopesArr = scopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const resp = await apiClient.createApiKey({ name: name || null, scopes: scopesArr });
      setCreatedToken(resp.token);
      notify(t('profile.created_notify'));
      try {
        await navigator.clipboard.writeText(resp.token);
      } catch {
        // ignore clipboard errors
      }
      setName('');
      setScopes('');
      fetchKeys();
    } catch (err) {
      console.error('Create API key failed:', err);
      const msg = err instanceof Error ? err.message : String(err) || t('profile.create_failed');
      notify(msg);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t('profile.revoke_confirm'))) return;
    try {
      await apiClient.revokeApiKey(id);
      notify(t('profile.revoked_success'));
      fetchKeys();
    } catch {
      notify(t('profile.revoke_failed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('profile.delete_confirm'))) return;
    try {
      await apiClient.deleteApiKey(id);
      notify(t('profile.delete_success'));
      fetchKeys();
    } catch {
      notify(t('profile.delete_failed'));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
              <p className="text-muted-foreground text-sm">{t('profile.description')}</p>
            </div>
            <div className="flex items-center gap-2">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.settings_title')}</CardTitle>
          </CardHeader>

          <div className="grid gap-4 p-6">
            <div className="grid gap-2">
              <Label htmlFor="language">{t('profile.label_language')}</Label>
              <select id="language" value={currentLang} onChange={handleChange} className="rounded border px-3 py-2">
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.api_keys_title')}</CardTitle>
          </CardHeader>

          <div className="p-6 grid gap-4">
            <div>
              <Label>{t('profile.label_name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My bot key" />
            </div>

            <div>
              <Label>{t('profile.label_scopes')}</Label>
              <Input value={scopes} onChange={(e) => setScopes(e.target.value)} placeholder="read,write" />
              <p className="text-sm text-muted-foreground mt-1">{t('profile.scopes_hint')}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} data-cy="create-api-key">{t('profile.create_api_key')}</Button>
            </div>

            {createdToken && (
              <div className="mt-2 px-3 py-2 bg-muted rounded flex items-start justify-between" data-cy="created-token-block">
                <div className="flex-1">
                  <div className="text-sm font-mono break-all">{createdToken}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t('profile.api_key_created_note')}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCreatedToken(null)} data-cy="close-created-token" className="ml-4">
                  <X className="h-4 w-4" />
                  <span className="sr-only">{t('common.cancel')}</span>
                </Button>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">{t('profile.your_api_keys')}</h3>

              {loadingKeys ? (
                <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
              ) : apiKeys.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('profile.no_api_keys')}</div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{k.name || '—'}</div>
                        <div className="text-sm text-muted-foreground">{t('profile.scopes_label', { scopes: k.scopes.join(', ') || '—' })}</div>
                        <div className="text-sm text-muted-foreground">{t('profile.created', { date: new Date(k.created_at).toLocaleString() })}</div>
                        {k.revoked && <div className="text-xs text-destructive mt-1">{t('profile.revoked')}</div>}
                      </div>

                      <div className="flex items-center gap-2">
                        {!k.revoked ? (
                          <Button variant="destructive" size="sm" onClick={() => handleRevoke(k.id)} data-cy={`revoke-${k.id}`}>
                            {t('profile.revoke')}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(k.id)} data-cy={`delete-${k.id}`}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
