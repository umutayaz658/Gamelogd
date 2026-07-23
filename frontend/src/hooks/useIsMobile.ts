'use client';

import { useEffect, useState } from 'react';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const BREAKPOINTS: Record<Breakpoint, number> = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
};

function getBreakpoint(width: number): Breakpoint {
    if (width >= BREAKPOINTS['2xl']) return '2xl';
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    return 'sm';
}

interface BreakpointState {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    breakpoint: Breakpoint;
}

// Mobile/desktop seam matches the app's existing `lg` breakpoint, where
// Navbar/LeftSidebar/RightSidebar already switch behavior.
export function useBreakpoint(): BreakpointState {
    const [state, setState] = useState<BreakpointState>({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        breakpoint: 'lg',
    });

    useEffect(() => {
        const mql = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`);
        const tabletMql = window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`);

        const update = () => {
            const width = window.innerWidth;
            const isDesktop = width >= BREAKPOINTS.lg;
            setState({
                isMobile: !isDesktop,
                isTablet: !isDesktop && width >= BREAKPOINTS.md,
                isDesktop,
                breakpoint: getBreakpoint(width),
            });
        };

        update();
        mql.addEventListener('change', update);
        tabletMql.addEventListener('change', update);
        window.addEventListener('resize', update);

        return () => {
            mql.removeEventListener('change', update);
            tabletMql.removeEventListener('change', update);
            window.removeEventListener('resize', update);
        };
    }, []);

    return state;
}

export function useIsMobile(): boolean {
    return useBreakpoint().isMobile;
}
