'use client';

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * error.tsx sits inside the root layout, so it cannot catch a failure in the
 * layout that renders it. This one replaces the whole document, which is why
 * it has to supply its own <html> and <body> — and why it cannot use the fonts
 * or CSS variables the layout would have set, so the styles here are literal
 * on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          background: '#FAF7F0',
          color: '#1C1C1A',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
          Country Dairy is temporarily unavailable
        </h1>
        <p style={{ margin: 0, color: '#5C5C56', maxWidth: '32rem' }}>
          We hit an unexpected error. Please try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.85rem 2rem',
            border: 0,
            borderRadius: 2,
            background: '#1E3D2F',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#5C5C56' }}>
            Reference: <code>{error.digest}</code>
          </p>
        )}
      </body>
    </html>
  );
}
