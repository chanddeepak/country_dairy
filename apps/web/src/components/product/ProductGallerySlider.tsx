'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductGallerySliderProps {
  images: Array<{ id: string; imageUrl: string; altText?: string }>;
  title: string;
}

export default function ProductGallerySlider({ images, title }: ProductGallerySliderProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0, show: false });

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-square bg-[var(--cream)] rounded-sm flex items-center justify-center text-[var(--ink-soft)] text-sm">
        No Image Available
      </div>
    );
  }

  const currentImage = images[selectedIndex] || images[0];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y, show: true });
  };

  const handleMouseLeave = () => {
    setZoomPos({ x: 0, y: 0, show: false });
  };

  return (
    <div className="space-y-4">
      {/* Main Image Container & Amazon-style Zoom Lens */}
      <div className="flex flex-col md:flex-row-reverse gap-4">
        
        {/* Main Hero Photo Showcase */}
        <div 
          className="relative flex-1 aspect-square bg-[var(--cream)] rounded-sm overflow-hidden border border-[var(--line)] cursor-crosshair group"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => setIsZoomModalOpen(true)}
        >
          <img
            src={currentImage.imageUrl}
            alt={currentImage.altText || `${title} image ${selectedIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-200"
          />

          {/* Amazon/Anveshan Style Hover Zoom Lens */}
          {zoomPos.show && (
            <div
              className="absolute inset-0 pointer-events-none z-20 border border-[var(--line)] shadow-2xl bg-no-repeat transition-all"
              style={{
                backgroundImage: `url(${currentImage.imageUrl})`,
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                backgroundSize: '250%',
              }}
            />
          )}

          {/* Inspect Badge */}
          <div className="absolute bottom-3 right-3 bg-[var(--forest)]/80 backdrop-blur-sm text-[var(--ivory)] text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="h-3.5 w-3.5" />
            <span>Hover to Zoom</span>
          </div>

          {/* Mobile Swipe Nav Buttons */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-[var(--forest)]/60 text-white rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[var(--forest)]/60 text-white rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Desktop Vertical Thumbnail Strip (Max 10 images) */}
        {images.length > 1 && (
          <div className="flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto max-h-[500px] scrollbar-none">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`relative w-16 h-16 rounded-sm overflow-hidden border-2 transition-all shrink-0 ${
                  selectedIndex === idx
                    ? 'border-[var(--ok)] ring-2 ring-[var(--ok)]/20 scale-105'
                    : 'border-[var(--line)] opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Horizontal Carousel Dots Indicator */}
      {images.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 md:hidden">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                selectedIndex === idx ? 'w-6 bg-[var(--ok)]' : 'w-2 bg-[var(--line)]'
              }`}
            />
          ))}
        </div>
      )}

      {/* Full-Screen Pinch & Zoom Modal */}
      {isZoomModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[var(--ink)]/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto rounded-sm">
            <img src={currentImage.imageUrl} alt="Full resolution" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
