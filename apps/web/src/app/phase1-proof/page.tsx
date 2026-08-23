'use client';
import ContourField from '../../components/ui/ContourField';
import Button, { ButtonLink } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

/** Temporary Phase 1 proof page. Deleted before this branch merges. */
export default function Phase1() {
  return (
    <main className="min-h-screen bg-[var(--ivory)] text-[var(--ink)]">
      <section className="relative bg-[var(--forest)] p-12">
        <ContourField tone="brass" />
        <div className="relative z-10">
          <p data-t="serif" className="font-serif text-5xl text-[var(--ivory)]">Newsreader display</p>
          <p data-t="sans" className="font-sans text-base text-[var(--sand)]">Jost interface face</p>
        </div>
      </section>
      <section className="p-12 flex flex-wrap items-center gap-3">
        <Button variant="solid">Shop collection</Button>
        <Button variant="accent">Add to cart</Button>
        <Button variant="outline">Our story</Button>
        <ButtonLink variant="quiet" href="#">Read more</ButtonLink>
        <Badge status="DELIVERED" /><Badge status="PENDING" /><Badge status="WHATEVER" />
      </section>
      <section className="relative h-40 bg-[var(--cream)]"><ContourField tone="forest" /></section>
    </main>
  );
}
