import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      login(token);
    } else {
      navigate('/login');
    }
  }, [searchParams, login, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-sm shadow-lg text-center p-6">
        <CardContent className="flex flex-col items-center justify-center p-6 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{t('auth.callback_title')}</h2>
            <p className="text-muted-foreground text-sm">{t('auth.callback_desc')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};