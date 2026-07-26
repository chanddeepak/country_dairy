import { useState, useEffect } from 'react';
import { Layout, Plus, Trash2, ArrowUp, ArrowDown, Save, AlertCircle } from 'lucide-react';
import ImageUploader from '../components/common/ImageUploader';
import HeroPreviewSimulator from '../components/cms/HeroPreviewSimulator';
import type { HeroSlide } from '../types';
import { adminApi } from '../services/apiClient';

export default function HeroManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [activeEditingSlide, setActiveEditingSlide] = useState<HeroSlide | null>(null);

  useEffect(() => {
    adminApi.getHeroBanners()
      .then(banners => {
        if (banners && banners.length > 0) {
          const mapped: HeroSlide[] = banners.map(b => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            badgeText: b.badgeText || 'FARM FRESH',
            ctaLabel: b.ctaText || 'Shop All Products',
            ctaLink: b.ctaLink || '/products',
            desktopImageUrl: (b.imageUrl && !b.imageUrl.startsWith('blob:')) ? b.imageUrl : '',
            mobileImageUrl: (b.imageUrl && !b.imageUrl.startsWith('blob:')) ? b.imageUrl : '',
            overlayOpacity: 30,
            sortOrder: b.displayOrder || 1,
            isActive: b.isActive ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          setSlides(mapped);
          if (mapped.length > 0) {
            setActiveEditingSlide(mapped[0]);
          }
        }
      })
      .catch(err => console.warn('API getHeroBanners warning:', err));
  }, []);

  const activeCount = slides.filter(s => s.isActive).length;
  const isMaxReached = slides.length >= 6;

  const handleAddSlide = async () => {
    if (isMaxReached) {
      alert('Maximum 6 hero carousel slides allowed.');
      return;
    }

    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      title: 'New Storefront Banner',
      subtitle: 'Add compelling subtitle text here',
      badgeText: 'Special Offer',
      ctaLabel: 'Explore Shop',
      ctaLink: '/products',
      desktopImageUrl: '/images/hero-banner.png',
      mobileImageUrl: '/images/hero-banner.png',
      overlayOpacity: 30,
      sortOrder: slides.length + 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSlides(prev => [...prev, newSlide]);
    setActiveEditingSlide(newSlide);

    try {
      const created = await adminApi.createHeroBanner({
        title: newSlide.title,
        subtitle: newSlide.subtitle,
        imageUrl: newSlide.desktopImageUrl || '/images/hero-banner.png',
        ctaText: newSlide.ctaLabel,
        ctaLink: newSlide.ctaLink,
        badgeText: newSlide.badgeText,
        displayOrder: newSlide.sortOrder,
        isActive: newSlide.isActive,
      });
      if (created?.id) {
        setSlides(prev => prev.map(s => s.id === newSlide.id ? { ...s, id: created.id } : s));
        setActiveEditingSlide(prev => prev && prev.id === newSlide.id ? { ...prev, id: created.id } : prev);
      }
    } catch (err) {
      console.warn('API createHeroBanner error:', err);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIndex];
    newSlides[targetIndex] = temp;

    newSlides.forEach((s, idx) => { s.sortOrder = idx + 1; });
    setSlides(newSlides);
  };

  const handleDelete = async (id: string) => {
    if (slides.length <= 1) {
      alert('At least 1 hero slide must remain in the carousel.');
      return;
    }
    if (confirm('Are you sure you want to delete this hero slide banner?')) {
      setSlides(prev => prev.filter(s => s.id !== id));
      if (activeEditingSlide?.id === id) {
        setActiveEditingSlide(null);
      }
      try {
        await adminApi.deleteHeroBanner(id);
      } catch (err) {
        console.warn('API deleteHeroBanner error:', err);
      }
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingSlide) return;

    setSlides(prev => prev.map(s => s.id === activeEditingSlide.id ? activeEditingSlide : s));
    
    try {
      await adminApi.updateHeroBanner(activeEditingSlide.id, {
        title: activeEditingSlide.title,
        subtitle: activeEditingSlide.subtitle,
        imageUrl: activeEditingSlide.desktopImageUrl || '/images/hero-banner.png',
        ctaText: activeEditingSlide.ctaLabel,
        ctaLink: activeEditingSlide.ctaLink,
        badgeText: activeEditingSlide.badgeText,
        displayOrder: activeEditingSlide.sortOrder,
        isActive: activeEditingSlide.isActive,
      });
      alert('Hero slide changes saved successfully to Database!');
    } catch (err) {
      console.warn('API updateHeroBanner error:', err);
      alert('Updated in memory (Backend offline check warnings in console)');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900 p-6 rounded-2xl border border-stone-800 text-stone-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layout className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold">Hero Carousel Manager</h1>
          </div>
          <p className="text-xs text-stone-400">
            Control the homepage main banner slides. Strictly enforced bounds: Min 1, Max 6 slides.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-stone-300">
            Active Banners: <span className="text-amber-400 font-mono font-bold">{activeCount} / 6</span>
          </div>

          <button
            type="button"
            disabled={isMaxReached}
            onClick={handleAddSlide}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
              isMaxReached
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
            }`}
            title={isMaxReached ? 'Maximum 6 hero slides allowed' : 'Add new hero banner'}
          >
            <Plus className="h-4 w-4" />
            <span>Add Banner Slide</span>
          </button>
        </div>
      </div>

      {isMaxReached && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Maximum slide capacity reached (6 slides). Delete or edit existing slides to update.</span>
        </div>
      )}

      {/* Main Grid: Left Slide List, Right Live Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Carousel Slide Cards List */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Slide Sequence</h2>
          
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              onClick={() => setActiveEditingSlide(slide)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                activeEditingSlide?.id === slide.id
                  ? 'bg-stone-800 border-amber-500 shadow-xl'
                  : 'bg-stone-900 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold bg-stone-950 px-2 py-0.5 rounded text-amber-400 border border-stone-700">
                    Slide {idx + 1} of {slides.length}
                  </span>
                  {slide.isActive ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] bg-stone-700 text-stone-400 px-2 py-0.5 rounded-full font-bold">
                      Draft
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-stone-400 hover:text-stone-100 disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === slides.length - 1}
                    className="p-1 text-stone-400 hover:text-stone-100 disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    className="p-1 text-stone-400 hover:text-red-400 transition-colors"
                    title="Delete Slide"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="font-bold text-stone-100 text-sm truncate">{slide.title}</div>
              <div className="text-xs text-stone-400 truncate mt-0.5">{slide.subtitle}</div>
            </div>
          ))}
        </div>

        {/* Right Column: Slide Editor & Simulator */}
        <div className="lg:col-span-7">
          {activeEditingSlide ? (
            <div className="bg-stone-900 p-6 rounded-2xl border border-stone-800 space-y-6">
              
              {/* Simulator Component */}
              <HeroPreviewSimulator slide={activeEditingSlide} />

              {/* Editor Form */}
              <form onSubmit={handleSaveSlide} className="space-y-4 text-xs text-stone-200">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <h3 className="font-bold text-sm text-stone-100">Edit Slide Details</h3>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all"
                  >
                    <Save className="h-4 w-4" /> Save Banner
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Banner Title</label>
                    <input
                      type="text"
                      required
                      value={activeEditingSlide.title}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, title: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Subtitle / Description</label>
                    <textarea
                      rows={2}
                      value={activeEditingSlide.subtitle || ''}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, subtitle: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Badge Tag</label>
                    <input
                      type="text"
                      value={activeEditingSlide.badgeText || ''}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, badgeText: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
                      placeholder="e.g. 100% Certified Organic"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">CTA Button Label</label>
                    <input
                      type="text"
                      value={activeEditingSlide.ctaLabel}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, ctaLabel: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">CTA Target Link</label>
                    <input
                      type="text"
                      value={activeEditingSlide.ctaLink}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, ctaLink: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-stone-100 font-mono"
                      placeholder="/products or /products/ghee"
                    />
                  </div>

                  {/* Dark Scrim Opacity Slider */}
                  <div className="col-span-2 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>Dark Scrim Text Contrast Overlay</span>
                      <span className="font-mono text-amber-400">{activeEditingSlide.overlayOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={70}
                      value={activeEditingSlide.overlayOpacity}
                      onChange={(e) => setActiveEditingSlide({ ...activeEditingSlide, overlayOpacity: parseInt(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                {/* Uploaders for Desktop & Mobile Banners (5MB max each, WebP auto-compressed) */}
                <div className="space-y-4 pt-2 border-t border-stone-800">
                  <ImageUploader
                    label="Desktop Banner Image (16:9 Aspect Ratio)"
                    aspectRatio="desktop"
                    currentImageUrl={activeEditingSlide.desktopImageUrl}
                    onImageUploaded={(url) => setActiveEditingSlide({ ...activeEditingSlide, desktopImageUrl: url })}
                  />

                  <ImageUploader
                    label="Mobile Banner Image (4:3 Aspect Ratio)"
                    aspectRatio="mobile"
                    currentImageUrl={activeEditingSlide.mobileImageUrl}
                    onImageUploaded={(url) => setActiveEditingSlide({ ...activeEditingSlide, mobileImageUrl: url })}
                  />
                </div>

              </form>

            </div>
          ) : (
            <div className="min-h-[400px] flex items-center justify-center bg-stone-900 rounded-2xl border border-stone-800 text-stone-500 text-xs">
              Select a slide from the left sequence list to edit.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
