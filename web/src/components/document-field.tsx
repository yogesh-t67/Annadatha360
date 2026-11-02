"use client";

import { Eye, FileText, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button, FieldLabel } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { type DocumentRef, uploadDocument, viewDocument } from "@/lib/vendor";

/**
 * A document slot in a form: shows the attached file (View), or lets the person upload one (Upload / Replace).
 * Uploading only stores the file; it's attached when the form is saved (onChange gives the new document).
 */
export function DocumentField({
  label,
  kind,
  value,
  onChange,
  disabled,
  error,
  required,
}: {
  label: string;
  required?: boolean;
  kind: string;
  value: DocumentRef | null;
  onChange: (doc: DocumentRef) => void;
  disabled?: boolean;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setProblem("");
    if (file.size > 10 * 1024 * 1024) {
      setProblem("The file is larger than 10 MB. Take a smaller photo or scan.");
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadDocument(kind, file));
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel id={id} required={required}>
        {label}
      </FieldLabel>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line p-3">
        {value ? (
          <>
            <FileText className="size-4 text-muted" aria-hidden />
            <span className="max-w-[16rem] truncate text-sm">{value.filename}</span>
            <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => viewDocument(value.id).catch(() => setProblem("Couldn't open the file."))}>
              <Eye className="size-4" /> View
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted">No file yet</span>
        )}
        {!disabled && (
          <Button type="button" variant="secondary" className="ml-auto h-8" loading={busy} onClick={() => input.current?.click()} aria-describedby={id}>
            <Upload className="size-4" /> {value ? "Replace" : "Upload"}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <p className="text-xs text-muted">PDF or photo (JPG, PNG), up to 10 MB.</p>
      {(problem || error) && <p className="text-sm text-danger">{problem || error}</p>}
    </div>
  );
}
