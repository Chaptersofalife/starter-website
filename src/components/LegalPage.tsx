// Shared layout for the Privacy Policy and Terms & Conditions pages.
//
// While `isDraft` is true, a clear "Draft" label shows at the top of the page.
// When a solicitor (or you) has checked the wording, set it to false on that page.

type LegalPageProps = {
  title: string;
  /** The date the wording last changed, written out, e.g. "13 November 2026". */
  lastUpdated: string;
  isDraft?: boolean;
  children: React.ReactNode;
};

export default function LegalPage({ title, lastUpdated, isDraft = true, children }: LegalPageProps) {
  return (
    <main>
      <article className="section">
        <div className="container">
          <div className="legal">
            {isDraft && (
              <p className="draft-notice">
                <strong className="draft-badge">Draft</strong>
                <span>
                  This is a draft. The wording may change before Chapters of a
                  Life opens for orders.
                </span>
              </p>
            )}
            <h1>{title}</h1>
            <p className="legal-updated">Last updated: {lastUpdated}</p>
            {children}
          </div>
        </div>
      </article>
    </main>
  );
}
