'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getRelativeTime } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';
import type { Notification } from '@/types';
import AvatarStack from '@/components/ui/AvatarStack';
import {
    getEffectiveType,
    getNotificationText,
    isSystemNotification,
    getSystemTargetUrl,
    isInviteType,
} from '@/lib/notifications';

interface NotificationRowProps {
    notif: Notification;
    isSelfActor: boolean;
    processingRequest: string | null;
    onAcceptInvite: (e: React.MouseEvent, targetId: number | undefined, type: ReturnType<typeof getEffectiveType>) => void;
    onDeclineInvite: (e: React.MouseEvent, targetId: number | undefined, type: ReturnType<typeof getEffectiveType>) => void;
    onApproveFollowRequest: (e: React.MouseEvent, username: string) => void;
    onRejectFollowRequest: (e: React.MouseEvent, username: string) => void;
}

export default function NotificationRow({
    notif,
    isSelfActor,
    processingRequest,
    onAcceptInvite,
    onDeclineInvite,
    onApproveFollowRequest,
    onRejectFollowRequest,
}: NotificationRowProps) {
    const router = useRouter();
    const { t, language } = useTranslation();

    const type = getEffectiveType(notif.notification_type, notif.verb, isSelfActor);
    const actorCount = notif.actor_count ?? 1;
    const recentActors = notif.recent_actors?.length ? notif.recent_actors : [notif.actor];
    const text = getNotificationText(type, notif.verb, t) + '.';
    const isSystem = isSystemNotification(type);
    const isFollowRequest = type === 'follow_request';
    const isProcessing = processingRequest === notif.actor.username;

    const clickTarget = isSystem
        ? getSystemTargetUrl(type, notif.actor.username, notif.target_url)
        : isFollowRequest
            ? `/${notif.actor.username}`
            : (notif.target_url || `/${notif.actor.username}`);

    if (isSystem) {
        return (
            <div
                role="link"
                tabIndex={0}
                className="p-4 flex gap-4 transition-colors cursor-pointer hover:bg-zinc-800/30"
                onClick={() => { if (clickTarget) router.push(clickTarget); }}
            >
                <p className="text-zinc-300 flex-1">
                    {text} <span className="text-zinc-500 text-sm">{getRelativeTime(notif.created_at, language)}</span>
                </p>
            </div>
        );
    }

    return (
        <div
            role="link"
            tabIndex={0}
            className="p-4 flex items-start gap-4 transition-colors cursor-pointer hover:bg-zinc-800/30"
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('a')) return;
                if (clickTarget) router.push(clickTarget);
            }}
        >
            <Link href={`/${notif.actor.username}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                <AvatarStack users={recentActors} total={actorCount} />
            </Link>

            <div className="flex-1">
                <p>
                    <Link href={`/${notif.actor.username}`} className="font-bold text-white hover:underline">
                        {notif.actor.username}
                    </Link>{' '}
                    {actorCount > 1 && (
                        <span className="text-zinc-400">{t('andNOthers').replace('{count}', String(actorCount - 1))}</span>
                    )}{' '}
                    <span className="text-zinc-400">{text}</span>{' '}
                    <span className="text-zinc-500 text-sm">{getRelativeTime(notif.created_at, language)}</span>
                </p>

                {isInviteType(type) && (
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={(e) => onAcceptInvite(e, notif.target_id, type)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors"
                        >
                            {t('accept')}
                        </button>
                        <button
                            onClick={(e) => onDeclineInvite(e, notif.target_id, type)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors border border-zinc-700"
                        >
                            {t('decline')}
                        </button>
                    </div>
                )}

                {isFollowRequest && (
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onApproveFollowRequest(e, notif.actor.username); }}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
                        >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {t('accept')}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRejectFollowRequest(e, notif.actor.username); }}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 cursor-pointer"
                        >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {t('decline')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
