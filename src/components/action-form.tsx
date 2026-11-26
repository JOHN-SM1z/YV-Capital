"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cn, type ButtonVariant } from "@/components/ui";
import { useClientStrings } from "@/i18n/client";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Ask for confirmation before submitting (sensitive actions). */
  confirm?: string;
  /** Clear the form after a successful submit. */
  resetOnSuccess?: boolean;
};

export function ActionForm({ action, children, className, confirm, resetOnSuccess }: Props) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state.error && (
        <p role="alert" className="mt-2 rounded-md bg-neg-50 px-3 py-2 text-sm text-neg">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mt-2 rounded-md bg-pos-50 px-3 py-2 text-sm text-pos">
          {state.message}
        </p>
      )}
    </form>
  );
}

type SubmitProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
  "aria-label"?: string;
};

export function SubmitButton({ children, variant = "primary", size = "md", className, name, value, pendingLabel, ...rest }: SubmitProps) {
  const { pending } = useFormStatus();
  const strings = useClientStrings();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-label={rest["aria-label"]} className={cn(buttonClass(variant, size), className)}>
      {pending ? (pendingLabel ?? strings.saving) : children}
    </button>
  );
}

/** Small square checkbox-style toggle used for checklists and follow-ups. */
export function ToggleCheck({ checked, label }: { checked: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={label}
      aria-pressed={checked}
      disabled={pending}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded border text-xs disabled:opacity-50",
        checked ? "border-pos bg-pos text-white" : "border-line bg-card hover:border-brand",
      )}
    >
      {checked ? "✓" : ""}
    </button>
  );
}
