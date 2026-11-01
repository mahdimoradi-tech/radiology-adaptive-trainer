import { useState } from 'react';

/**
 * Medical X-ray image container with strict RTL-protection.
 * Chest radiographs contain anatomical Left/Right markers; they MUST NEVER be flipped or transformed.
 *
 * @param {Object} props
 * @param {string} props.src - Image URL (typically /api/images/:publicId/file)
 * @param {string} props.alt - Accessible localized description
 * @param {string} [props.aspectRatio='aspect-square'] - Enforced aspect ratio
 * @param {string} [props.className='']
 * @param {string} [props.fallbackText='تصویر در دسترس نیست']
 */
export function XrayImage({
  src,
  alt,
  aspectRatio = 'aspect-square',
  className = '',
  fallbackText = 'تصویر در دسترس نیست',
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      dir="ltr"
      data-testid="xray-container"
      className={`relative ${aspectRatio} bg-black rounded-lg overflow-hidden flex items-center justify-center select-none ${className}`}
    >
      {hasError ? (
        <div
          role="img"
          aria-label={alt}
          className="text-slate-400 text-xs text-center p-4"
        >
          {fallbackText}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          className="max-h-full max-w-full object-contain pointer-events-none"
        />
      )}
    </div>
  );
}
