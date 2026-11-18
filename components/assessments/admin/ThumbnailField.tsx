"use client";

/* eslint-disable @next/next/no-img-element -- a preview of the uploaded picture, in the admin only. */
import { useId, useState } from "react";
import { adminUpload, ApiClientError } from "@/lib/assessments/client/api";
import { Alert, cx } from "../ui";
import { Field } from "./BuilderFields";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The picture on an assessment's library card. The admin chooses a file; the server stores it and
 * answers with its address, so nobody has to type a web address.
 */
export function ThumbnailField({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const uid = useId();
  const [state, setState] = useState<{ busy: boolean; error: string; uploaded: boolean }>({ busy: false, error: "", uploaded: false });

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setState({ busy: false, error: "Choose a PNG, JPEG, WebP or GIF image.", uploaded: false });
    if (file.size > MAX_BYTES) return setState({ busy: false, error: `The image is larger than ${MAX_BYTES / (1024 * 1024)} MB. Choose a smaller one.`, uploaded: false });
    setState({ busy: true, error: "", uploaded: false });
    try {
      const form = new FormData();
      form.append("file", file);
      const { url } = await adminUpload<{ url: string }>("/api/admin/assessments/thumbnail", form);
      onChange(url);
      setState({ busy: false, error: "", uploaded: true });
    } catch (e) {
      setState({ busy: false, error: e instanceof ApiClientError ? e.message : "The image could not be uploaded. Please try again.", uploaded: false });
    }
  }

  return (
    <Field
      label="Thumbnail image"
      htmlFor={`${uid}-file`}
      optional
      tip="The picture shown at the top of this assessment's card in the library. Choose a file from your computer; it is uploaded for you. A wide picture (16 by 9) looks best."
      hint="PNG, JPEG, WebP or GIF, up to 2 MB. Save the assessment to keep it."
    >
      <input
        id={`${uid}-file`}
        type="file"
        accept={TYPES.join(",")}
        disabled={state.busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again must work
          void upload(file);
        }}
        className={cx("block w-full text-sm text-ink file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-surface hover:file:bg-primary-dark disabled:opacity-60")}
      />
      {state.busy && (
        <p role="status" className="mt-2 text-sm text-ink-soft">
          Uploading…
        </p>
      )}
      {state.uploaded && (
        <p role="status" className="mt-2 text-sm text-primary-dark">
          Image uploaded. Save the assessment to keep it.
        </p>
      )}
      {state.error && (
        <Alert tone="error" className="mt-2">
          {state.error}
        </Alert>
      )}
      {value && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <img src={value} alt="Thumbnail preview" className="aspect-video w-48 rounded-xl border border-primary/15 object-cover" />
          <button
            type="button"
            className="btn-outline px-4 py-2 text-sm"
            onClick={() => {
              onChange("");
              setState({ busy: false, error: "", uploaded: false });
            }}
          >
            Remove image
          </button>
        </div>
      )}
    </Field>
  );
}
