import { useState, useEffect } from 'react';
import { Layout, Plus, Trash2, ArrowUp, ArrowDown, Save, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import ImageUploader from '../components/common/ImageUploader';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import HeroPreviewSimulator from '../components/cms/HeroPreviewSimulator';
import type { HeroSlide } from '../types';
import HeroLayoutEditor from '../components/HeroLayoutEditor';

/**
 * Off unless a developer turns it on.
 *
 * Deliberately an env flag rather than an entry in the console's own feature
 * flags: those are for switching finished features on and off in production,
 * and this is neither finished nor something anyone should be able to enable
 * from a browser.
 */
const SHOW_LAYOUT_EDITOR = import.meta.env.VITE_ENABLE_HERO_LAYOUT_EDITOR === 'true';
import { adminApi } from '../services/apiClient';

export default function HeroManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [activeEditingSlide, setActiveEditingSlide] = useState<HeroSlide | null>(null);
  const [activeDeviceType, setActiveDeviceType] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const confirm = useConfirm((message) => setToast({ type: 'error', message }));

  const showNotification = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let isCurrent = true;
    setSlides([]);
    setActiveEditingSlide(null);

    adminApi.getHeroBanners(activeDeviceType)
      .then(banners => {
        if (!isCurrent) return;
        if (banners && banners.length > 0) {
          const mapped: HeroSlide[] = banners.map(b => {
            const validUrl = (b.imageUrl && (b.imageUrl.startsWith('/hero-banners/') || b.imageUrl.startsWith('/products/') || b.imageUrl.startsWith('/uploads/') || b.imageUrl.includes('/storage/v1/object/public/'))) ? b.imageUrl : '';
            return {
              id: b.id,
              title: b.title,
              subtitle: b.subtitle,
              badgeText: b.badgeText || 'FARM FRESH',
              ctaLabel: b.ctaText || 'Shop All Products',
              ctaLink: b.ctaLink || '/products',
              desktopImageUrl: activeDeviceType === 'DESKTOP' ? validUrl : '',
              mobileImageUrl: activeDeviceType === 'MOBILE' ? validUrl : '',
              layout: b.layout ?? null,
              imageHasText: Boolean(b.imageHasText),
              overlayOpacity: 30,
              sortOrder: b.displayOrder || 1,
              isActive: b.isActive ?? true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          });
          setSlides(mapped);
          setActiveEditingSlide(mapped[0]);
        } else {
          setSlides([]);
          setActiveEditingSlide(null);
        }
      })
      .catch(err => {
        if (isCurrent) console.warn('API getHeroBanners warning:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDeviceType]);

  const activeCount = slides.filter(s => s.isActive).length;
  const isMaxReached = slides.length >= 6;

  const handleAddSlide = async () => {
    if (isMaxReached) {
      alert(`Maximum 6 ${activeDeviceType.toLowerCase()} hero carousel slides allowed.`);
      return;
    }

    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      title: `${activeDeviceType === 'DESKTOP' ? 'Desktop' : 'Mobile'} Storefront Banner`,
      subtitle: 'Add compelling subtitle text here',
      badgeText: 'Special Offer',
      ctaLabel: 'Explore Shop',
      ctaLink: '/products',
      desktopImageUrl: '',
      mobileImageUrl: '',
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
        imageUrl: '/images/hero-banner.png',
        deviceType: activeDeviceType,
        ctaText: newSlide.ctaLabel,
        ctaLink: newSlide.ctaLink,
        badgeText: newSlide.badgeText,
        displayOrder: newSlide.sortOrder,
        isActive: newSlide.isActive,
        imageHasText: newSlide.imageHasText ?? false,
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


  const handleDelete = (id: string) => {
    if (slides.length <= 1) {
      // A toast, not alert(): the page already has one, and a native
      // dialog blocks the whole tab for a rule the reader did not break.
      setToast({ type: 'error', message: 'At least one hero slide must remain in the carousel.' });
      return;
    }

    confirm.ask({
      title: 'Delete Hero Banner Slide?',
      message:
        'Are you sure you want to remove this hero slide from the homepage carousel? This change will be published immediately.',
      confirmLabel: 'Delete Banner',
      onConfirm: async () => {
        // The API first: the slide used to be pulled from the carousel before
        // the request, with failures going to console.warn, so a banner that
        // was still live looked deleted until the next reload.
        await adminApi.deleteHeroBanner(id);
        setSlides((prev) => prev.filter((s) => s.id !== id));
        if (activeEditingSlide?.id === id) {
          setActiveEditingSlide(null);
        }
      },
    });
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingSlide) return;

    setIsSaving(true);
    setSlides(prev => prev.map(s => s.id === activeEditingSlide.id ? activeEditingSlide : s));
    
    try {
      const imgUrl = (activeDeviceType === 'DESKTOP' ? activeEditingSlide.desktopImageUrl : activeEditingSlide.mobileImageUrl) || '/images/hero-banner.png';
      const saved = await adminApi.updateHeroBanner(activeEditingSlide.id, {
        title: activeEditingSlide.title,
        subtitle: activeEditingSlide.subtitle,
        imageUrl: imgUrl,
        deviceType: activeDeviceType,
        ctaText: activeEditingSlide.ctaLabel,
        ctaLink: activeEditingSlide.ctaLink,
        badgeText: activeEditingSlide.badgeText,
        displayOrder: activeEditingSlide.sortOrder,
        isActive: activeEditingSlide.isActive,
        imageHasText: activeEditingSlide.imageHasText ?? false,
        layout: activeEditingSlide.layout ?? undefined,
      });

      if (saved?.id) {
        const resUrl = (saved.imageUrl && (saved.imageUrl.startsWith('/hero-banners/') || saved.imageUrl.startsWith('/products/') || saved.imageUrl.startsWith('/uploads/') || saved.imageUrl.includes('/storage/v1/object/public/'))) ? saved.imageUrl : '';
        setSlides(prev => prev.map(s => s.id === activeEditingSlide.id ? {
          ...s,
          id: saved.id,
          desktopImageUrl: activeDeviceType === 'DESKTOP' ? resUrl : s.desktopImageUrl,
          mobileImageUrl: activeDeviceType === 'MOBILE' ? resUrl : s.mobileImageUrl,
        } : s));
        setActiveEditingSlide(prev => prev ? {
          ...prev,
          id: saved.id,
          desktopImageUrl: activeDeviceType === 'DESKTOP' ? resUrl : prev.desktopImageUrl,
          mobileImageUrl: activeDeviceType === 'MOBILE' ? resUrl : prev.mobileImageUrl,
        } : null);
      }

      showNotification('success', `${activeDeviceType === 'DESKTOP' ? 'Desktop' : 'Mobile'} hero banner saved successfully!`);
    } catch (err: any) {
      console.error('API updateHeroBanner error:', err);
      showNotification('error', `Save failed: ${err.message || err}`);
    } finally {
      setIsSaving(false);
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
            <span>Add {activeDeviceType === 'DESKTOP' ? 'Desktop' : 'Mobile'} Banner</span>
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
              
              {/* Simulator Component with Integrated Device Mode Toggle */}
              <HeroPreviewSimulator 
                slide={activeEditingSlide} 
                deviceType={activeDeviceType} 
                onDeviceTypeChange={setActiveDeviceType} 
              />

              {/* Editor Form */}
              <form onSubmit={handleSaveSlide} className="space-y-4 text-xs text-stone-200">
              {/* Placement. Behind a build-time flag, not an admin feature
                  flag: this is unfinished, and a switch in the console would
                  invite someone to turn it on in production. Set
                  VITE_ENABLE_HERO_LAYOUT_EDITOR=true in a local .env to work
                  on it. */}
              {SHOW_LAYOUT_EDITOR && (
              <div className="space-y-2 pb-4 border-b border-stone-700">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Text placement
                </label>
                <HeroLayoutEditor
                  value={activeEditingSlide.layout}
                  onChange={(layout) =>
                    setActiveEditingSlide({ ...activeEditingSlide, layout })
                  }
                  imageUrl={
                    (activeDeviceType === 'DESKTOP'
                      ? activeEditingSlide.desktopImageUrl
                      : activeEditingSlide.mobileImageUrl) || undefined
                  }
                  title={activeEditingSlide.title}
                  subtitle={activeEditingSlide.subtitle}
                />
              </div>
              )}

                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <h3 className="font-bold text-sm text-stone-100">Edit Slide Details</h3>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-stone-950" />
                        Saving Banner...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save Banner
                      </>
                    )}
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

                  <div className="col-span-2 rounded-lg border border-stone-700 bg-stone-950/60 p-3">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-amber-500"
                        checked={activeEditingSlide.imageHasText ?? false}
                        onChange={(e) =>
                          setActiveEditingSlide({ ...activeEditingSlide, imageHasText: e.target.checked })
                        }
                      />
                      <span className="text-sm">
                        <span className="font-semibold text-stone-100">
                          The artwork already has words on it
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-400">
                          Tick this for poster-style banners exported from a design tool. The
                          storefront shows the picture whole and lays no headline over it. Leave it
                          unticked for a clean photograph, and the title and subtitle below are set
                          in the site's own type — which is what the new design wants.
                        </span>
                      </span>
                    </label>

                    {!activeEditingSlide.imageHasText && !activeEditingSlide.title.trim() && (
                      <p className="mt-2.5 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          This slide has no title, so the storefront has no headline to show and
                          will fall back to the picture alone. Either write a title or tick the box
                          above.
                        </span>
                      </p>
                    )}
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

                {/* Image Uploader for Active Device Type */}
                <div className="space-y-4 pt-2 border-t border-stone-800">
                  {activeDeviceType === 'DESKTOP' ? (
                    <ImageUploader
                      key={`${activeEditingSlide.id}-desktop-${activeEditingSlide.desktopImageUrl}`}
                      bucket="hero-banners"
                      label="Desktop Banner Image (16:9 Aspect Ratio)"
                      aspectRatio="desktop"
                      currentImageUrl={activeEditingSlide.desktopImageUrl}
                      onImageUploaded={(url) => setActiveEditingSlide({ ...activeEditingSlide, desktopImageUrl: url })}
                    />
                  ) : (
                    <ImageUploader
                      key={`${activeEditingSlide.id}-mobile-${activeEditingSlide.mobileImageUrl}`}
                      bucket="hero-banners"
                      label="Mobile Banner Image (4:3 Aspect Ratio)"
                      aspectRatio="mobile"
                      currentImageUrl={activeEditingSlide.mobileImageUrl}
                      onImageUploaded={(url) => setActiveEditingSlide({ ...activeEditingSlide, mobileImageUrl: url })}
                    />
                  )}
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

      {/* Floating Glassmorphism Toast Notification Dialog */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md transition-all animate-bounce ${
          toast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
            : 'bg-rose-950/95 border-rose-500/50 text-rose-200 shadow-rose-950/50'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span className="font-semibold text-xs">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-stone-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <ConfirmDialog {...confirm.dialogProps} />
    </div>
  );
}
