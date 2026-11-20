// Shared details for private invite links and memories.
// (New link codes are made on the server only: see src/app/my-books/actions.ts.)

/** True if text could be a link code (so we never send nonsense to the database). */
export function isInviteToken(value: string) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

/** The path a contributor opens, e.g. /contribute/3f9a… */
export function invitePath(token: string) {
  return `/contribute/${token}`;
}

/** Longest each answer can be (the database checks these too). */
export const memoryLimits = {
  contributor_name: 100,
  contributor_email: 254,
  relationship: 100,
  memory: 10000,
  sayings: 2000,
} as const;

/** Gentle prompts shown above the memory box. Edit them here. */
/** The suggested length of a memory, shown to contributors. */
export const SUGGESTED_WORDS = { min: 100, max: 200 };

export const memoryPrompts = [
  "How did you meet?",
  "A time they made you laugh",
  "Something they taught you",
  "A place, a meal or a song that reminds you of them",
  "What you'd like the family to know about them",
];
