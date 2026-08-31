"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Eye, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageCropper } from "@/components/innerly/image-cropper";
import {
  deletePost, savePost, uploadPostImage, type Post, type PostKind,
} from "@/lib/posts";
import { Editor } from "./editor";

/** Turns a title into the bit that appears in the address. */
function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

const field =
  "h-11 w-full rounded-2xl border border-border bg-card px-4 text-[14px] outline-none transition-colors focus:border-[var(--brand-green)]";

export function PostForm({
  post,
  kind,
  onClose,
}: {
  post: Post | null;
  kind: PostKind;
  onClose: (changed: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [category, setCategory] = useState(post?.category ?? "");
  const [duration, setDuration] = useState(post?.duration ?? "");
  const [cover, setCover] = useState(post?.cover_path ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<false | "save" | "publish" | "cover">(false);
  const [cropping, setCropping] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setTitleAndSlug = (next: string) => {
    setTitle(next);
    if (!slugEdited) setSlug(slugify(next));
  };

  const save = async (publish: boolean) => {
    setBusy(publish ? "publish" : "save");
    setError(null);
    try {
      await savePost({
        ...(post?.id ? { id: post.id } : {}),
        kind,
        slug: slug || slugify(title) || crypto.randomUUID().slice(0, 8),
        title: title.trim(),
        excerpt: excerpt.trim(),
        content,
        category: kind === "blog" ? category.trim() || null : null,
        duration: kind === "tutorial" ? duration.trim() || null : null,
        cover_path: cover || null,
        published: publish,
        published_at: post?.published_at ?? null,
      });
      onClose(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
      setBusy(false);
    }
  };

  // Chosen, then framed, then uploaded. Nothing is sent until somebody has
  // said which part of the picture is the picture.
  const pickCover = (file?: File) => {
    if (!file) return;
    setError(null);
    setCropping(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadCropped = async (blob: Blob) => {
    setCropping(null);
    setBusy("cover");
    setError(null);
    try {
      setCover(await uploadPostImage(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image would not upload.");
    } finally {
      setBusy(false);
    }
  };

  const canSave = title.trim().length > 0;

  return (
    <div>
      {cropping && (
        <ImageCropper
          file={cropping}
          // The same shape the card and the article header use, so what is
          // framed here is what appears in both.
          aspect={16 / 9}
          title="Frame the cover"
          onCancel={() => setCropping(null)}
          onDone={uploadCropped}
        />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onClose(false)}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All writing
        </button>

        <span className="text-[13px] text-muted-foreground">
          {post ? (post.published ? "Published" : "Draft") : "New"} &middot;{" "}
          {kind === "blog" ? "Blog post" : "Tutorial"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPreview((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? "Keep writing" : "Preview"}
          </button>
          <button
            onClick={() => save(false)}
            disabled={!canSave || !!busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={!canSave || !!busy}
            style={{ backgroundColor: "var(--brand-green-strong)" }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
            {post?.published ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12.5px] text-destructive">
          {error}
        </p>
      )}

      {preview ? (
        <article className="mx-auto max-w-[680px]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="mb-6 w-full rounded-2xl border border-border" />
          )}
          <h1 className="title-regular text-[1.9rem] leading-tight tracking-tight text-heading">
            {title || "Untitled"}
          </h1>
          {excerpt && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{excerpt}</p>
          )}
          <div
            className="post-body mt-7 text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div>
            <input
              value={title}
              onChange={(e) => setTitleAndSlug(e.target.value)}
              placeholder="Title"
              aria-label="Title"
              className="mb-3 w-full bg-transparent text-[1.6rem] font-normal leading-tight tracking-tight text-heading outline-none placeholder:text-muted-foreground/50"
            />
            <Editor value={content} onChange={setContent} />
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-[57px] lg:self-start">
            <Box label="Cover picture">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-dashed border-border bg-secondary">
                {cover ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setCover("")}
                      aria-label="Remove cover"
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur hover:bg-background"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[12px]">None yet</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickCover(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy === "cover"}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-accent disabled:opacity-60"
              >
                {busy === "cover" ? "Uploading…" : cover ? "Replace" : "Choose a picture"}
              </button>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                You choose the framing — nothing is cropped for you.
              </p>
            </Box>

            <Box label="Summary" hint="Shown on the card, before anyone opens it.">
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={4}
                placeholder="A sentence or two…"
                aria-label="Summary"
                className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-green)]"
              />
            </Box>

            {kind === "blog" ? (
              <Box label="Category">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Patterns"
                  aria-label="Category"
                  className={cn(field, "h-10 text-[13px]")}
                />
              </Box>
            ) : (
              <Box label="How long it takes">
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 4 min"
                  aria-label="How long it takes"
                  className={cn(field, "h-10 text-[13px]")}
                />
              </Box>
            )}

            <Box label="Address" hint="The bit after /blog/. Changing it breaks old links.">
              <input
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                aria-label="Address"
                className={cn(field, "h-10 font-mono text-[12px]")}
              />
            </Box>

            {post && (
              <div className="rounded-2xl border border-destructive/25 p-3.5">
                {confirmDelete ? (
                  <>
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      Delete this for good? Anyone reading it will get a missing page.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="h-9 flex-1 rounded-full text-[12.5px] text-muted-foreground hover:text-foreground"
                      >
                        Keep it
                      </button>
                      <button
                        onClick={async () => {
                          await deletePost(post.id);
                          onClose(true);
                        }}
                        className="h-9 flex-1 rounded-full bg-destructive text-[12.5px] font-medium text-white hover:opacity-90"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete this
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Box({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
