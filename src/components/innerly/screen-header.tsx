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
    <header className="mb-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {breadcrumb}
      </p>
      <h1 className="mt-2.5 text-[1.6rem] font-normal leading-[1.15] tracking-tight text-heading sm:text-[1.9rem]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </header>
  );
}
