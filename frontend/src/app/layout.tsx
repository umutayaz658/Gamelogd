import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
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

export const metadata: Metadata = {
    title: 'Gamelogd',
    description: 'The social platform for gamers, developers, and investors.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="bg-zinc-950 text-zinc-100 antialiased pb-14 lg:pb-0" suppressHydrationWarning={true}>
                <ToastProvider>
                    <ConfirmProvider>
                        <AuthProvider>
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
                                            </FeedProvider>
                                        </PostModalProvider>
                                    </ReplyModalProvider>
                                </LogModalProvider>
                            </NotificationProvider>
                        </AuthProvider>
                    </ConfirmProvider>
                </ToastProvider>
            </body>
        </html>
    );
}
