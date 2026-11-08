import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Code2, Gamepad2 } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { strings } from '@/lib/strings';
import GameCoverWall from './GameCoverWall';

// Mirrors frontend/src/app/LandingPage.tsx's mobile stacking order (hero -> auth card ->
// pitch cards — the CSS grid's documented mobile order) minus the Google Sign-In block
// (deferred past Phase 1, same as the Login screen). Shown to anonymous visitors until
// they tap "Continue without logging in" (Faz 1 plan decision 2, reversed 2026-11-01).
export default function CoverPage() {
  const { continueAsGuest } = useAuth();

  return (
    <View className="flex-1 bg-zinc-950">
      <GameCoverWall />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="z-10">
        <View className="gap-8 p-6 py-10">
          <View>
            <Text className="mb-4 text-3xl font-bold text-white">Gamelogd</Text>
            <Text className="mb-3 text-3xl font-black leading-tight text-white">{strings.landingHeroHeadline}</Text>
            <Text className="text-lg text-zinc-400">{strings.landingHeroSubheadline}</Text>
          </View>

          <View className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <View className="mb-8 items-center">
              <Text className="mb-2 text-2xl font-bold text-white">{strings.landingGetStarted}</Text>
              <Text className="text-center text-sm text-zinc-400">{strings.landingAuthCardSubtext}</Text>
            </View>

            <View className="gap-4">
              <Pressable onPress={() => router.push('/login')} className="rounded-xl bg-emerald-600 py-2.5">
                <Text className="text-center font-medium text-white">{strings.login}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/register')} className="rounded-xl bg-zinc-800 py-2.5">
                <Text className="text-center font-medium text-white">{strings.signUp}</Text>
              </Pressable>

              <View className="my-2 flex-row items-center">
                <View className="h-px flex-1 bg-zinc-800" />
                <Text className="px-2 text-xs uppercase text-zinc-500">{strings.orContinueWith}</Text>
                <View className="h-px flex-1 bg-zinc-800" />
              </View>
              {/* Google Sign-In block intentionally omitted here — see Faz 1 plan decision 1. */}

              <Pressable onPress={continueAsGuest} className="h-10 items-center justify-center rounded-full bg-zinc-800">
                <Text className="text-sm font-medium tracking-wide text-white">{strings.continueWithoutLogin}</Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-6">
            <View className="flex-row gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Gamepad2 size={20} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xl font-bold text-white">{strings.landingGamerHeadline}</Text>
                <Text className="text-sm text-zinc-400">{strings.landingGamerPitch}</Text>
              </View>
            </View>

            <View className="flex-row gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Code2 size={20} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xl font-bold text-white">{strings.landingDevHeadline}</Text>
                <Text className="text-sm text-zinc-400">{strings.landingDevPitch}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
