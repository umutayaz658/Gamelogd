'use client';

import { useLogModal } from '@/context/LogModalContext';
import LogGameModal from '@/components/LogGameModal';

export default function ClientLogModalWrapper() {
    const { isLogModalOpen, closeLogModal, initialGame, existingReview, isReplay } = useLogModal();

    return (
        <LogGameModal
            isOpen={isLogModalOpen}
            onClose={closeLogModal}
            initialGame={initialGame}
            existingReview={existingReview}
            isReplay={isReplay}
        />
    );
}
