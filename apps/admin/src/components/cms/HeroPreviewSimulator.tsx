import { Monitor, Smartphone } from 'lucide-react';
import type { HeroSlide } from '../../types';
import { resolveImageUrl } from '../common/ImageUploader';

interface HeroPreviewSimulatorProps {
  slide: Partial<HeroSlide>;
  deviceType?: 'DESKTOP' | 'MOBILE';
  onDeviceTypeChange?: (device: 'DESKTOP' | 'MOBILE') => void;
}

export default function HeroPreviewSimulator({ slide, deviceType = 'DESKTOP', onDeviceTypeChange }: HeroPreviewSimulatorProps) {
  const currentDevice = deviceType.toLowerCase() as 'desktop' | 'mobile';

  const rawBg = currentDevice === 'desktop' 
    ? (slide.desktopImageUrl || '/images/hero-banner.png')
    : (slide.mobileImageUrl || slide.desktopImageUrl || '/images/hero-banner.png');
  const bgImage = resolveImageUrl(rawBg);

  const opacityPercent = slide.overlayOpacity !== undefined ? slide.overlayOpacity : 30;

  return (
    <div className="space-y-3 bg-stone-950 p-4 rounded-2xl border border-stone-800">
      {/* Device Switcher Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-stone-300 flex items-center gap-2">
          <span>Live Storefront Simulator</span>
        </div>
        <div className="flex items-center bg-stone-900 border border-stone-700 rounded-lg p-1 space-x-1 text-xs">
          <button
            type="button"
            onClick={() => onDeviceTypeChange?.('DESKTOP')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              deviceType === 'DESKTOP' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
          <button
            type="button"
            onClick={() => onDeviceTypeChange?.('MOBILE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              deviceType === 'MOBILE' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>
      </div>

      {/* Screen Frame Simulator */}
      <div className="flex justify-center bg-stone-900/60 p-4 rounded-xl border border-stone-800">
        <div 
          className={`relative overflow-hidden rounded-xl shadow-2xl transition-all ${
            currentDevice === 'desktop' 
              ? 'w-full aspect-[16/7] max-h-[320px]' 
              : 'w-[280px] aspect-[4/5]'
          }`}
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Dark Scrim Overlay (Controlled by overlayOpacity) */}
          <div 
            className="absolute inset-0 bg-black transition-opacity"
            style={{ opacity: opacityPercent / 100 }}
          />

          {/* Banner Content Overlays */}
          <div className="relative z-10 h-full p-6 flex flex-col justify-center space-y-2 text-white">
            {slide.badgeText && (
              <div>
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-stone-950 px-2.5 py-0.5 rounded-full shadow">
                  {slide.badgeText}
                </span>
              </div>
            )}

            <h2 className={`font-black tracking-tight drop-shadow-md text-stone-100 ${
              currentDevice === 'desktop' ? 'text-2xl' : 'text-base'
            }`}>
              {slide.title || 'Pure A2 Gir Cow Bilona Ghee'}
            </h2>

            {slide.subtitle && (
              <p className={`text-stone-200 drop-shadow line-clamp-2 ${
                currentDevice === 'desktop' ? 'text-sm max-w-xl' : 'text-xs'
              }`}>
                {slide.subtitle}
              </p>
            )}

            <div className="pt-2">
              <span className="inline-block bg-amber-500 text-stone-950 px-4 py-2 rounded-lg font-bold text-xs shadow-md">
                {slide.ctaLabel || 'Explore Shop'} →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
