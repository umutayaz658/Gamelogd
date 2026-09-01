'use client';

import { useEffect, useRef, useState } from 'react';

// Pixels of scroll movement (in one direction) required before it reacts, so it doesn't
// flicker on tiny scroll jitter. Shared by every bottom-anchored bar (MobileTabBar,
// AnonBanner) so they all read the same scroll events with identical logic and therefore
// stay in sync without needing a shared context.
const SCROLL_THRESHOLD = 8;

export function useHideOnScroll(): boolean {
    const [hidden, setHidden] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        lastScrollY.current = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY.current;

            if (currentScrollY <= 0) {
                setHidden(false);
            } else if (delta > SCROLL_THRESHOLD) {
                setHidden(true); // scrolling down
                lastScrollY.current = currentScrollY;
            } else if (delta < -SCROLL_THRESHOLD) {
                setHidden(false); // scrolling up
                lastScrollY.current = currentScrollY;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return hidden;
}
