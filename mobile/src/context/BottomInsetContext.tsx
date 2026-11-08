import { createContext, useContext } from 'react';

// Replaces web's `--bottom-reserve` CSS variable (frontend/src/components/BottomBarStack.tsx)
// — the combined measured height of whatever's pinned to the screen bottom (tab bar +
// AnonBanner right now), so scrollable screens (the Home feed, step 9) can reserve
// exactly that much space at their own bottom edge instead of content ending up hidden
// underneath the fixed bars.
const BottomInsetContext = createContext(0);

export const BottomInsetProvider = BottomInsetContext.Provider;

export function useBottomInset(): number {
  return useContext(BottomInsetContext);
}
