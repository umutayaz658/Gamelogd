import { ComponentType, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Calendar, Check, ChevronDown, EyeOff, Heart, Search, X } from 'lucide-react-native';

import { Image } from '@/components/ui/Image';
import GameSearchResultsList from '@/components/game/GameSearchResultsList';
import { useGameSearch } from '@/lib/hooks/useGameSearch';
import api, { unwrapList } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl, getRatingColor } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { Game, Review } from '@/types';

const DEFAULT_PLATFORMS = ['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Mobile'];

// Matches the header text block's own height (back-arrow+title row + game title row +
// date row, with their gaps) — explicit pixel size rather than aspectRatio+stretch, same
// "don't trust Yoga to derive this" caution as TopFavoritesGrid.
const HEADER_THUMB_HEIGHT = 66;
const HEADER_THUMB_WIDTH = Math.round((HEADER_THUMB_HEIGHT * 3) / 4);

interface LogGameModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialGame?: Game | null;
  existingReview?: Review | null;
  isReplay?: boolean;
}

function ordinal(n: number): string {
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function extractErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: unknown } };
  const data = err?.response?.data;
  if (!data) return strings.unexpectedError;
  if (Array.isArray(data)) return String(data[0]);
  if (typeof data === 'object') {
    const firstKey = Object.keys(data as Record<string, unknown>)[0];
    const firstError = (data as Record<string, unknown>)[firstKey];
    return String(Array.isArray(firstError) ? firstError[0] : firstError);
  }
  if (typeof data === 'string') return data;
  return strings.failedToSubmitReview;
}

function ToggleButton({
  active,
  onPress,
  icon: Icon,
  activeColor,
  label,
  fillIcon,
}: {
  active: boolean;
  onPress: () => void;
  icon: ComponentType<{ size?: number; color?: string; fill?: string }>;
  activeColor: string;
  label: string;
  fillIcon?: boolean;
}) {
  const iconColor = active ? '#ffffff' : '#a1a1aa';
  return (
    <Pressable
      onPress={onPress}
      style={{ borderColor: active ? activeColor : '#27272a', backgroundColor: active ? `${activeColor}1a` : '#09090b' }}
      className="flex-1 items-center gap-1.5 rounded-xl border p-2.5"
    >
      <View style={{ backgroundColor: active ? activeColor : '#27272a', borderRadius: 999, padding: 6 }}>
        {/* Passing fill={undefined} explicitly (rather than omitting the prop) overrides
            lucide's own internal `fill: 'none'` default via prop-spread, and an SVG with
            no recognized fill value falls back to the spec default of black — the "siyah
            arka plan" behind Check/EyeOff. Only pass `fill` at all when this icon
            actually needs the toggle-between-filled/outline behavior (Heart). */}
        {fillIcon ? <Icon size={16} color={iconColor} fill={active ? iconColor : 'none'} /> : <Icon size={16} color={iconColor} />}
      </View>
      <Text style={{ color: iconColor }} className="text-xs font-bold">
        {label}
      </Text>
    </Pressable>
  );
}

const SLIDER_TRACK_HEIGHT = 12;
const SLIDER_THUMB_SIZE = 20;

// A gesture-drawn slider, not @react-native-community/slider — that library wraps the
// OS's own native slider control (UISlider/SeekBar), which doesn't expose any prop for
// track thickness/color beyond tint colors, so it couldn't be made to visually match
// web's custom-styled <input type="range"> (h-3 track, h-5 thumb). Drawn by hand instead:
// tap anywhere on the track to jump there, or drag the thumb — the thumb's travel range
// is inset by its own radius on each side so it never overflows the track's ends, with
// the filled portion always meeting exactly where the thumb is.
function RatingSlider({ value, onValueChange }: { value: number; onValueChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const color = getRatingColor(value);

  // Mutable, read/written only from inside the gesture callbacks below (never during
  // render) — exactly what useRef is for. `panResponder` itself is different: it's read
  // during render (spread into JSX as panHandlers), which is why *that* is a useState
  // lazy-initializer instead of a useRef(...).current — the latter trips the
  // react-hooks/refs rule for a value read during render.
  const gesture = useRef({ trackWidth: 0, startRatio: value / 10 }).current;

  // The callbacks below only ever read/write `gesture` once an actual touch event
  // fires — never during render — but react-hooks/refs' static check flags any closure
  // passed into another function (PanResponder.create) that touches a ref-derived
  // value, with no way to tell it that these specific callbacks are event handlers, not
  // render-time code. This is RN's own documented PanResponder pattern.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const usable = Math.max(1, gesture.trackWidth - SLIDER_THUMB_SIZE);
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.locationX - SLIDER_THUMB_SIZE / 2) / usable));
        gesture.startRatio = ratio;
        onValueChange(Math.round(ratio * 100) / 10);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const usable = Math.max(1, gesture.trackWidth - SLIDER_THUMB_SIZE);
        const ratio = Math.min(1, Math.max(0, gesture.startRatio + gestureState.dx / usable));
        onValueChange(Math.round(ratio * 100) / 10);
      },
    })
  );

  const usableWidth = Math.max(0, trackWidth - SLIDER_THUMB_SIZE);
  const ratio = Math.min(1, Math.max(0, value / 10));
  const thumbCenterX = SLIDER_THUMB_SIZE / 2 + ratio * usableWidth;

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setTrackWidth(w);
        gesture.trackWidth = w;
      }}
      style={{ height: SLIDER_THUMB_SIZE + 12, justifyContent: 'center' }}
    >
      <View style={{ height: SLIDER_TRACK_HEIGHT, borderRadius: SLIDER_TRACK_HEIGHT / 2, backgroundColor: '#27272a', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: thumbCenterX, backgroundColor: color }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: thumbCenterX - SLIDER_THUMB_SIZE / 2,
          width: SLIDER_THUMB_SIZE,
          height: SLIDER_THUMB_SIZE,
          borderRadius: SLIDER_THUMB_SIZE / 2,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        }}
      />
    </View>
  );
}

function PlatformPickerModal({
  visible,
  onClose,
  options,
  selected,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  options: string[];
  selected: string[];
  onToggle: (platform: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 p-4" onPress={onClose}>
        <View style={{ maxHeight: '70%' }} className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <View className="flex-row items-center justify-between border-b border-zinc-800 p-4">
            <Text className="text-base font-bold text-white">{strings.platform}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color="#a1a1aa" />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 8 }}>
            {options.map((platform) => {
              const isSelected = selected.includes(platform);
              return (
                <Pressable
                  key={platform}
                  onPress={() => onToggle(platform)}
                  className="flex-row items-center justify-between rounded-xl p-3 active:bg-zinc-800"
                >
                  <Text className="text-sm text-zinc-200">{platform}</Text>
                  {isSelected && <Check size={16} color="#10b981" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// Port of frontend/src/components/LogGameModal.tsx. Step 1 reuses useGameSearch +
// GameSearchResultsList (Faz 2 plan decision 9) instead of its own duplicated search
// logic. Step 2's left "tap cover to change game" block has no visible hint on mobile —
// web's own "Change Game" overlay is hover-only, which the user confirmed (while testing
// TopFavoritesGrid) never appears on web's own mobile view either, so this mirrors that.
// The platform multi-select is a small modal with checkable rows instead of web's
// FilterDropdown popover (no such component exists on mobile) — same end result
// (multiple platforms selectable), different, simpler interaction shape.
export default function LogGameModal({ visible, onClose, onSuccess, initialGame, existingReview, isReplay }: LogGameModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const { query, setQuery, results, isLoading: searchLoading } = useGameSearch();

  const [rating, setRating] = useState(5.0);
  const [content, setContent] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nextPlaythrough, setNextPlaythrough] = useState(2);
  const [playtimeHours, setPlaytimeHours] = useState<number | ''>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [gamePlatforms, setGamePlatforms] = useState<string[]>([]);
  const [platformPickerVisible, setPlatformPickerVisible] = useState(false);

  // Reset/prefill on open — render-phase sync (not an effect, which the lint rule flags
  // for a synchronous setState) matching the wasVisible pattern used throughout this
  // phase for "Modal stays mounted via `visible` prop, so local state needs resetting on
  // each re-open."
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setStep(1);
      setQuery('');
      setSelectedGame(null);
      setRating(5.0);
      setContent('');
      setIsLiked(false);
      setIsCompleted(false);
      setContainsSpoilers(false);
      setSubmitError(null);
      setPlaytimeHours('');
      setSelectedPlatforms([]);
      setGamePlatforms([]);
    } else if (isReplay && initialGame) {
      setSelectedGame(initialGame);
      setStep(2);
      setRating(5.0);
      setContent('');
      setIsLiked(false);
      setIsCompleted(false);
      setContainsSpoilers(false);
      setPlaytimeHours('');
      setSelectedPlatforms([]);
    } else if (existingReview) {
      setSelectedGame(initialGame || existingReview.game);
      setStep(2);
      setRating(existingReview.rating != null ? Number(existingReview.rating) : 5.0);
      setContent(existingReview.content || '');
      setIsLiked(existingReview.is_liked || false);
      setIsCompleted(existingReview.is_completed || false);
      setContainsSpoilers(existingReview.contains_spoilers || false);
      setPlaytimeHours(existingReview.playtime_hours != null ? existingReview.playtime_hours : '');
      setSelectedPlatforms(existingReview.platforms || []);
    } else if (initialGame) {
      setSelectedGame(initialGame);
      setStep(2);
    }
  }

  // Replay mode: look up how many playthroughs already exist to show/submit the right
  // next playthrough number.
  useEffect(() => {
    if (!visible || !isReplay || !selectedGame || !user?.username) return;
    let cancelled = false;
    api
      .get('/reviews/', { params: { game_id: selectedGame.id, username: user.username } })
      .then(({ data }) => {
        if (cancelled) return;
        const list: Review[] = unwrapList(data);
        const maxPt = list.reduce((max, r) => Math.max(max, r.playthrough_number || 1), 0);
        setNextPlaythrough(maxPt + 1);
      })
      .catch(() => {
        if (!cancelled) setNextPlaythrough(2);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, isReplay, selectedGame, user?.username]);

  // The search endpoint's `platforms` field is empty for almost every game — fetch the
  // real per-game list from its details endpoint instead of only offering the generic
  // fallback.
  useEffect(() => {
    if (!visible || !selectedGame) return undefined;
    let cancelled = false;
    api
      .get(`/games/${selectedGame.id}/details/`)
      .then(({ data }) => {
        if (cancelled) return;
        // Always resolves, even to an empty/fallback list — so a game with no per-game
        // platforms (or a fetch error) doesn't leave a *previous* game's platforms
        // lingering in the picker, without needing a synchronous reset at the top of
        // this effect (flagged by react-hooks/set-state-in-effect).
        setGamePlatforms(Array.isArray(data?.platforms) ? data.platforms : []);
      })
      .catch(() => {
        if (!cancelled) setGamePlatforms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedGame]);

  // Prefill playtime from the Game DNA library entry when it's already known from Steam
  // — only fills an empty field, never overwrites what the user already typed/is editing.
  useEffect(() => {
    if (!visible || !selectedGame || !user?.username) return;
    let cancelled = false;
    api
      .get('/library/', { params: { user__username: user.username, game: selectedGame.id } })
      .then(({ data }) => {
        if (cancelled) return;
        const entry = unwrapList<{ platform?: string; playtime_hours?: number }>(data)[0];
        const hours = entry?.playtime_hours;
        if (entry && hours && hours > 0 && String(entry.platform || '').toLowerCase().includes('steam')) {
          setPlaytimeHours((prev) => (prev === '' ? hours : prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, selectedGame, user?.username]);

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedGame) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: Record<string, unknown> = {
      game_id: selectedGame.id,
      rating,
      content,
      is_liked: isLiked,
      is_completed: isCompleted,
      contains_spoilers: containsSpoilers,
    };
    if (playtimeHours !== '') payload.playtime_hours = playtimeHours;
    if (selectedPlatforms.length > 0) payload.platforms = selectedPlatforms;

    try {
      if (isReplay) {
        payload.playthrough_number = nextPlaythrough;
        await api.post('/reviews/', payload);
      } else if (existingReview) {
        await api.patch(`/reviews/${existingReview.id}/`, payload);
      } else {
        await api.post('/reviews/', payload);
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to submit review:', error);
      setSubmitError(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = isReplay ? strings.logReplay : existingReview ? strings.editReview : strings.writeReview;
  const submitLabel = isReplay ? strings.logReplay : existingReview ? strings.updateLog : strings.logActivity;
  const platformOptions = gamePlatforms.length > 0 ? gamePlatforms : DEFAULT_PLATFORMS;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/80 p-4">
      <View
        style={{ width: '100%', maxWidth: 480, height: step === 1 ? 600 : '80%' }}
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
      >
        {step === 1 ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between border-b border-zinc-800 p-4">
              <Text className="text-lg font-bold text-white">{strings.logAGame}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color="#a1a1aa" />
              </Pressable>
            </View>
            <GameSearchResultsList query={query} setQuery={setQuery} results={results} isLoading={searchLoading} onSelectGame={handleSelectGame} />
          </View>
        ) : (
          <>
            {/* Header: back-arrow+title/game-title/date stacked on the left, a small
                cover thumbnail on the right sized to that text block's own height (not
                stretch+aspectRatio — explicit pixel height matches the established
                pattern this phase for sizing a sibling image, after aspectRatio-driven
                sizing broke once already in TopFavoritesGrid). The back arrow (not an X)
                is both the "go to step 1 / change game" action and its own visible hint —
                replacing the old hover-only "tap cover to change game" affordance, which
                never actually showed on touch, with a real always-visible control. */}
            <View className="flex-row items-start justify-between border-b border-zinc-800 p-4">
              <View className="flex-1 justify-center gap-1 pr-3">
                <Pressable onPress={() => setStep(1)} className="flex-row items-center gap-1.5">
                  <ArrowLeft size={16} color="#ffffff" />
                  <Text className="text-sm font-bold text-white">{headerTitle}</Text>
                  {isReplay && (
                    <View className="rounded-full border border-purple-500/30 bg-purple-500/20 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-purple-400">
                        {ordinal(nextPlaythrough)} {strings.playthrough}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text numberOfLines={1} className="text-lg font-black leading-tight text-white">
                  {selectedGame?.title}
                </Text>
                {!!selectedGame?.release_date && (
                  <View className="flex-row items-center gap-1.5">
                    <Calendar size={12} color="#a1a1aa" />
                    <Text className="text-xs font-medium text-zinc-400">{new Date(selectedGame.release_date).getFullYear()}</Text>
                  </View>
                )}
              </View>

              <View style={{ width: HEADER_THUMB_WIDTH, height: HEADER_THUMB_HEIGHT }} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                {selectedGame?.cover_image ? (
                  <Image source={{ uri: getImageUrl(selectedGame.cover_image) }} style={{ flex: 1 }} contentFit="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Search size={16} color="#3f3f46" />
                  </View>
                )}
              </View>
            </View>

            {/* Form — no ScrollView: everything must fit on one screen without
                scrolling, matching web desktop's own technique (not web mobile's, which
                still scrolls) of giving only the review textarea flex:1 so it's the one
                element that shrinks/grows to absorb whatever vertical space is left. */}
            <View style={{ flex: 1, overflow: 'hidden' }} className="gap-3 p-4">
              <View>
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400">{strings.rating}</Text>
                  <Text style={{ color: getRatingColor(rating) }} className="text-2xl font-black">
                    {rating.toFixed(1)}
                  </Text>
                </View>
                <RatingSlider value={rating} onValueChange={setRating} />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">{strings.playtimeHoursLabel}</Text>
                  <TextInput
                    value={playtimeHours === '' ? '' : String(playtimeHours)}
                    onChangeText={(text) => {
                      if (text === '') {
                        setPlaytimeHours('');
                        return;
                      }
                      const num = Number(text);
                      if (Number.isNaN(num) || num < 0 || num > 50000) return;
                      setPlaytimeHours(num);
                    }}
                    keyboardType="numeric"
                    placeholder="e.g. 10"
                    placeholderTextColor="#52525b"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">{strings.platform}</Text>
                  <Pressable
                    onPress={() => setPlatformPickerVisible(true)}
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5"
                  >
                    <Text numberOfLines={1} className="flex-1 text-sm text-white">
                      {selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : strings.selectPlatform}
                    </Text>
                    <ChevronDown size={16} color="#71717a" />
                  </Pressable>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">{strings.reviewOptional}</Text>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder={strings.whatDidYouThink}
                  placeholderTextColor="#52525b"
                  multiline
                  style={{ flex: 1, textAlignVertical: 'top' }}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-base leading-relaxed text-zinc-200"
                />
              </View>

              <View className="flex-row gap-2">
                <ToggleButton active={isLiked} onPress={() => setIsLiked((v) => !v)} icon={Heart} activeColor="#ec4899" label={strings.liked} fillIcon />
                <ToggleButton active={isCompleted} onPress={() => setIsCompleted((v) => !v)} icon={Check} activeColor="#10b981" label={strings.completed} />
                <ToggleButton
                  active={containsSpoilers}
                  onPress={() => setContainsSpoilers((v) => !v)}
                  icon={EyeOff}
                  activeColor="#f59e0b"
                  label={strings.spoilers}
                />
              </View>

              {!!submitError && (
                <View className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <Text className="text-sm font-medium text-red-500">{submitError}</Text>
                </View>
              )}
            </View>

            <View className="flex-row justify-end gap-3 border-t border-zinc-800 bg-zinc-900 p-4">
              <Pressable onPress={onClose} className="rounded-xl px-5 py-2.5">
                <Text className="text-center text-sm font-bold text-zinc-400">{strings.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!selectedGame || isSubmitting}
                style={{ opacity: !selectedGame || isSubmitting ? 0.5 : 1 }}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5"
              >
                {isSubmitting && <ActivityIndicator size="small" color="#ffffff" />}
                <Text className="text-center text-sm font-bold text-white">{submitLabel}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
      </View>

      <PlatformPickerModal
        visible={platformPickerVisible}
        onClose={() => setPlatformPickerVisible(false)}
        options={platformOptions}
        selected={selectedPlatforms}
        onToggle={(platform) =>
          setSelectedPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]))
        }
      />
    </Modal>
  );
}
