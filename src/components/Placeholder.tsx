// Marks text that is waiting for your own words.
//
// On the page it shows with a dashed gold outline and a small "Your words"
// label, so you can spot it at a glance.
// In the code, search for "PLACEHOLDER" (Cmd + Shift + F in VS Code) to find
// every one. To replace one, delete the whole <Placeholder ...> ... </Placeholder>
// and type your own text in its place.

// On/off switch for every placeholder on the site.
//   false = hidden: visitors don't see them (the code stays, ready for later).
//   true  = shown with the dashed outline, to help you find them while editing.
const SHOW_PLACEHOLDERS = false;

type PlaceholderProps = {
  /** A short note to yourself about what to write here. */
  hint: string;
  /** Example text shown on the page until you replace it. */
  children: React.ReactNode;
  /** Use "block" for whole paragraphs, "inline" for a few words in a sentence. */
  as?: "block" | "inline";
};

export default function Placeholder({ hint, children, as = "block" }: PlaceholderProps) {
  if (!SHOW_PLACEHOLDERS) {
    return null;
  }

  if (as === "inline") {
    return (
      <mark className="placeholder placeholder-inline" title={`Placeholder: ${hint}`}>
        {children}
      </mark>
    );
  }

  return (
    <div className="placeholder" title={`Placeholder: ${hint}`}>
      <span className="placeholder-label">Your words · {hint}</span>
      {children}
    </div>
  );
}
