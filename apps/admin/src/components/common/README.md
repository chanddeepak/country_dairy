# Shared console components

Read this before building anything that overlays the page or asks a question.

## `Modal` — every overlay

There were ten hand-rolled overlays in this console and exactly **one** closed
on Escape. Nine dialogs trapped the reader until they found the right pixel
with a mouse. That is what duplicating a backdrop costs: not the markup, which
is cheap, but the behaviour nobody remembers to repeat.

`Modal` owns the backdrop, Escape, click-outside and the body scroll lock.
Anything that floats above the page is built from it — confirmations, editors,
previews, drawers.

```tsx
<Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Order CD-2026-00003" size="lg">
  …
</Modal>
```

`busy` disables Escape, the backdrop and the close button. Set it while
something irreversible is in flight, so a half-finished delete cannot be
dismissed into a state nobody can describe.

## `useConfirm` — asking "are you sure"

Do not hand-roll `pendingDelete` / `isDeleting` / `handleDelete` again. Every
page that grew its own got at least one of these wrong:

- two never passed the busy flag, so a click sat there looking ignored and the
  natural response was to click again;
- most closed the dialog only on success, leaving failures rendered *behind* an
  open dialog where nobody could read them;
- two removed the row from the table before the request went out and swallowed
  the error into `console.warn`, so a delete that never happened still looked
  like it had, until a reload put the row back.

The hook owns all of it. The caller supplies the words and the work:

```tsx
const confirm = useConfirm(setError);   // where the failure message goes

confirm.ask({
  title: 'Delete this review?',
  message: 'You can put it back from the Deleted list.',
  confirmLabel: 'Delete review',
  onConfirm: async () => {
    await adminApi.deleteReview(review.id);   // throw to report failure
    await reload();
  },
});

<ConfirmDialog {...confirm.dialogProps} />
```

Call the API **first**, then update local state. Optimistic removal is only
honest if you also put the row back when the request fails, and nowhere in this
console did.

## `ConfirmDialog`

Built on `Modal`. Reach for it through `useConfirm` rather than driving it with
your own state.

## Still to migrate

These render their own `fixed inset-0` and should move onto `Modal` when next
touched — none of them closes on Escape:

- `pages/AddProductWizard.tsx`
- `pages/CategoryCMS.tsx`
- `pages/DriverView.tsx`
- `pages/Logistics.tsx`
- `pages/ProductEditor.tsx`
- `pages/PurityLabCMS.tsx`
- `pages/Reviews.tsx` (the media preview lightbox)
- `pages/UserManagement.tsx` (create staff, reset password)
- `components/support/OrderPeekModal.tsx` (has Escape already; still its own backdrop)
