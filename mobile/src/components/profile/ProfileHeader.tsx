import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Cake, Calendar, Gamepad2, Link as LinkIcon, MapPin } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Image } from '@/components/ui/Image';
import ImageViewerModal from '@/components/ui/ImageViewerModal';
import ProfileActionsRow from './ProfileActionsRow';
import { getImageUrl, sanitizeUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface ProfileHeaderProps {
  profileUser: User;
  isOwnProfile: boolean;
  onUpdate: (patch: Partial<User>) => void;
  onRefetch: () => void;
}

const ROLE_BADGES = [
  { key: 'is_gamer' as const, label: strings.roleGamer, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
  { key: 'is_developer' as const, label: strings.roleDeveloper, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  { key: 'is_investor' as const, label: strings.roleInvestor, bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
];

// A character-count heuristic for "does this bio need a Show more toggle" — web measures
// the rendered <p>'s scrollHeight against its 3-line-clamped height; RN's Text has no
// equivalent layout measurement for this, so this is a flagged simplification (visually
// the same affordance, just not pixel-exact about exactly which bios qualify).
const BIO_SHOW_MORE_THRESHOLD = 140;

// Mirrors ProfileClient.tsx's SocialIcon helper's platform->icon mapping. Web itself
// already falls back to a generic Link icon for linkedin/facebook/instagram — twitter
// and github join that fallback here too, since lucide-react-native v1.x dropped brand
// icons (lucide-react 0.555 on web still has them) and installing a second icon library
// for just two icons wasn't worth it (user's call, asked directly). Steam keeps its own
// Gamepad2 icon, which isn't a brand logo and is unaffected.
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  steam: Gamepad2,
};

function formatJoined(dateJoined: string | undefined): string {
  if (!dateJoined) return '';
  const d = new Date(dateJoined);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatBirthDate(birthDate: string | undefined): string | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Mobile-width port of frontend/src/app/[username]/ProfileClient.tsx's header (the
// `lg:hidden` blocks specifically — desktop's side-by-side layout is out of scope, mobile
// never renders at that width). Step 4 scope only: static cover/avatar (no image-viewer
// tap — step 5), name + role badges, handle, bio + show-more, location/birthdate/joined
// row. Social links row and Follow/Message/overflow-menu actions are later steps.
export default function ProfileHeader({ profileUser, isOwnProfile, onUpdate, onRefetch }: ProfileHeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const name = profileUser.real_name || profileUser.username;
  const handle = `@${profileUser.username.toLowerCase()}`;
  const bio = profileUser.bio || strings.noBioYet;
  const joined = formatJoined(profileUser.date_joined);
  const birthDateLabel = profileUser.show_birth_date ? formatBirthDate(profileUser.birth_date) : null;
  const showBioToggle = !!profileUser.bio && profileUser.bio.length > BIO_SHOW_MORE_THRESHOLD;
  const avatarUrl = getImageUrl(profileUser.avatar, name);
  const coverUrl = profileUser.cover_image ? getImageUrl(profileUser.cover_image) : null;
  const socialLinks = Object.entries(profileUser.social_links || {}).filter(([, url]) => !!url);

  return (
    <View>
      <Pressable disabled={!coverUrl} onPress={() => setViewerUri(coverUrl)} className="h-40 w-full bg-zinc-950">
        {!!coverUrl && <Image source={{ uri: coverUrl }} style={{ flex: 1 }} contentFit="cover" />}
        {/* Mirrors web's `bg-gradient-to-t from-zinc-950 via-transparent to-transparent`
            overlay — fades the cover into the page background so the avatar/name area
            below reads as one continuous surface instead of a hard seam. */}
        <LinearGradient
          colors={['#09090b', 'transparent', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          pointerEvents="none"
        />
      </Pressable>

      <View className="px-4">
        {/* Web's mobile header is a `flex-col items-end` container — the Profile Info
            block is `w-full` so items-end has no visible effect there, but it right-
            aligns the avatar circle itself (self-end here is the RN equivalent). */}
        <Pressable onPress={() => setViewerUri(avatarUrl)} className="-mt-10 self-end">
          <View className="h-20 w-20 overflow-hidden rounded-full border-4 border-zinc-950 bg-zinc-900">
            <Image source={{ uri: avatarUrl }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        </Pressable>

        <View className="mt-2">
          <View className="flex-row items-center justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 text-xl font-bold text-white">
              {name}
            </Text>
            <ProfileActionsRow profileUser={profileUser} isOwnProfile={isOwnProfile} onUpdate={onUpdate} onRefetch={onRefetch} />
          </View>

          <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
            <Text className="font-medium text-zinc-400">{handle}</Text>
            {ROLE_BADGES.filter((badge) => profileUser[badge.key]).map((badge) => (
              <View key={badge.key} className={`rounded-lg border px-2 py-0.5 ${badge.bg} ${badge.border}`}>
                <Text className={`text-[10px] font-bold uppercase tracking-wider ${badge.text}`}>{badge.label}</Text>
              </View>
            ))}
          </View>

          <View className="mt-2">
            <Text numberOfLines={bioExpanded ? undefined : 3} className="text-sm leading-relaxed text-zinc-300">
              {bio}
            </Text>
            {showBioToggle && (
              <Text onPress={() => setBioExpanded((v) => !v)} className="mt-0.5 text-xs font-semibold text-emerald-500">
                {bioExpanded ? strings.showLess : `${strings.showMore}...`}
              </Text>
            )}
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
            {!!profileUser.location && profileUser.location.trim().length > 0 && (
              <View className="flex-row items-center gap-1.5">
                <MapPin size={14} color="#71717a" />
                <Text className="text-xs text-zinc-500">{profileUser.location}</Text>
              </View>
            )}
            {!!birthDateLabel && (
              <View className="flex-row items-center gap-1.5">
                <Cake size={14} color="#71717a" />
                <Text className="text-xs text-zinc-500">
                  {strings.born} {birthDateLabel}
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-1.5">
              <Calendar size={14} color="#71717a" />
              <Text className="text-xs text-zinc-500">
                {strings.joined} {joined}
              </Text>
            </View>
          </View>

          {socialLinks.length > 0 && (
            <View className="mt-3 flex-row flex-wrap items-center gap-3">
              {socialLinks.map(([platform, url]) => {
                const Icon = SOCIAL_ICONS[platform] || LinkIcon;
                return (
                  <Pressable
                    key={platform}
                    onPress={() => Linking.openURL(sanitizeUrl(url))}
                    className="rounded-lg bg-zinc-800 p-2"
                  >
                    <Icon size={18} color="#d4d4d8" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <ImageViewerModal visible={!!viewerUri} uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}
