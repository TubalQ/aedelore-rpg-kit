const ART = "/uploads/images/gallery/2025-09/scaled-1680-";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-base px-4">
      <img
        src={`${ART}/the-sunken-city.webp`}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_58%]"
        style={{ filter: "brightness(.5) saturate(.85)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 85% at 50% 50%, rgba(10,10,15,.35), var(--color-bg-base) 84%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
