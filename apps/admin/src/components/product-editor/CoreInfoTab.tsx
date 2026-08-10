import type { CategoryItem } from '../../pages/CategoryCMS';
import type { ProductFormState } from '../../hooks/useProductForm';
import type { ProductStatus } from '../../types';

interface CoreInfoTabProps {
  form: ProductFormState;
  categories: CategoryItem[];
}

const field =
  'w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-stone-200 rounded-xl text-sm text-[#2A2A2A] focus:outline-none focus:border-[#064e3b] transition-colors';
const label = 'block text-xs font-bold text-[#2A2A2A] mb-1.5';

export default function CoreInfoTab({ form, categories }: CoreInfoTabProps) {
  const { core } = form;

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-6">
      <h2 className="text-sm font-bold text-[#064e3b] uppercase tracking-wider">
        Core Product Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={label}>Product Title</label>
          <input
            type="text"
            value={core.title}
            onChange={(e) => core.setTitle(e.target.value)}
            placeholder="Country Dairy A2 Vedic Ghee"
            className={field}
          />
        </div>

        <div>
          <label className={label}>Web Address (slug)</label>
          <input
            type="text"
            value={core.slug}
            onChange={(e) => core.setSlug(e.target.value)}
            placeholder="country-dairy-a2-vedic-ghee"
            className={`${field} font-mono`}
          />
          <p className="text-[11px] text-[#6b6661] mt-1">
            Lowercase letters, numbers and hyphens. Changing this breaks existing links.
          </p>
        </div>

        <div>
          <label className={label}>Category</label>
          <select
            value={core.categoryName}
            onChange={(e) => core.setCategoryName(e.target.value)}
            className={`${field} font-bold`}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>Highlight Badge</label>
          <input
            type="text"
            value={core.badgeText}
            onChange={(e) => core.setBadgeText(e.target.value)}
            placeholder="VEDIC BILONA"
            className={field}
          />
        </div>

        <div>
          <label className={label}>Storefront Status</label>
          <select
            value={core.status}
            onChange={(e) => core.setStatus(e.target.value as ProductStatus)}
            className={`${field} font-bold`}
          >
            <option value="DRAFT">Draft — hidden from the storefront</option>
            <option value="LIVE">Live — visible and orderable</option>
            <option value="ARCHIVED">Archived — retired from the catalogue</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2.5 cursor-pointer pb-2.5">
            <input
              type="checkbox"
              checked={core.forceOutOfStock}
              onChange={(e) => core.setForceOutOfStock(e.target.checked)}
              className="h-4 w-4 accent-[#064e3b]"
            />
            <span className="text-xs">
              <span className="font-bold text-[#2A2A2A]">Mark out of stock</span>
              <span className="block text-[11px] text-[#6b6661]">
                Overrides stock levels and blocks ordering.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <label className={label}>Tagline</label>
        <input
          type="text"
          value={core.tagline}
          onChange={(e) => core.setTagline(e.target.value)}
          placeholder="Every spoon carries the soul of Devbhoomi."
          className={field}
        />
      </div>

      <div>
        <label className={label}>Farm Origin &amp; Story</label>
        <textarea
          rows={6}
          value={core.storyDescription}
          onChange={(e) => core.setStoryDescription(e.target.value)}
          placeholder="How this product is made, and where it comes from."
          className={`${field} leading-relaxed resize-y`}
        />
      </div>

      <div className="pt-2 border-t border-stone-100">
        <h3 className="text-xs font-bold text-[#064e3b] uppercase tracking-wider mb-4">
          Storefront Specifications
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={label}>Serving Size</label>
            <input
              type="text"
              value={core.servingSize}
              onChange={(e) => core.setServingSize(e.target.value)}
              placeholder="10g"
              className={field}
            />
          </div>

          <div>
            <label className={label}>Shelf Life</label>
            <input
              type="text"
              value={core.shelfLife}
              onChange={(e) => core.setShelfLife(e.target.value)}
              placeholder="12 months"
              className={field}
            />
          </div>

          <div>
            <label className={label}>Storage Instructions</label>
            <input
              type="text"
              value={core.storageInstructions}
              onChange={(e) => core.setStorageInstructions(e.target.value)}
              placeholder="Store in a cool, dry place"
              className={field}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
