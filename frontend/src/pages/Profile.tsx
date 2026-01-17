import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import UserMenu from '../components/UserMenu';
import i18n from '../i18n';
import { useToast } from '@/components/ui/toast';

export const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useToast();

  const currentLang = i18n.language || 'en';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    notify(t('profile.saved'));
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </div>
    </div>
  );
};
