// Shows a problem with a form in plain words, and announces it to screen readers.
export default function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
