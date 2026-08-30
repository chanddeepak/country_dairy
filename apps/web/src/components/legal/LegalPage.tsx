import SiteChrome from '../layout/SiteChrome';

/**
 * The shell every policy and help page shares.
 *
 * One measure, one type scale, one heading rhythm — set here rather than
 * repeated four times, because the thing these pages are judged on is whether
 * they are readable and complete, not whether each one has its own layout.
 */
export default function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <SiteChrome>
      <div className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="font-serif text-3xl font-light text-balance text-[var(--ink)] md:text-4xl">
            {title}
          </h1>
          {intro && (
            <p className="mt-3 font-sans text-sm leading-relaxed text-[var(--ink-soft)]">{intro}</p>
          )}
          <p className="mt-4 font-sans text-xs uppercase tracking-wider text-[var(--ink-soft)]">
            Last updated {updated}
          </p>
        </div>
      </div>

      {/*
        Spacing comes from the flow, not from margins on every child: a policy
        page is a long list of sibling sections, and per-element margins are
        what make one of them silently collapse into its neighbour.
      */}
      <article
        className="
          mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 font-sans text-[15px] leading-relaxed text-[var(--ink)] sm:px-6
          [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-light [&_h2]:text-[var(--ink)]
          [&_h3]:mt-2 [&_h3]:font-sans [&_h3]:text-base [&_h3]:font-semibold
          [&_p]:text-[var(--ink)]
          [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5
          [&_a]:font-medium [&_a]:text-[var(--forest)] [&_a]:underline [&_a]:underline-offset-2
          [&_section]:flex [&_section]:flex-col [&_section]:gap-3
        "
      >
        {children}
      </article>
    </SiteChrome>
  );
}
