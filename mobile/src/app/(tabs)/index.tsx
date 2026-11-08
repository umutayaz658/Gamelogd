import HomeFeed from '@/components/feed/HomeFeed';

// By the time this renders, (tabs)/_layout.tsx has already established the visitor is
// either authenticated or has tapped through the cover page's "Continue without
// logging in" — either way, HomeFeed is the right thing to show (it has its own
// user-vs-anonymous branching for the tab strip, see HomeFeed.tsx).
export default function HomeScreen() {
  return <HomeFeed />;
}
