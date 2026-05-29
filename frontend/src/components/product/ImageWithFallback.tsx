import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
}

export default function ImageWithFallback({ src, alt, className = '' }: ImageWithFallbackProps) {
    const [hasError, setHasError] = useState(false);

    if (hasError || !src) {
        return (
            <div
                className={`flex items-center justify-center bg-gray-100 ${className}`}
                role="img"
                aria-label={alt}
            >
                <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs">Image unavailable</span>
                </div>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setHasError(true)}
            referrerPolicy="no-referrer"
        />
    );
}
