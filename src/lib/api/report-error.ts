let pending = false;

export function reportError(error: unknown, errorType = "unhandled"): void {
  if (pending) return;
  pending = true;

  const message =
    error instanceof Error ? error.message : String(error);
  const stack =
    error instanceof Error ? error.stack ?? null : null;

  fetch("/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      errorType,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 10000) ?? null,
      url: window.location.href,
    }),
  })
    .catch(() => {})
    .finally(() => {
      pending = false;
    });
}
