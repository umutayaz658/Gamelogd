'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useNotifications } from '@/context/NotificationContext';
import { isChromeHiddenPath } from '@/lib/publicPaths';
import AnonBanner from './AnonBanner';
import ConsentBanner from './Analytics/ConsentBanner';

// Shared fixed-position wrapper for every bottom-anchored bar (anon login/register nudge,
// cookie consent). Stacks them via plain flexbox — AnonBanner first in source order sits
// above ConsentBanner, which sits closest to the true bottom edge — so neither has to
// measure the other's height. For a signed-in visitor (cookie banner only, at that point)
// this also tracks MobileTabBar's own scroll-hide state (via the same useHideOnScroll hook,
// reading the same scroll events) and slides down to replace the tab bar when it hides, back
// up when it reappears. Anonymous visitors get a static stack instead — see MobileTabBar,
// which likewise never scroll-hides while signed out — so this and the tab bar stay pinned
// together with nothing sliding/animating during scroll.
export default function BottomBarStack() {
    const pathname = usePathname();
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const scrollHidden = useHideOnScroll();
    const { isChatFullscreen } = useNotifications();

    // Mirrors MobileTabBar's own render guard — only reserve space for it when it's
    // actually on screen.
    const tabBarPresent = isMobile && !isChromeHiddenPath(pathname ?? '', !user) && !isChatFullscreen;
    const hidden = user ? scrollHidden : false;
    const liftPx = tabBarPresent && !hidden ? 56 : 0;

    // The page's own bottom padding (--bottom-reserve, set on :root) needs to cover this
    // stack's REAL height, not just an assumed tab-bar-sized guess — otherwise, whenever a
    // banner is actually showing, scrollable content ends up extending behind it instead of
    // stopping above it, and a bright post's background bleeds through the banner's
    // semi-transparent backdrop-blur while scrolling past it. Measure it directly instead of
    // guessing: tab bar's own footprint (stable, ignores its scroll-hide animation so the
    // reservation doesn't jitter while scrolling) plus whatever this stack actually renders
    // (0 when neither banner is showing).
    const stackRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = stackRef.current;
        if (!el) return;
        const tabBarPx = tabBarPresent ? 56 : 0;
        const update = () => {
            document.documentElement.style.setProperty('--bottom-reserve', `${tabBarPx + el.offsetHeight}px`);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [tabBarPresent]);

    return (
        <div
            ref={stackRef}
            className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col"
            // translateY (GPU-composited) instead of animating `bottom` (layout-triggering) —
            // matches MobileTabBar's own transform-based slide so the two stay frame-synced
            // instead of drifting apart mid-transition and flashing a sliver of the page
            // background between them.
            style={{ transform: `translateY(-${liftPx}px)`, transition: 'transform 300ms ease-out' }}
        >
            <AnonBanner />
            <ConsentBanner />
        </div>
    );
}
