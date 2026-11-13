// The calm, centred panel used on the log-in, sign-up and password pages.

type AuthCardProps = {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  /** Links shown under the panel, e.g. "Already have an account? Log in". */
  footer?: React.ReactNode;
};

export default function AuthCard({ title, intro, children, footer }: AuthCardProps) {
  return (
    <main className="auth-page">
      <div className="container">
        <div className="auth-card">
          <h1>{title}</h1>
          {intro && <div className="auth-intro">{intro}</div>}
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}
