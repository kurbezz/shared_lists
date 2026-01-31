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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-xl font-semibold">{t("auth.callback_title")}</h1>
      <p className="text-muted-foreground">{t("auth.callback_desc")}</p>
    </div>
  );
}
