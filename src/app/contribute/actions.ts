"use server";

// What happens when a contributor sends a memory.
// Contributors have no account. Their memory goes through the database's
// submit_memory() "door", which checks the link and adds just this one
// memory. It can't read or change anything else.

import { isInviteToken, memoryLimits } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export type MemoryFields = {
  contributor_name: string;
  contributor_email: string;
  relationship: string;
  memory: string;
  sayings: string;
};

export type MemoryFormState = {
  /** Set once a memory has been sent. */
  sent?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof MemoryFields, string>>;
  /** What they typed, so nothing is lost if there's a problem. */
  values?: MemoryFields;
};

/** Forms sent faster than this were almost certainly filled in by a robot. */
const MIN_SECONDS_TO_FILL = 3;

function readFields(formData: FormData): MemoryFields {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    contributor_name: get("contributor_name"),
    contributor_email: get("contributor_email"),
    relationship: get("relationship"),
    memory: get("memory"),
    sayings: get("sayings"),
  };
}

function check(values: MemoryFields): MemoryFormState["fieldErrors"] {
  const errors: MemoryFormState["fieldErrors"] = {};
  const tooLong = (n: number) => `Please keep this to ${n.toLocaleString("en-GB")} characters or fewer.`;

  if (!values.contributor_name) errors.contributor_name = "Please tell us your name.";
  else if (values.contributor_name.length > memoryLimits.contributor_name)
    errors.contributor_name = tooLong(memoryLimits.contributor_name);

  if (!values.contributor_email) errors.contributor_email = "Please enter your email address.";
  else if (
    values.contributor_email.length > memoryLimits.contributor_email ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.contributor_email)
  )
    errors.contributor_email = "Please check your email address is typed correctly.";

  if (!values.relationship) errors.relationship = "Please tell us how you knew them.";
  else if (values.relationship.length > memoryLimits.relationship)
    errors.relationship = tooLong(memoryLimits.relationship);

  if (!values.memory) errors.memory = "Please share a memory before sending.";
  else if (values.memory.length > memoryLimits.memory)
    errors.memory = tooLong(memoryLimits.memory);

  if (values.sayings.length > memoryLimits.sayings) errors.sayings = tooLong(memoryLimits.sayings);

  return errors;
}

export async function submitMemory(
  token: string,
  _prev: MemoryFormState,
  formData: FormData,
): Promise<MemoryFormState> {
  const values = readFields(formData);

  // Spam protection 1: a hidden box people never see. Robots fill it in.
  // We pretend it worked, so the robot learns nothing.
  if (String(formData.get("website") ?? "") !== "") {
    return { sent: true, values };
  }

  // Spam protection 2: robots send forms instantly; people take a few seconds.
  const startedAt = Number(formData.get("started_at"));
  if (startedAt && Date.now() - startedAt < MIN_SECONDS_TO_FILL * 1000) {
    return { sent: true, values };
  }

  const fieldErrors = check(values);
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }
  if (!isInviteToken(token)) {
    return { values, error: linkNotWorking };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_memory", {
    invite: token,
    contributor_name: values.contributor_name,
    contributor_email: values.contributor_email,
    relationship: values.relationship,
    memory: values.memory,
    sayings: values.sayings || null,
  });

  if (error) {
    // Spam protection 3: the database limits how fast memories can arrive.
    switch (error.message) {
      case "invite_not_found":
        return { values, error: linkNotWorking };
      case "too_many_memories":
        return {
          values,
          error:
            "Lots of memories have arrived in the last few minutes. Please wait ten minutes and try again. Your words are still here.",
        };
      case "book_full":
        return {
          values,
          error: "This book can't take any more memories. Please contact the person who invited you.",
        };
      case "invalid_memory":
        return { values, error: "Please check your answers and try again." };
      default:
        console.error("Submit memory failed:", error.code, error.message);
        return {
          values,
          error:
            "Sorry, your memory couldn't be sent just now. Please check your connection and try again. Your words are still here.",
        };
    }
  }

  return { sent: true, values };
}

const linkNotWorking =
  "This link is no longer working. Please ask the person who invited you for a new one.";
