import React, { useState } from 'react';
import { Layers, Plus, Trash2, Edit3 } from 'lucide-react';
import { adminApi } from '../services/apiClient';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  displayOrder?: number;
  isActive?: boolean;
  /** Set when this is a type within a category — Desi Ghee under Ghee. */
  parentId?: string | null;
  /** Promoted to the storefront nav bar rather than its dropdown. */
  showInNav?: boolean;
}

interface CategoryCMSProps {
  categories: CategoryItem[];
  onUpdateCategories: (categories: CategoryItem[]) => void;
}

/**
 * The exact shape `CategoryDto` accepts — nothing more.
 *
 * The API runs a global ValidationPipe with `forbidNonWhitelisted`, so a single
 * unexpected property fails the whole request: spreading a CategoryItem into
 * the body sent `id` along with it and every save came back
 * `400 property id should not exist`. Every field is sent every time because
 * the route is a PUT and treats a missing one as "leave it alone", so a partial
 * body is how a toggle used to arrive without the name the DTO requires.
 */
function toCategoryDto(cat: CategoryItem) {
  return {
    name: cat.name,
    slug: cat.slug,
    description: cat.description ?? '',
    iconName: cat.iconName ?? 'Package',
    displayOrder: cat.displayOrder ?? 1,
    isActive: cat.isActive ?? true,
    parentId: cat.parentId ?? null,
    showInNav: cat.showInNav ?? false,
  };
}

/** A slug derived from a name, for new categories only. */
const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function CategoryCMS({ categories, onUpdateCategories }: CategoryCMSProps) {
  const setCategories = (action: CategoryItem[] | ((prev: CategoryItem[]) => CategoryItem[])) => {
    if (typeof action === 'function') {
      onUpdateCategories(action(categories));
    } else {
      onUpdateCategories(action);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  // Form State
  const [nameInput, setNameInput] = useState('');
  const [parentInput, setParentInput] = useState<string>('');
  const [navInput, setNavInput] = useState(false);
  const [descInput, setDescInput] = useState('');
  const [orderInput, setOrderInput] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Only a category can be a parent. Two levels is the whole model, so a type
  // must never be offered as somewhere to put another type.
  const topLevel = categories.filter((c) => !c.parentId);

  const parentName = (cat: CategoryItem) =>
    cat.parentId ? categories.find((c) => c.id === cat.parentId)?.name : undefined;

  const handleOpenAdd = () => {
    setSaveError(null);
    setEditingCategory(null);
    setNameInput('');
    setDescInput('');
    setOrderInput((categories.length + 1).toString());
    setParentInput('');
    setNavInput(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setSaveError(null);
    setEditingCategory(cat);
    setNameInput(cat.name);
    setDescInput(cat.description || '');
    setOrderInput((cat.displayOrder || 1).toString());
    setParentInput(cat.parentId || '');
    setNavInput(!!cat.showInNav);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setSaveError(null);
    setSaving(true);
    const before = categories;

    try {
      if (editingCategory) {
        const updatedCat: CategoryItem = {
          ...editingCategory,
          name: nameInput.trim(),
          // The slug is deliberately kept, not re-derived from the name. It is
          // the category's public URL: regenerating it here meant editing a
          // description silently moved /category/<slug> and broke every link
          // already pointing at it.
          description: descInput.trim(),
          displayOrder: parseInt(orderInput) || 1,
          parentId: parentInput || null,
          // A type lives inside its category's page, never in the bar.
          showInNav: parentInput ? false : navInput,
        };
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? updatedCat : c));
        await adminApi.updateCategory(editingCategory.id, toCategoryDto(updatedCat));
      } else {
        const newCat: CategoryItem = {
          // Provisional, so React has a key until the server replies. It is
          // never sent — the API rejects a body carrying an id outright.
          id: `cat-${Date.now()}`,
          name: nameInput.trim(),
          slug: slugify(nameInput),
          description: descInput.trim(),
          iconName: 'Package',
          displayOrder: parseInt(orderInput) || categories.length + 1,
          isActive: true,
          parentId: parentInput || null,
          showInNav: parentInput ? false : navInput,
        };
        setCategories(prev => [...prev, newCat]);
        const created = await adminApi.createCategory(toCategoryDto(newCat));
        if (created?.id) {
          setCategories(prev => prev.map(c => c.id === newCat.id ? created : c));
        }
      }

      setIsModalOpen(false);
    } catch (err) {
      // The optimistic row goes back. Leaving it in place while the write
      // failed is what made this look like it worked: the table showed the new
      // description, nothing reached the database, and the only trace was a
      // console warning nobody had open.
      setCategories(before);
      setSaveError(err instanceof Error ? err.message : 'Could not save that category.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryActive = async (id: string) => {
    const target = categories.find(c => c.id === id);
    if (!target) return;

    const nextActive = !target.isActive;
    const before = categories;
    setSaveError(null);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: nextActive } : c));

    try {
      // The whole category, not just the flag. `{ isActive }` on its own was
      // rejected because the DTO requires a name, so this toggle never once
      // reached the database.
      await adminApi.updateCategory(id, toCategoryDto({ ...target, isActive: nextActive }));
    } catch (err) {
      setCategories(before);
      setSaveError(
        err instanceof Error ? err.message : `Could not ${nextActive ? 'show' : 'hide'} that category.`,
      );
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Delete this category taxonomy? Products assigned to this category may need re-assignment.')) {
      const before = categories;
      setSaveError(null);
      setCategories(prev => prev.filter(c => c.id !== id));
      try {
        await adminApi.deleteCategory(id);
      } catch (err) {
        // A category with products cannot be deleted, and the row reappearing
        // with the reason beats it vanishing from a table it is still in.
        setCategories(before);
        setSaveError(err instanceof Error ? err.message : 'Could not delete that category.');
      }
    }
  };

  return (
    <div className="space-y-6 text-stone-100">
      {/* A failed toggle or delete happens with no dialog open, so the reason
          needs somewhere to land on the page itself. */}
      {saveError && !isModalOpen && (
        <div
          data-testid="category-page-error"
          className="flex items-start justify-between gap-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-xs text-red-300"
        >
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="font-bold text-red-200 hover:text-white"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold">Category & Taxonomy Management</h1>
          </div>
          <p className="text-xs text-stone-400">
            Manage storefront product categories, display order, and active navigation filters.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
        >
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {/* Category List */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
        <table className="w-full text-left text-xs text-stone-300">
          <thead className="bg-stone-800 text-stone-400 font-semibold border-b border-stone-700 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3.5">Order</th>
              <th className="px-4 py-3.5">Category Name</th>
              <th className="px-4 py-3.5">Slug</th>
              <th className="px-4 py-3.5">Description</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {categories.slice().sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1)).map((cat) => (
              <tr key={cat.id} className="hover:bg-stone-800/50 transition-colors">
                <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">{cat.displayOrder}</td>
                <td className="px-4 py-3.5 font-bold text-stone-100">
                  {/* "Ghee › Desi Ghee", so the shape is readable without
                      opening every row to find out what belongs where. */}
                  {parentName(cat) && (
                    <span className="text-stone-400 font-normal">{parentName(cat)} › </span>
                  )}
                  {cat.name}
                  {cat.showInNav && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      in nav
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 font-mono text-stone-400">{cat.slug}</td>
                <td className="px-4 py-3.5 text-stone-400 max-w-xs truncate">{cat.description}</td>
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => toggleCategoryActive(cat.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                      cat.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-stone-700/50 text-stone-400 border border-stone-700'
                    }`}
                  >
                    {cat.isActive ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="px-4 py-3.5 text-right space-x-2">
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 text-stone-400 hover:text-amber-400 transition-colors"
                    title="Edit Category"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 text-stone-400 hover:text-red-400 transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-800 border border-stone-700 w-full max-w-md rounded-2xl p-6 shadow-2xl text-stone-100 space-y-4">
            <h3 className="text-lg font-bold">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Category Name *</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100"
                  placeholder="e.g. Organic Oils"
                />
              </div>

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Belongs to</label>
                <select
                  value={parentInput}
                  onChange={(e) => setParentInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100"
                >
                  <option value="">A category of its own</option>
                  {topLevel
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        A type of {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-stone-400 mt-1">
                  {parentInput
                    ? 'Shown as a filter on that category\u2019s page, not in the nav bar.'
                    : 'Ghee, Oils, Honey. Types like Desi Ghee belong inside one of these.'}
                </p>
              </div>

              {/* Only a category can be promoted. A type lives inside its
                  category's page, so offering the choice would be a lie. */}
              {!parentInput && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={navInput}
                    onChange={(e) => setNavInput(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-stone-300 font-semibold">Show in the nav bar</span>
                    <span className="block text-[11px] text-stone-400">
                      Unticked, it still appears under \u201cShop by category\u201d.
                    </span>
                  </span>
                </label>
              )}

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Display Order</label>
                <input
                  type="number"
                  value={orderInput}
                  onChange={(e) => setOrderInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-amber-400 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-stone-300 mb-1 font-semibold">Description</label>
                <textarea
                  rows={3}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-100"
                  placeholder="Short description for storefront filter..."
                />
              </div>

              {/* The reason the save failed, in the dialog that failed to save.
                  This used to be a console warning behind a dialog that closed
                  itself as though it had worked. */}
              {saveError && (
                <p
                  data-testid="category-save-error"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300"
                >
                  {saveError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-stone-700 rounded-lg text-stone-200 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 text-stone-950 rounded-lg font-bold disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
