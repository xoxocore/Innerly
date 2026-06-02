"use client";

import { useState } from "react";
import { Plus, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/innerly/screen-header";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { gradient } from "@/lib/content";
import { ACCENTS } from "@/lib/types";
import { useVisionBoard, uid } from "@/state/use-data";

const c = copy.visionBoard;

export function VisionBoard() {
  const [years, setYears] = useVisionBoard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemInput, setItemInput] = useState("");

  const active =
    years.find((y) => y.id === selectedId) ?? years[0] ?? null;

  const addYear = () => {
    const label = String(new Date().getFullYear() + years.length);
    const y = { id: uid(), year: label, items: [] };
    setYears((prev) => [...prev, y]);
    setSelectedId(y.id);
  };

  const addItem = () => {
    if (!active) return;
    const title = itemInput.trim();
    if (!title) return;
    const accent = ACCENTS[active.items.length % ACCENTS.length];
    setYears((prev) =>
      prev.map((y) =>
        y.id === active.id
          ? {
              ...y,
              items: [
                ...y.items,
                { id: uid(), title, gradient: [...accent] as [string, string] },
              ],
            }
          : y
      )
    );
    setItemInput("");
  };

  const removeItem = (itemId: string) => {
    if (!active) return;
    setYears((prev) =>
      prev.map((y) =>
        y.id === active.id
          ? { ...y, items: y.items.filter((i) => i.id !== itemId) }
          : y
      )
    );
  };

  return (
    <div>
      <ScreenHeader breadcrumb={c.breadcrumb} title={c.title} subtitle={c.subtitle} />

      {/* Year selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {years.map((y) => (
          <button
            key={y.id}
            onClick={() => setSelectedId(y.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active?.id === y.id
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {y.year}
          </button>
        ))}
        <button
          onClick={addYear}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add year
        </button>
      </div>

      {!active ? (
        <Card className="p-10 text-center">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Add a year to start gathering what you&apos;re building toward.
          </p>
        </Card>
      ) : (
        <>
          <form
            className="mb-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
          >
            <input
              value={itemInput}
              onChange={(e) => setItemInput(e.target.value)}
              placeholder={`What are you building toward in ${active.year}?`}
              className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-ring"
            />
            <Button type="submit" size="icon" aria-label="Add vision">
              <Plus className="h-5 w-5" />
            </Button>
          </form>

          {active.items.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Nothing here yet. Add the first thing you&apos;re calling in.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.items.map((item) => (
                <Card key={item.id} className="group overflow-hidden">
                  <div
                    className="h-32 w-full"
                    style={{
                      backgroundImage: gradient(item.gradient ?? ACCENTS[0]),
                    }}
                  />
                  <div className="flex items-start justify-between gap-3 p-5">
                    <p className="text-[15px] font-medium text-heading">
                      {item.title}
                    </p>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
