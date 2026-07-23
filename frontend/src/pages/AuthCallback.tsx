import { useEffect } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function AuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    // After OAuth redirect, backend has set httpOnly cookie. Call backend to get current user.
    (async () => {
      try {
        // Log search params and the fact that we are about to call login()
        console.debug(
          "[AuthCallback] searchParams:",
          Array.from(searchParams.entries()),
        );
        console.debug("[AuthCallback] calling login()");
        await login();
        console.debug("[AuthCallback] login() succeeded — navigating to /");
        navigate("/", { replace: true });
      } catch (e) {
        console.error("[AuthCallback] login() failed:", e);
        navigate("/login", { replace: true });
      }
    })();
  }, [searchParams, login, navigate]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="space-y-3 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-accent" />
        <p className="text-sm font-medium">{t("auth.callback_title")}</p>
        <p className="text-xs text-muted-foreground">{t("auth.callback_desc")}</p>
      </div>
    </main>
  );
}
