import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import MessagesDrawer from '@/components/MessagesDrawer';

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
                        {children}
                        <MessagesDrawer />
                    </NotificationProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
