import { Pressable, Text, View } from 'react-native';
import { Gamepad, Monitor, Smartphone } from 'lucide-react-native';

import { strings } from '@/lib/strings';
import { RegisterFormData } from './types';

const INTERESTS = [
  'RPG', 'FPS', 'MMORPG', 'Indie', 'Strategy', 'Simulation',
  'Esports', 'News', 'Invest', 'Retro', 'Horror', 'Puzzle',
  'Adventure', 'Open World', 'Sci-Fi', 'Fantasy',
  'Sports', 'Racing', 'Battle Royale', 'Fighting', 'Platformer',
  'Co-op', 'VR', 'Visual Novel',
];

const PLATFORMS = [
  { id: 'PC', label: 'PC', Icon: Monitor },
  { id: 'Console', label: 'Console', Icon: Gamepad },
  { id: 'Mobile', label: 'Mobile', Icon: Smartphone },
];

interface Step3Props {
  formData: RegisterFormData;
  setFormData: (updater: (prev: RegisterFormData) => RegisterFormData) => void;
}

export default function Step3TasteProfile({ formData, setFormData }: Step3Props) {
  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const togglePlatform = (platform: string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">{strings.interests}</Text>
        <View className="flex-row flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const selected = formData.interests.includes(interest);
            return (
              <Pressable
                key={interest}
                onPress={() => toggleInterest(interest)}
                className={`rounded-full border px-4 py-2 ${
                  selected ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-800 bg-zinc-950/50'
                }`}
              >
                <Text className={`text-sm font-bold ${selected ? 'text-white' : 'text-zinc-400'}`}>{interest}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">{strings.platforms}</Text>
        <View className="flex-row gap-4">
          {PLATFORMS.map((platform) => {
            const selected = formData.platforms.includes(platform.id);
            return (
              <Pressable
                key={platform.id}
                onPress={() => togglePlatform(platform.id)}
                className={`flex-1 items-center gap-2 rounded-xl border-2 p-4 ${
                  selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/50'
                }`}
              >
                <platform.Icon size={24} color={selected ? '#ffffff' : '#71717a'} />
                <Text className={`text-sm font-bold ${selected ? 'text-white' : 'text-zinc-400'}`}>
                  {platform.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
