"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n";

interface LoginEntry {
  id: number;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  method: string | null;
  createdAt: string;
}

export function LoginHistorySection() {
  const { t, locale } = useT();
  const { data: history, isLoading } = useQuery({
    queryKey: ["login-history"],
    queryFn: () => api<LoginEntry[]>("/api/account/login-history"),
  });

  return (
    <section>
      <h2 className="font-display text-lg text-text-base mb-4 flex items-center gap-2">
        <Shield size={18} />
        {t("settings.loginHistory")}
      </h2>

      {isLoading && (
        <p className="text-sm text-text-muted">{t("common.loading")}</p>
      )}

      {history && history.length === 0 && (
        <p className="text-sm text-text-muted">{t("settings.noLoginHistory")}</p>
      )}

      {history && history.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-elevated text-text-muted">
                <th className="text-left px-4 py-2 font-medium">{t("settings.time")}</th>
                <th className="text-left px-4 py-2 font-medium">{t("settings.method")}</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">IP</th>
                <th className="text-left px-4 py-2 font-medium">{t("settings.status")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  {/* Local time: the server renders in its own time zone, so the
                      text differs on hydration (React #418, #81). */}
                  <td className="px-4 py-2 text-text-muted" suppressHydrationWarning>
                    {new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-GB" : "sv-SE")}
                  </td>
                  <td className="px-4 py-2 text-text-muted uppercase text-xs">
                    {entry.method ?? t("settings.unknownMethod")}
                  </td>
                  <td className="px-4 py-2 text-text-faint hidden sm:table-cell font-mono text-xs">
                    {entry.ipAddress ?? "-"}
                  </td>
                  <td className="px-4 py-2">
                    {entry.success ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-accent-green">
                        <CheckCircle size={14} aria-hidden="true" />
                        {t("settings.loginOk")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-accent-red">
                        <XCircle size={14} aria-hidden="true" />
                        {t("settings.loginFailed")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
