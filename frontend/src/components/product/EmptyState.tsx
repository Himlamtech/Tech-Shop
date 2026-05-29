import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
    title?: string;
    message?: string;
    onReset?: () => void;
    resetLabel?: string;
}

export default function EmptyState({
    title = 'No products found',
    message = 'Try adjusting your filters or search terms to find what you are looking for.',
    onReset,
    resetLabel = 'Clear filters',
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <PackageOpen className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-6">{message}</p>
            {onReset && (
                <button
                    onClick={onReset}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {resetLabel}
                </button>
            )}
        </div>
    );
}
