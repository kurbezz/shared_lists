import React from 'react';
import { apiClient } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Twitch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const handleLogin = () => {
    window.location.href = apiClient.getLoginUrl();
  };

  return (
    <div className="min-h-screen grid items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg">
            <svg
              className="w-8 h-8 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold">{t('login.title')}</CardTitle>
          <CardDescription className="text-lg mt-2">
            {t('login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-3">
            {[
              t('login.feature_1'),
              t('login.feature_2'),
              t('login.feature_3'),
              t('login.feature_4')
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-sm text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pt-2">
          <Button
            className="w-full gap-2 text-lg h-12 bg-[#9146FF] hover:bg-[#9146FF]/90 text-white"
            size="lg"
            onClick={handleLogin}
          >
            <Twitch className="w-5 h-5" />
            {t('login.twitch_login')}
          </Button>
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('login.twitch_disclaimer')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('login.secure_auth')}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};