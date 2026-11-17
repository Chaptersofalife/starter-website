"use client";

// The form for starting a book and for editing its details.

import Link from "next/link";
import { useActionState } from "react";
import type { BookFields, BookFormState } from "@/app/my-books/actions";
import FormError from "@/components/auth/FormError";
import { earliestDate, limits } from "@/lib/books";

type BookFormProps = {
  action: (state: BookFormState, formData: FormData) => Promise<BookFormState>;
  /** The book's current details, when editing. */
  initial?: Partial<BookFields>;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

export default function BookForm({
  action,
  initial = {},
  submitLabel,
  pendingLabel,
  cancelHref,
}: BookFormProps) {
  const [state, formAction, pending] = useActionState<BookFormState, FormData>(action, {});
  const values = { ...initial, ...state.values };
  const errors = state.fieldErrors ?? {};

  // Props that link a box to its error message, for screen readers too.
  const errorProps = (name: keyof BookFields, hintId?: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby":
      [hintId, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const fieldError = (name: keyof BookFields) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    // `key` resets the boxes to what was typed after each attempt.
    <form action={formAction} className="form" key={JSON.stringify(state.values ?? {})} noValidate>
      <div className="field">
        <label htmlFor="full_name">Their full name</label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="off"
          maxLength={limits.full_name}
          defaultValue={values.full_name ?? ""}
          required
          {...errorProps("full_name")}
        />
        {fieldError("full_name")}
      </div>

      <div className="field">
        <label htmlFor="known_as">
          The name they were known by <span className="optional">(optional)</span>
        </label>
        <input
          id="known_as"
          name="known_as"
          type="text"
          autoComplete="off"
          maxLength={limits.known_as}
          defaultValue={values.known_as ?? ""}
          {...errorProps("known_as", "known_as-hint")}
        />
        <p id="known_as-hint" className="field-hint">
          For example, &ldquo;Peggy&rdquo; or &ldquo;Grandad Joe&rdquo;.
        </p>
        {fieldError("known_as")}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            min={earliestDate}
            defaultValue={values.date_of_birth ?? ""}
            required
            {...errorProps("date_of_birth")}
          />
          {fieldError("date_of_birth")}
        </div>

        <div className="field">
          <label htmlFor="date_of_death">Date they died</label>
          <input
            id="date_of_death"
            name="date_of_death"
            type="date"
            min={earliestDate}
            defaultValue={values.date_of_death ?? ""}
            required
            {...errorProps("date_of_death")}
          />
          {fieldError("date_of_death")}
        </div>
      </div>

      <div className="field">
        <label htmlFor="lived_in">
          Where they lived <span className="optional">(optional)</span>
        </label>
        <input
          id="lived_in"
          name="lived_in"
          type="text"
          autoComplete="off"
          maxLength={limits.lived_in}
          defaultValue={values.lived_in ?? ""}
          {...errorProps("lived_in", "lived_in-hint")}
        />
        <p id="lived_in-hint" className="field-hint">
          A town, a county, or a few places, for example &ldquo;Whitby, and later York&rdquo;.
        </p>
        {fieldError("lived_in")}
      </div>

      <div className="field">
        <label htmlFor="introduction">
          A short introduction <span className="optional">(optional)</span>
        </label>
        <textarea
          id="introduction"
          name="introduction"
          rows={6}
          maxLength={limits.introduction}
          defaultValue={values.introduction ?? ""}
          {...errorProps("introduction", "introduction-hint")}
        />
        <p id="introduction-hint" className="field-hint">
          A few words about who they were. You can change this at any time.
        </p>
        {fieldError("introduction")}
      </div>

      <FormError message={state.error} />

      <div className="actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="button button-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
