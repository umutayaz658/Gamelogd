import { Suspense } from 'react';
import DevsPageClient from './DevsPageClient';

export default function DevsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
        }>
            <DevsPageClient />
        </Suspense>
    );
}
