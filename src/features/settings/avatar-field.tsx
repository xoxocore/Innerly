"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { MAX_BYTES, avatarsEnabled, removeAvatar, signAvatar, uploadAvatar } from "@/lib/avatar";
import { useApp } from "@/state/app-context";
import { Note, QuietButton } from "./parts";

/** Their initial, for before there is a picture and while one is loading. */
function Initial({ name }: { name: string }) {
  return (
    <span
      style={{ backgroundColor: "var(--brand-green-strong)" }}
      className="grid h-full w-full place-items-center text-[20px] font-medium text-white"
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function AvatarField() {
  const { profile, setProfile } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = profile?.avatarPath ?? null;
  const usable = avatarsEnabled();

  // Derived rather than stored, so removing the photo or swapping it needs no
  // setState on the way in — the link simply stops matching the current path.
  const url = path && link?.path === path ? link.url : null;

  useEffect(() => {
    if (!path) return;
    let live = true;
    signAvatar(path).then((u) => {
      if (live && u) setLink({ path, url: u });
    });
    return () => {
      live = false;
    };
  }, [path]);

  const choose = async (chosen: File | undefined) => {
    if (!chosen || !profile) return;
    setError(null);

    if (!chosen.type.startsWith("image/")) {
      setError("That needs to be an image.");
      return;
    }
    // Checked before the resize rather than after: the resize decodes the whole
    // thing into memory, and a 200MB file should be turned away, not decoded.
    if (chosen.size > MAX_BYTES) {
      setError("That image is too large. Anything under 8MB is fine.");
      return;
    }

    setBusy(true);
    try {
      // The old pictures go first. Upload then delete-everything would race and
      // could take away the one just added.
      await removeAvatar();
      const next = await uploadAvatar(chosen);
      setProfile({ ...profile, avatarPath: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't upload.");
    } finally {
      setBusy(false);
      // Cleared so choosing the same file again still fires a change event.
      if (file.current) file.current.value = "";
    }
  };

  const clear = async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      await removeAvatar();
      setProfile({ ...profile, avatarPath: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border/60">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <Initial name={profile?.firstName ?? "?"} />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <QuietButton
              onClick={() => file.current?.click()}
              disabled={busy || !usable}
            >
              <Camera className="h-3.5 w-3.5" />
              {path ? "Change photo" : "Add a photo"}
            </QuietButton>
            {path && (
              <QuietButton onClick={clear} disabled={busy}>
                Remove
              </QuietButton>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {usable
              ? "Only you ever see this. It is stored privately, and the location tag phones add to photos is stripped before it leaves your device."
              : "Sign in to add a photo — it needs somewhere to be stored."}
          </p>
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        aria-label="Profile photo"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <Note text={error} bad />
    </div>
  );
}
