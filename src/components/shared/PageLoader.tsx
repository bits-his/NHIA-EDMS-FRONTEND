export function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/logo.png"
          alt="NHIA"
          className="h-10 w-auto object-contain opacity-80"
        />
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-border" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground animate-pulse tracking-widest uppercase">
          Loading…
        </p>
      </div>
    </div>
  );
}
