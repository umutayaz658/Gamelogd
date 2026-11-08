import { Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { getMetacriticColor } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { GameDetail } from '@/types';

interface GameStatsSectionProps {
  game: GameDetail;
}

function HltbCard({ label, hours, accentColor }: { label: string; hours: number; accentColor: string }) {
  return (
    <View className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
      <View style={{ position: 'absolute', right: -16, top: -16, opacity: 0.08 }}>
        <Clock size={96} color={accentColor} />
      </View>
      <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-400">{label}</Text>
      <View className="flex-row items-baseline gap-1">
        <Text style={{ color: accentColor }} className="text-3xl font-bold">
          {hours}
        </Text>
        <Text className="font-medium text-zinc-500">{strings.hours}</Text>
      </View>
    </View>
  );
}

// Port of GameDetailClient.tsx's "Game Stats" section — mobile width collapses both the
// outer grid (Metacritic card + HLTB group) and the inner HLTB grid to a single column
// (web's grid-cols-1, before its sm:/md: breakpoints), so this is just a vertical stack.
export default function GameStatsSection({ game }: GameStatsSectionProps) {
  if (!game.metacritic_score && !game.hltb_main && !game.hltb_main_extra && !game.hltb_completionist) {
    return null;
  }

  const metacriticColor = game.metacritic_score ? getMetacriticColor(game.metacritic_score) : '#71717a';

  return (
    <View className="mb-16 px-4">
      <Text className="mb-6 text-2xl font-bold text-white">{strings.gameStats}</Text>
      <View className="gap-4">
        {!!game.metacritic_score && (
          <View className="items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{strings.criticScore}</Text>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 4,
                borderColor: metacriticColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: metacriticColor }} className="text-3xl font-black">
                {game.metacritic_score}
              </Text>
            </View>
            <Text className="mt-3 text-xs text-zinc-500">{strings.basedOnIgdbCritics}</Text>
          </View>
        )}

        {!!game.hltb_main && <HltbCard label={strings.mainStory} hours={game.hltb_main} accentColor="#818cf8" />}
        {!!game.hltb_main_extra && <HltbCard label={strings.mainPlusExtras} hours={game.hltb_main_extra} accentColor="#c084fc" />}
        {!!game.hltb_completionist && <HltbCard label={strings.completionist} hours={game.hltb_completionist} accentColor="#f0abfc" />}
      </View>
    </View>
  );
}
