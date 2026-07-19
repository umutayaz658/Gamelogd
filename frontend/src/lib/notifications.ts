import {
    Heart,
    AtSign,
    MessageSquare,
    Repeat,
    UserPlus,
    Lock,
    Users,
    CheckCircle2,
    Eye,
    Crown,
    Gamepad2,
    Bell,
    type LucideIcon,
} from 'lucide-react';
import type { TranslationKeys } from './useTranslation';

export type NotificationType =
    | 'like'
    | 'mention'
    | 'reply'
    | 'comment_review'
    | 'repost'
    | 'quote'
    | 'follow'
    | 'follow_request'
    | 'follow_request_accepted'
    | 'project_invite'
    | 'project_invite_accepted'
    | 'project_followed'
    | 'org_invite'
    | 'org_invite_accepted'
    | 'org_ownership_transfer_to_you'
    | 'org_ownership_transfer_confirmation'
    | 'group_invite'
    | 'steam_sync_success'
    | 'steam_sync_failed'
    | 'unknown';

type Translate = (key: keyof TranslationKeys) => string;

// Single source of truth for classifying a notification's free-text `verb`
// (the backend has no real notification_type field — see backend/api/models.py:159).
// Ordered from most to least specific so overlapping substrings (e.g. "invited you
// to join the project" vs "invited you to join {org name}") resolve correctly.
export function resolveNotificationType(verb: string, isSelfActor: boolean): NotificationType {
    const v = verb.toLowerCase();

    if (v.startsWith('your steam library sync')) return 'steam_sync_success';
    if (v.startsWith('steam library sync failed')) return 'steam_sync_failed';
    // Shares the "transferred ownership of" phrase between the new owner's
    // notification and the old owner's self-notification confirmation — only
    // isSelfActor (actor === recipient) tells them apart.
    if (v.includes('transferred ownership of')) {
        return isSelfActor ? 'org_ownership_transfer_confirmation' : 'org_ownership_transfer_to_you';
    }

    if (v.includes('requested to follow')) return 'follow_request';
    if (v.includes('accepted your follow request')) return 'follow_request_accepted';
    if (v.includes('accepted your invite to join the project')) return 'project_invite_accepted';
    if (v.includes('invited you to join the project')) return 'project_invite';
    if (v.includes('followed your project')) return 'project_followed';
    if (v.includes('accepted your invitation to join')) return 'org_invite_accepted';
    if (v.includes('invited you to a group chat')) return 'group_invite';
    if (v.includes('invited you to join')) return 'org_invite';
    if (v.includes('started following') || v.includes('followed you') || v.includes('following you')) return 'follow';
    if (v.includes('commented on your review')) return 'comment_review';
    if (v.includes('replied')) return 'reply';
    if (v.includes('liked')) return 'like';
    if (v.includes('mentioned')) return 'mention';
    if (v.includes('quoted')) return 'quote';
    if (v.includes('reposted')) return 'repost';

    return 'unknown';
}

const ICONS: Record<NotificationType, LucideIcon> = {
    like: Heart,
    mention: AtSign,
    reply: MessageSquare,
    comment_review: MessageSquare,
    repost: Repeat,
    quote: Repeat,
    follow: UserPlus,
    follow_request: Lock,
    follow_request_accepted: CheckCircle2,
    project_invite: Users,
    project_invite_accepted: CheckCircle2,
    project_followed: Eye,
    org_invite: Users,
    org_invite_accepted: CheckCircle2,
    org_ownership_transfer_to_you: Crown,
    org_ownership_transfer_confirmation: Crown,
    group_invite: Users,
    steam_sync_success: Gamepad2,
    steam_sync_failed: Gamepad2,
    unknown: Bell,
};

// One neutral icon shape per type — color is intentionally NOT part of this
// mapping (applied uniformly by the caller) so notifications read as a single
// professional list rather than a rainbow of per-type colors.
export function getNotificationIcon(type: NotificationType): LucideIcon {
    return ICONS[type] || Bell;
}

function extractAfter(verb: string, prefix: string): string {
    const idx = verb.toLowerCase().indexOf(prefix.toLowerCase());
    if (idx === -1) return '';
    return verb.slice(idx + prefix.length).trim();
}

export function getNotificationText(type: NotificationType, verb: string, t: Translate): string {
    switch (type) {
        case 'like':
            if (verb.includes('review')) return t('verbLikedYourReview');
            if (verb.includes('comment')) return t('verbLikedYourComment');
            return t('verbLikedYourPost');
        case 'mention':
            if (verb.includes('comment')) return t('verbMentionedYouComment');
            return t('verbMentionedYouPost');
        case 'reply':
            if (verb.includes('review')) return t('verbRepliedYourReview');
            if (verb.includes('comment')) return t('verbRepliedYourComment');
            return t('verbRepliedYourPost');
        case 'comment_review':
            return t('verbCommentedYourReview');
        case 'repost':
            return t('verbRepostedYourPost');
        case 'quote':
            return t('verbQuotedYourPost');
        case 'follow':
            return t('verbFollowedYou');
        case 'follow_request':
            return t('verbRequestedFollowYou');
        case 'follow_request_accepted':
            return t('verbAcceptedFollowRequest');
        case 'project_invite':
            return t('verbInvitedYouToJoin');
        case 'project_invite_accepted':
            return t('verbAcceptedProjectInvite');
        case 'project_followed':
            return t('verbFollowedYourProject');
        case 'group_invite':
            return t('verbGroupChatInvite');
        case 'org_invite': {
            const orgName = extractAfter(verb, 'invited you to join ');
            return orgName ? `${t('verbInvitedYouToJoin')} ${orgName}` : t('verbInvitedYouToJoin');
        }
        case 'org_invite_accepted': {
            const orgName = extractAfter(verb, 'accepted your invitation to join ');
            return orgName ? `${t('verbAcceptedOrgInvite')} ${orgName}` : t('verbAcceptedOrgInvite');
        }
        case 'org_ownership_transfer_to_you': {
            const match = verb.match(/^transferred ownership of (.+) to you$/i);
            const orgName = match ? match[1] : '';
            return t('verbTransferredOwnershipToYou').replace('{org}', orgName);
        }
        case 'org_ownership_transfer_confirmation': {
            const match = verb.match(/^transferred ownership of (.+) to (.+)$/i);
            const orgName = match ? match[1] : '';
            const username = match ? match[2] : '';
            return t('verbTransferredOwnershipConfirmation').replace('{org}', orgName).replace('{username}', username);
        }
        case 'steam_sync_success':
            // Backend bakes synced/total counts directly into the sentence — no
            // structured data to re-translate, shown as-is (known i18n limitation).
            return verb;
        case 'steam_sync_failed':
            return t('systemSteamSyncFailed');
        default:
            return verb;
    }
}

// Self-authored notifications (actor === recipient) that shouldn't be rendered
// as "{actor} did X" — they get a plain icon+message row instead.
export function isSystemNotification(type: NotificationType): boolean {
    return type === 'steam_sync_success' || type === 'steam_sync_failed' || type === 'org_ownership_transfer_confirmation';
}

// Steam sync notifications carry no backend `target`, so the frontend derives
// their link itself; other system types (ownership transfer) fall back to
// whatever target_url the backend computed.
export function getSystemTargetUrl(type: NotificationType, username: string, targetUrl?: string | null): string | null {
    if (type === 'steam_sync_success' || type === 'steam_sync_failed') return `/${username}/games`;
    return targetUrl || null;
}

export type InviteEndpoints = {
    accept: string;
    decline: string;
    declineMethod: 'post' | 'delete';
};

// Centralizes accept/decline routing for the three invite kinds — fixes a real
// bug where group-chat invites (target = a Conversation id) were being POSTed
// to the organisation-invitations endpoint because both shared the generic
// "invited" substring check.
export function getInviteEndpoints(type: NotificationType, targetId: number): InviteEndpoints {
    if (type === 'project_invite') {
        return {
            accept: `/project-members/${targetId}/accept/`,
            decline: `/project-members/${targetId}/`,
            declineMethod: 'delete',
        };
    }
    if (type === 'group_invite') {
        return {
            accept: `/conversations/${targetId}/accept-invite/`,
            decline: `/conversations/${targetId}/decline-invite/`,
            declineMethod: 'post',
        };
    }
    return {
        accept: `/organisation-invitations/${targetId}/accept/`,
        decline: `/organisation-invitations/${targetId}/decline/`,
        declineMethod: 'post',
    };
}

export function isInviteType(type: NotificationType): boolean {
    return type === 'project_invite' || type === 'org_invite' || type === 'group_invite';
}

export function getFilterGroup(type: NotificationType): 'mentions' | 'follow_requests' | null {
    if (type === 'mention' || type === 'reply' || type === 'comment_review') return 'mentions';
    if (type === 'follow_request') return 'follow_requests';
    return null;
}
