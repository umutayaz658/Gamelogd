'use client';

import { useLogModal } from '@/context/LogModalContext';
import LogGameModal from '@/components/LogGameModal';

export default function ClientLogModalWrapper() {
    const { isLogModalOpen, closeLogModal } = useLogModal();

    return (
        <LogGameModal
            isOpen={isLogModalOpen}
            onClose={closeLogModal}
        />
    );
}
