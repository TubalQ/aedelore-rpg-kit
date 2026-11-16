"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, Check, Bot } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import { getSystem } from "@/systems/runtime";

// The address is the page's own origin, which only the browser knows. Read
// through useSyncExternalStore: hydration renders the server value and then
// switches, instead of rendering different text on server and client (React
// #418 on /settings, #81).
// The server render has no origin: a relative path until hydration, never a fixed host.
const SERVER_MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "/mcp";
const noSubscribe = () => () => {};
const browserMcpUrl = () => process.env.NEXT_PUBLIC_MCP_URL || `${window.location.origin}/mcp`;
const serverMcpUrl = () => SERVER_MCP_URL;
function useMcpUrl(): string {
  return useSyncExternalStore(noSubscribe, browserMcpUrl, serverMcpUrl);
}

function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        copied
          ? "bg-accent-green/20 text-accent-green"
          : "bg-bg-elevated text-text-muted hover:text-accent-gold hover:bg-accent-gold/10",
      )}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t("settings.mcpCopied") : t("settings.mcpCopy")}
    </button>
  );
}

const CLIENT_CONFIGS = [
  {
    key: "claude" as const,
    titleKey: "settings.mcpClaudeTitle" as const,
    stepsKey: "settings.mcpClaudeSteps" as const,
    color: "text-accent-gold",
    bgColor: "bg-accent-gold/10 border-accent-gold/20",
  },
  {
    key: "chatgpt" as const,
    titleKey: "settings.mcpChatgptTitle" as const,
    stepsKey: "settings.mcpChatgptSteps" as const,
    color: "text-accent-green",
    bgColor: "bg-accent-green/10 border-accent-green/20",
  },
];

export function McpConnectionSection() {
  const { t } = useT();
  const MCP_URL = useMcpUrl();
  const app = getSystem().theme.name;

  return (
    <section>
      <h2 className="font-display text-lg text-text-base mb-2 flex items-center gap-2">
        <Bot size={20} className="text-accent-gold" />
        {t("settings.mcpTitle")}
      </h2>
      <p className="text-sm text-text-muted mb-6">
        {t("settings.mcpDescription", { app })}
      </p>

      <div className="rounded-lg border border-border bg-bg-surface p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {t("settings.mcpUrl")}
          </span>
          <CopyButton text={MCP_URL} />
        </div>
        <code className="block text-sm text-accent-gold bg-bg-base rounded-md px-3 py-2 font-mono select-all break-all">
          {MCP_URL}
        </code>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CLIENT_CONFIGS.map((client) => (
          <div
            key={client.key}
            className={cn(
              "rounded-lg border p-4",
              client.bgColor,
            )}
          >
            <h3 className={cn("font-display text-sm font-medium mb-3", client.color)}>
              {t(client.titleKey)}
            </h3>
            <div className="space-y-1.5">
              {t(client.stepsKey, { app })
                .split("\n")
                .map((step, i) => (
                  <p key={i} className="text-xs text-text-muted leading-relaxed">
                    {step}
                  </p>
                ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted mt-4">
        {t("settings.mcpFeatures")}
      </p>
    </section>
  );
}
