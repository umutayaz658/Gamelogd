import { ComponentType, memo, useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import useSWR from 'swr';
import { ArrowLeft, ArrowUpDown, ChevronDown, Funnel, Gamepad2, Monitor, Play } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import SelectPickerModal, { SelectOption } from '@/components/ui/SelectPickerModal';
import api, { fetcher, unwrapList } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBottomInset } from '@/context/BottomInsetContext';
import { useToast } from '@/context/ToastContext';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { LibraryEntry } from '@/types';

const formatHours = (hours: number) => `${hours}h`;
const NO_PLAYTIME_PLACEHOLDER = '--';

const STATUS_OPTIONS = ['unplayed', 'plan_to_play', 'playing', 'replaying', 'completed', 'dropped'];
const STATUS_LABELS: Record<string, string> = {
  all: strings.all,
  unplayed: strings.unplayed,
  plan_to_play: strings.planToPlay,
  playing: strings.playingStatus,
  replaying: strings.replaying,
  completed: strings.completed,
  dropped: strings.dropped,
};

// Static — none of these depend on component state, so they're computed once at module
// load instead of on every render (they used to live inside the component body).
const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: strings.all },
  ...STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];
const PLATFORM_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: strings.allPlatforms },
  { value: 'Steam', label: 'Steam' },
  { value: 'Xbox', label: 'Xbox' },
];
const SORT_OPTIONS: SelectOption[] = [
  { value: 'playtime', label: strings.playtime },
  { value: 'name', label: strings.name },
];
const EDIT_STATUS_OPTIONS: SelectOption[] = STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'steam') return <Gamepad2 size={12} color="#60a5fa" />;
  if (p === 'psn' || p === 'playstation') return <Gamepad2 size={12} color="#2563eb" />;
  if (p === 'xbox') return <Gamepad2 size={12} color="#22c55e" />;
  if (p === 'ea') return <Play size={12} color="#ef4444" />;
  return <Monitor size={12} color="#a1a1aa" />;
}

// Port of FilterDropdown.tsx's trigger button (the part visible before it's tapped —
// the popover itself has no mobile equivalent, see SelectPickerModal). Matches its exact
// two-state styling: unaccented (bg-zinc-950/border-zinc-800/zinc-400 text) vs accented
// (bg-zinc-800/border-zinc-700, emerald-500 icon+label but a *white* chevron — the
// chevron sits outside web's emerald-tinted inner span, inheriting the button's own
// text-white instead).
function FilterTrigger({
  icon: Icon,
  label,
  isAccented,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  isAccented: boolean;
  onPress: () => void;
}) {
  const contentColor = isAccented ? '#10b981' : '#a1a1aa';
  const chevronColor = isAccented ? '#ffffff' : '#a1a1aa';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-shrink-0 flex-row items-center gap-2 rounded-xl border px-4 py-2.5 ${
        isAccented ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-800 bg-zinc-950'
      }`}
    >
      <Icon size={16} color={contentColor} />
      <Text numberOfLines={1} style={{ color: contentColor }} className="text-sm font-medium">
        {label}
      </Text>
      <ChevronDown size={16} color={chevronColor} />
    </Pressable>
  );
}

// A dedicated, memoized row — this was previously inline inside `renderItem`, which
// meant every library entry got a brand new element on every render of the *screen*,
// including on totally unrelated state changes like opening a filter picker. With a
// library of ~50 entries, that's ~50 rows' worth of reconciliation work blocking the JS
// thread between a button tap and the modal actually becoming visible, which is what
// made every open/select/dismiss feel laggy. React.memo skips a row's re-render entirely
// when its own props haven't changed, so only the filtered-in rows (and only when the
// list itself changes) ever re-render now.
const LibraryRow = memo(function LibraryRow({
  entry,
  isOwnProfile,
  isUpdating,
  onEditStatus,
}: {
  entry: LibraryEntry;
  isOwnProfile: boolean;
  isUpdating: boolean;
  onEditStatus: (id: number) => void;
}) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <View className="h-16 w-12 overflow-hidden rounded-lg bg-zinc-950">
        {entry.game.cover_image ? (
          <Image source={{ uri: getImageUrl(entry.game.cover_image) }} style={{ flex: 1 }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Gamepad2 size={20} color="#3f3f46" />
          </View>
        )}
      </View>

      <Pressable onPress={() => router.push(`/games/${entry.game.id}` as never)} className="flex-1">
        <Text numberOfLines={1} className="font-bold text-white">
          {entry.game.title}
        </Text>
        <View className="mt-1 flex-row items-center gap-2">
          <View className="flex-row items-center gap-1">
            <PlatformIcon platform={entry.platform} />
            <Text className="text-xs uppercase text-zinc-400">{entry.platform}</Text>
          </View>
          <View className="h-1 w-1 rounded-full bg-zinc-600" />
          <Text className="text-xs font-bold capitalize text-emerald-400">{STATUS_LABELS[entry.status] || entry.status}</Text>
        </View>
      </Pressable>

      <View className="items-end">
        {!(entry.platform === 'Xbox' && entry.playtime_hours === 0) ? (
          <Text className="text-sm font-bold text-zinc-400">{formatHours(entry.playtime_hours)}</Text>
        ) : (
          <Text className="text-sm font-bold text-zinc-600">{NO_PLAYTIME_PLACEHOLDER}</Text>
        )}
      </View>

      {isOwnProfile && (
        <Pressable onPress={() => onEditStatus(entry.id)} disabled={isUpdating} hitSlop={8} className="rounded-lg p-2">
          {isUpdating ? <ActivityIndicator size="small" color="#a1a1aa" /> : <Funnel size={16} color="#a1a1aa" />}
        </Pressable>
      )}
    </View>
  );
});

// Port of GameLibraryClient.tsx — mobile only ever renders its "list card" (decision 12:
// no grid/list toggle, web forces list view on mobile too). web's FilterDropdown popover
// has no mobile equivalent, so the three filter triggers below open SelectPickerModal
// instead — same single-choice result, a modal instead of an inline popover. The
// "sticky" filter bar is not actually sticky here (scrolls away with the list), the same
// simplification already applied to ProfileTabs' own tab bar.
export default function GameLibraryScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: viewer } = useAuth();
  const toast = useToast();
  const bottomInset = useBottomInset();
  const isOwnProfile = viewer?.username?.toLowerCase() === username?.toLowerCase();

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [sortBy, setSortBy] = useState<'playtime' | 'name'>('playtime');
  // One Modal, not four mounted simultaneously (one per picker) — see SelectPickerModal.
  // `activePicker` selects which picker's title/options/value/onSelect it shows.
  const [activePicker, setActivePicker] = useState<'status' | 'platform' | 'sort' | 'editStatus' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Fetched once, unfiltered — the backend has no pagination on this endpoint (confirmed:
  // no DEFAULT_PAGINATION_CLASS, no pagination_class override on LibraryViewSet), so the
  // whole library is already in hand after the first load. Status/platform/sort used to
  // each be their own query param, refetching from the server on every change — correct,
  // but pointless latency for data that's already sitting in memory, so filtering and
  // sorting now happen client-side instead.
  const libraryKey = username ? `/library/?user__username=${username}` : null;
  const { data, error, isLoading, mutate } = useSWR<LibraryEntry[] | { results: LibraryEntry[] }>(libraryKey, fetcher);
  const allEntries = unwrapList<LibraryEntry>(data);

  const entries = useMemo(() => {
    let list = allEntries;
    if (filterStatus !== 'all') list = list.filter((e) => e.status === filterStatus);
    if (filterPlatform !== 'all') list = list.filter((e) => e.platform === filterPlatform);
    return [...list].sort((a, b) =>
      sortBy === 'playtime' ? b.playtime_forever - a.playtime_forever : a.game.title.localeCompare(b.game.title)
    );
  }, [allEntries, filterStatus, filterPlatform, sortBy]);

  const totalGames = entries.length;
  const totalHours = Math.round(entries.reduce((acc, e) => acc + e.playtime_hours, 0));

  const handleStatusUpdate = useCallback(
    async (entryId: number, newStatus: string) => {
      setUpdatingId(entryId);
      const original = data;
      mutate((current) => {
        const list = unwrapList<LibraryEntry>(current).map((e) => (e.id === entryId ? { ...e, status: newStatus } : e));
        return Array.isArray(current) ? list : { ...current, results: list };
      }, { revalidate: false });
      try {
        await api.patch(`/library/${entryId}/`, { status: newStatus });
        setEditingId(null);
      } catch (err) {
        console.error('Failed to update status:', err);
        mutate(original, { revalidate: false });
        toast.error(strings.failedToUpdateStatus);
      } finally {
        setUpdatingId(null);
      }
    },
    [data, mutate, toast]
  );

  const handleEditStatus = useCallback((id: number) => {
    setEditingId(id);
    setActivePicker('editStatus');
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LibraryEntry }) => (
      <View className="px-4">
        <LibraryRow entry={item} isOwnProfile={isOwnProfile} isUpdating={updatingId === item.id} onEditStatus={handleEditStatus} />
      </View>
    ),
    [isOwnProfile, updatingId, handleEditStatus]
  );

  const header = useMemo(() => (
    <>
      {/* pt-6 (24px) matches web's <main> wrapper — same breathing room below the
          persistent TopHeader that every other screen already gets implicitly from
          its own hero/content shape; this screen's text-only title needed it spelled
          out explicitly. */}
      <View className="mb-8 px-4 pt-6">
        <View className="mb-2 flex-row items-center gap-3">
          <Pressable onPress={() => router.push(`/${username}` as never)} hitSlop={8} className="-ml-2 rounded-full p-2">
            <ArrowLeft size={20} color="#a1a1aa" />
          </Pressable>
          <Text numberOfLines={1} className="flex-1 text-2xl font-bold text-white">
            {strings.gamesLibraryTitle.replace('{username}', username ?? '')}
          </Text>
        </View>
        <View className="ml-11 flex-row flex-wrap items-center gap-x-1.5">
          <Text className="font-bold text-white">{totalGames}</Text>
          <Text className="text-zinc-400">{strings.gamesInCollection}</Text>
          <View className="h-1 w-1 rounded-full bg-zinc-600" />
          <Text className="font-bold text-emerald-400">{formatHours(totalHours)}</Text>
          <Text className="text-zinc-400">{strings.playedTotal}</Text>
        </View>
      </View>

      <View className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-3">
            <FilterTrigger
              icon={Funnel}
              label={filterStatus === 'all' ? strings.status : STATUS_LABELS[filterStatus]}
              isAccented={filterStatus !== 'all'}
              onPress={() => setActivePicker('status')}
            />
            <FilterTrigger
              icon={Gamepad2}
              label={filterPlatform === 'all' ? strings.allPlatforms : filterPlatform}
              isAccented={filterPlatform !== 'all'}
              onPress={() => setActivePicker('platform')}
            />
            <FilterTrigger
              icon={ArrowUpDown}
              label={sortBy === 'playtime' ? strings.playtime : strings.name}
              isAccented={false}
              onPress={() => setActivePicker('sort')}
            />
          </View>
        </ScrollView>
      </View>
    </>
  ), [username, totalGames, totalHours, filterStatus, filterPlatform, sortBy]);

  const empty = isLoading ? (
    <View className="items-center py-20">
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  ) : error ? (
    <View className="items-center py-20">
      <Text className="text-red-400">{strings.failedToLoadLibrary}</Text>
    </View>
  ) : (
    <View className="mx-4 items-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-20">
      <Gamepad2 size={48} color="#3f3f46" />
      <Text className="mb-2 mt-4 text-lg font-medium text-zinc-500">{strings.noGamesInLibrary}</Text>
      <Text className="mb-6 text-sm text-zinc-500">{strings.adjustFiltersOrSync}</Text>
      {/* Settings (Steam/Xbox connect) is a Faz 7 screen — not built yet, so this is a
          plain, non-interactive pill rather than a real link, same "render faithfully,
          wire later" treatment as other not-yet-built destinations this phase. */}
      <View className="rounded-lg bg-emerald-600 px-4 py-2">
        <Text className="text-sm font-medium text-white">{strings.connectAccounts}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-950">
      <FlatList
        data={entries}
        keyExtractor={(entry) => String(entry.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        renderItem={renderItem}
      />

      <SelectPickerModal
        visible={activePicker !== null}
        onClose={() => {
          setActivePicker(null);
          if (activePicker === 'editStatus') setEditingId(null);
        }}
        title={
          activePicker === 'status'
            ? strings.status
            : activePicker === 'platform'
              ? strings.platforms
              : activePicker === 'sort'
                ? strings.sortBy
                : strings.selectStatus
        }
        options={
          activePicker === 'status'
            ? STATUS_FILTER_OPTIONS
            : activePicker === 'platform'
              ? PLATFORM_FILTER_OPTIONS
              : activePicker === 'sort'
                ? SORT_OPTIONS
                : EDIT_STATUS_OPTIONS
        }
        value={
          activePicker === 'status'
            ? filterStatus
            : activePicker === 'platform'
              ? filterPlatform
              : activePicker === 'sort'
                ? sortBy
                : entries.find((e) => e.id === editingId)?.status ?? ''
        }
        onSelect={(v) => {
          if (activePicker === 'status') setFilterStatus(v);
          else if (activePicker === 'platform') setFilterPlatform(v);
          else if (activePicker === 'sort') setSortBy(v as 'playtime' | 'name');
          else if (activePicker === 'editStatus' && editingId !== null) handleStatusUpdate(editingId, v);
        }}
      />
    </View>
  );
}
