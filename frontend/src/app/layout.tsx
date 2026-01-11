import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import MessagesDrawer from '@/components/MessagesDrawer';
import { LogModalProvider } from '@/context/LogModalContext';
import ClientLogModalWrapper from '@/components/ClientLogModalWrapper';
import { ReplyModalProvider } from '@/context/ReplyModalContext';
import ReplyModal from '@/components/ReplyModal';
import { FeedProvider } from '@/context/FeedContext';

const inter = Inter({ subsets: ['latin'] });

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
            <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`} suppressHydrationWarning={true}>
                <AuthProvider>
                    <NotificationProvider>
                        <LogModalProvider>
                            <ReplyModalProvider>
                                <FeedProvider>
                                    {children}
                                    <MessagesDrawer />
                                    <ClientLogModalWrapper />
                                    <ReplyModal />
                                </FeedProvider>
                            </ReplyModalProvider>
                        </LogModalProvider>
                    </NotificationProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
