"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { useApp } from "@/state/app-context";
import { useReflections, useManifestations } from "@/state/use-data";

const c = copy.history;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function History() {
  const { navigate } = useApp();
  const [reflections] = useReflections();
  const [manifestations] = useManifestations();

  type Entry =
    | { kind: "reflection"; date: string; node: React.ReactNode }
    | { kind: "manifestation"; date: string; node: React.ReactNode };

  const entries: Entry[] = [
    ...reflections.map((r) => ({
      kind: "reflection" as const,
      date: r.date,
      node: (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Reflection
          </p>
          {r.moments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {r.moments.map((m, i) => (
                <li key={i} className="text-[15px] text-foreground">
                  {m.text}
                </li>
              ))}
            </ul>
          )}
          {r.differently && (
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              → {r.differently}
            </p>
          )}
        </>
      ),
    })),
    ...manifestations.map((m) => ({
      kind: "manifestation" as const,
      date: m.savedAt,
      node: (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Manifestation
          </p>
          {m.goals.length > 0 && (
            <ul className="mt-2 space-y-1">
              {m.goals.map((g, i) => (
                <li key={i} className="text-[15px] text-foreground">
                  {g}
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {entries.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Nothing to look back on yet. Your reflections and manifestations will
            gather here.
          </p>
          <Button className="mt-5" onClick={() => navigate("reflect")}>
            {copy.dashboard.remindersCta}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((e, i) => (
            <Card key={i} className="p-5">
              <p className="mb-2 text-sm text-muted-foreground">
                {formatDate(e.date)}
              </p>
              {e.node}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
