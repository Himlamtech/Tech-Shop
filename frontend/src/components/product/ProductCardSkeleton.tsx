import React from 'react';

export default function ProductCardSkeleton() {
    return (
        <div className="flex flex-col h-full rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm animate-pulse">
            {/* Image placeholder */}
            <div className="w-full pt-[72%] bg-gray-200 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-100" />
            </div>

            {/* Content placeholder */}
            <div className="flex flex-col flex-grow p-5 space-y-3">
                {/* Category + rating row */}
                <div className="flex items-center justify-between">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                </div>

                {/* Title */}
                <div className="h-5 w-3/4 bg-gray-200 rounded" />

                {/* Description lines */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-100 rounded" />
                    <div className="h-3 w-2/3 bg-gray-100 rounded" />
                </div>

                {/* Tags */}
                <div className="flex gap-2 pt-1">
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                    <div className="h-5 w-20 bg-gray-100 rounded-full" />
                </div>

                {/* Bottom: price + button */}
                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="h-2 w-10 bg-gray-100 rounded" />
                        <div className="h-5 w-16 bg-gray-200 rounded" />
                    </div>
                    <div className="h-8 w-20 bg-gray-200 rounded-full" />
                </div>
            </div>
        </div>
    );
}
