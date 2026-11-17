"use client";

// The form contributors use to share a memory. No account needed.

import { useActionState, useState } from "react";
import type { MemoryFields, MemoryFormState } from "@/app/contribute/actions";
import FormError from "@/components/auth/FormError";
import { memoryLimits, memoryPrompts } from "@/lib/invites";

type MemoryFormProps = {
  action: (state: MemoryFormState, formData: FormData) => Promise<MemoryFormState>;
  /** The name to use in the wording, e.g. "Peggy". */
  personName: string;
};

export default function MemoryForm({ action, personName }: MemoryFormProps) {
  const [state, formAction, pending] = useActionState<MemoryFormState, FormData>(action, {});
  // Shows the form again after "Add another memory".
  const [addingAnother, setAddingAnother] = useState(0);
  const [lastSentKey, setLastSentKey] = useState<MemoryFormState | null>(null);
  const showThanks = state.sent && lastSentKey !== state;

  if (showThanks) {
    const firstName = state.values?.contributor_name.split(/\s+/)[0] ?? "";
    return (
      <div className="thank-you" role="status">
        <h2>Thank you{firstName ? `, ${firstName}` : ""}</h2>
        <p>
          Your memory of {personName} has been sent to the family. It will mean
          a great deal to them.
        </p>
        <p>If something else comes to mind, you&rsquo;re very welcome to add another.</p>
        <div className="actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setLastSentKey(state);
              setAddingAnother((n) => n + 1);
            }}
          >
            Add another memory
          </button>
        </div>
      </div>
    );
  }

  // After sending, keep their name, email and relationship, but start a fresh memory.
  const justSent = lastSentKey === state;
  const values: Partial<MemoryFields> = justSent
    ? {
        contributor_name: state.values?.contributor_name,
        contributor_email: state.values?.contributor_email,
        relationship: state.values?.relationship,
      }
    : (state.values ?? {});
  const errors = justSent ? {} : (state.fieldErrors ?? {});

  const errorProps = (name: keyof MemoryFields, hintId?: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby":
      [hintId, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const fieldError = (name: keyof MemoryFields) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form
      action={formAction}
      className="form"
      key={`${addingAnother}-${JSON.stringify(state.values ?? {})}`}
      noValidate
    >
      {/* When the form appeared, for spam protection (robots send instantly) */}
      <input
        type="hidden"
        name="started_at"
        ref={(el) => {
          if (el && !el.value) el.value = String(Date.now());
        }}
      />

      {/* Hidden from people; catches automated spam */}
      <p className="visually-hidden" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="field">
        <label htmlFor="contributor_name">Your name</label>
        <input
          id="contributor_name"
          name="contributor_name"
          type="text"
          autoComplete="name"
          maxLength={memoryLimits.contributor_name}
          defaultValue={values.contributor_name ?? ""}
          required
          {...errorProps("contributor_name")}
        />
        {fieldError("contributor_name")}
      </div>

      <div className="field">
        <label htmlFor="contributor_email">Your email</label>
        <input
          id="contributor_email"
          name="contributor_email"
          type="email"
          autoComplete="email"
          maxLength={memoryLimits.contributor_email}
          defaultValue={values.contributor_email ?? ""}
          required
          {...errorProps("contributor_email", "contributor_email-hint")}
        />
        <p id="contributor_email-hint" className="field-hint">
          Only the person who invited you will see this, in case they&rsquo;d
          like to thank you or ask about your memory.
        </p>
        {fieldError("contributor_email")}
      </div>

      <div className="field">
        <label htmlFor="relationship">How you knew {personName}</label>
        <input
          id="relationship"
          name="relationship"
          type="text"
          maxLength={memoryLimits.relationship}
          defaultValue={values.relationship ?? ""}
          required
          {...errorProps("relationship", "relationship-hint")}
        />
        <p id="relationship-hint" className="field-hint">
          For example, &ldquo;granddaughter&rdquo;, &ldquo;school friend&rdquo; or
          &ldquo;neighbour for 30 years&rdquo;.
        </p>
        {fieldError("relationship")}
      </div>

      <div className="field">
        <label htmlFor="memory">Your memory</label>
        <div id="memory-prompts" className="prompts">
          <p>If you&rsquo;re not sure where to begin, you might think about:</p>
          <ul>
            {memoryPrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <p>Write as much or as little as you like.</p>
        </div>
        <textarea
          id="memory"
          name="memory"
          rows={12}
          maxLength={memoryLimits.memory}
          defaultValue={values.memory ?? ""}
          required
          {...errorProps("memory", "memory-prompts")}
        />
        {fieldError("memory")}
      </div>

      <div className="field">
        <label htmlFor="sayings">
          Favourite sayings or quotes of theirs <span className="optional">(optional)</span>
        </label>
        <textarea
          id="sayings"
          name="sayings"
          rows={3}
          maxLength={memoryLimits.sayings}
          defaultValue={values.sayings ?? ""}
          {...errorProps("sayings", "sayings-hint")}
        />
        <p id="sayings-hint" className="field-hint">
          Something they often said, a family phrase, or words they lived by.
        </p>
        {fieldError("sayings")}
      </div>

      <FormError message={justSent ? undefined : state.error} />

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Sending…" : "Send my memory"}
        </button>
      </div>
    </form>
  );
}
