import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Check, ListTodo } from 'lucide-react';

export function Login() {
  const { t } = useTranslation();

  const handleLogin = () => {
    window.location.href = apiClient.getLoginUrl();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle">
              <ListTodo className="size-5 text-accent" />
            </div>
            <span className="text-xl font-semibold tracking-[-0.01em]">
              {t('login.title')}
            </span>
          </div>

          <p className="mt-2 text-[13px] text-secondary-foreground">
            {t('login.description')}
          </p>

          <hr className="my-5 border-t border-border" />

          <div className="space-y-2.5">
            {[
              t('login.feature_1'),
              t('login.feature_2'),
              t('login.feature_3'),
              t('login.feature_4'),
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="size-4 text-accent" />
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            className="mt-6 w-full gap-3"
            size="lg"
            variant="twitch"
            onClick={handleLogin}
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
            </svg>
            {t('login.twitch_login')}
          </Button>

          <div className="mt-3 space-y-1 text-center">
            <p className="text-xs text-muted-foreground">
              {t('login.twitch_disclaimer')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('login.secure_auth')}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
