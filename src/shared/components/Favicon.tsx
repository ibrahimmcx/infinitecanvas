import { useState } from 'react';
import { Globe } from 'lucide-react';
import { getGoogleFaviconFallback } from '@/shared/utils/url';

interface FaviconProps {
  src?: string;
  url: string;
  domain: string;
  size?: number;
  className?: string;
}

export function Favicon({ src, url, domain, size = 18, className = '' }: FaviconProps) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'icon'>(
    src ? 'primary' : 'fallback'
  );

  const fallbackUrl = getGoogleFaviconFallback(url);
  const currentSrc = stage === 'primary' ? src : stage === 'fallback' ? fallbackUrl : '';

  if (!currentSrc || stage === 'icon') {
    const initial = domain.replace(/^www\./i, '').charAt(0).toUpperCase();
    return (
      <span
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded bg-[#232732] text-[#9aa2b1] border border-[#303644] ${className}`}
        aria-hidden="true"
      >
        {initial ? (
          <span className="text-[10px] font-semibold leading-none">{initial}</span>
        ) : (
          <Globe className="w-3 h-3" />
        )}
      </span>
    );
  }

  return (
    <img
      src={currentSrc}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage === 'primary' && fallbackUrl && fallbackUrl !== src) {
          setStage('fallback');
        } else {
          setStage('icon');
        }
      }}
      className={`shrink-0 rounded object-contain bg-[#1e212a] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
