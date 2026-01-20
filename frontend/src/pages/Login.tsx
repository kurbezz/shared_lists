import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, ListTodo } from 'lucide-react';

export function Login() {
  const { t } = useTranslation();

  const handleLogin = () => {
    window.location.href = apiClient.getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30">
            <ListTodo className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            {t('login.title')}
          </CardTitle>
          <CardDescription className="text-base mt-2 text-slate-600 dark:text-slate-400">
            {t('login.description')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6 px-8">
          <div className="grid gap-4">
            {[
              t('login.feature_1'),
              t('login.feature_2'),
              t('login.feature_3'),
              t('login.feature_4')
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-6 pt-4 pb-8 px-8">
          <Button
            className="w-full gap-3 text-base h-12 bg-[#9146FF] hover:bg-[#7c3aed] text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40"
            size="lg"
            onClick={handleLogin}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            {t('login.twitch_login')}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {t('login.twitch_disclaimer')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-600">
              {t('login.secure_auth')}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}