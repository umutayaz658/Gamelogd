import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';

// TEMPORARY general-purpose test harness for Faz 2 — navigate to any username's profile
// to test with a second account (follow, block, privacy, etc.). Reverted to
// ComingSoonScreen once Faz 2 is done and real Explore content is built (Faz 4).
export default function ExploreScreen() {
  const [username, setUsername] = useState('');

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-zinc-950 p-4">
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="username"
        placeholderTextColor="#71717a"
        autoCapitalize="none"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white"
      />
      <Pressable
        className="rounded-xl bg-emerald-600 px-5 py-3"
        onPress={() => username.trim() && router.push(`/${username.trim()}` as never)}
      >
        <Text className="font-bold text-white">Go to profile</Text>
      </Pressable>
      <Pressable
        className="rounded-xl bg-zinc-800 px-5 py-3"
        onPress={() => username.trim() && router.push(`/${username.trim()}/games` as never)}
      >
        <Text className="font-bold text-white">Go to library</Text>
      </Pressable>
    </View>
  );
}
