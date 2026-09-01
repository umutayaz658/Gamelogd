import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGateProvider } from '@/context/AuthGateContext';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import BottomBarStack from '@/components/BottomBarStack';
import { NotificationProvider } from '@/context/NotificationContext';
import MessagesDrawer from '@/components/MessagesDrawer';
import { LogModalProvider } from '@/context/LogModalContext';
import ClientLogModalWrapper from '@/components/ClientLogModalWrapper';
import { ReplyModalProvider } from '@/context/ReplyModalContext';
import ReplyModal from '@/components/ReplyModal';
import { PostModalProvider } from '@/context/PostModalContext';
import PostModal from '@/components/PostModal';
import MobileTabBar from '@/components/MobileTabBar';
import { FeedProvider } from '@/context/FeedContext';
import { ToastProvider } from '@/context/ToastContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { AnalyticsConsentProvider } from '@/context/AnalyticsConsentContext';
import GoogleAnalyticsScript from '@/components/Analytics/GoogleAnalyticsScript';
import AnalyticsPageviewTracker from '@/components/Analytics/AnalyticsPageviewTracker';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gamelogd.net';
const SITE_DESCRIPTION = 'The social platform for gamers, developers, and investors.';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'Gamelogd',
        template: '%s | Gamelogd',
    },
    description: SITE_DESCRIPTION,
    openGraph: {
        type: 'website',
        siteName: 'Gamelogd',
        locale: 'en_US',
        url: '/',
        title: 'Gamelogd',
        description: SITE_DESCRIPTION,
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Gamelogd',
        description: SITE_DESCRIPTION,
    },
    icons: {
        icon: '/icon.png',
        shortcut: '/favicon.ico',
        apple: '/apple-icon.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body
                className="bg-zinc-950 text-zinc-100 antialiased"
                style={{ paddingBottom: 'var(--bottom-reserve)', transition: 'padding-bottom 300ms ease-out' }}
                suppressHydrationWarning={true}
            >
                <AnalyticsConsentProvider>
                    <GoogleAnalyticsScript />
                    <ToastProvider>
                        <ConfirmProvider>
                            <AuthProvider>
                                <AuthGateProvider>
                                    <NotificationProvider>
                                        <LogModalProvider>
                                            <ReplyModalProvider>
                                                <PostModalProvider>
                                                    <FeedProvider>
                                                        {children}
                                                        <MessagesDrawer />
                                                        <ClientLogModalWrapper />
                                                        <ReplyModal />
                                                        <PostModal />
                                                        <MobileTabBar />
                                                        <AnalyticsPageviewTracker />
                                                        <BottomBarStack />
                                                        {/* Mounted after BottomBarStack so it wins the shared z-[9999]
                                                            stacking tier if both happen to be visible at once. */}
                                                        <AuthRequiredModal />
                                                    </FeedProvider>
                                                </PostModalProvider>
                                            </ReplyModalProvider>
                                        </LogModalProvider>
                                    </NotificationProvider>
                                </AuthGateProvider>
                            </AuthProvider>
                        </ConfirmProvider>
                    </ToastProvider>
                </AnalyticsConsentProvider>
            </body>
        </html>
    );
}
