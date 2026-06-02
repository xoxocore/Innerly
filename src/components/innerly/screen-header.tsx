export function ScreenHeader({
  breadcrumb,
  title,
  subtitle,
}: {
  breadcrumb: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {breadcrumb}
      </p>
      <h1 className="mt-3 text-[2.25rem] font-bold leading-[1.1] tracking-tight text-heading">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </header>
  );
}
