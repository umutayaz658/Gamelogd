import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { ArrowRight, Lock, User as UserIcon } from 'lucide-react-native';

import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { strings } from '@/lib/strings';

// Mirrors frontend/src/components/auth/LoginCard.tsx minus the Google Sign-In block
// (Faz 1 plan decision 1 — deferred, omitted entirely rather than left as a dead button).
export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/login/', { username, password });
      await login(response.data.token);
    } catch (err: any) {
      const data = err.response?.data;

      if (data?.status === 'verification_required' && data?.email) {
        router.push({ pathname: '/verify-email', params: { email: data.email } });
        return;
      }

      const errorMsg =
        data?.detail || data?.error || (typeof data === 'string' ? data : strings.invalidCredentials);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <View className="mb-8 items-center">
              <Text className="mb-2 text-3xl font-bold text-white">Gamelogd</Text>
              <Text className="text-zinc-400">{strings.welcomeBackGamer}</Text>
            </View>

            <View className="gap-4">
              <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
                <UserIcon size={20} color="#71717a" style={{ marginLeft: 12 }} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder={strings.usernameOrEmail}
                  placeholderTextColor="#52525b"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 px-3 py-3 text-zinc-200"
                />
              </View>

              <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
                <Lock size={20} color="#71717a" style={{ marginLeft: 12 }} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={strings.password}
                  placeholderTextColor="#52525b"
                  secureTextEntry
                  className="flex-1 px-3 py-3 text-zinc-200"
                />
              </View>
            </View>

            <View className="mt-4 flex-row justify-end">
              {/* Inert — matches web's own href="#", not a new deviation. */}
              <Text className="text-sm text-zinc-400">{strings.forgotPassword}</Text>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              className={`mt-6 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                isLoading ? 'bg-zinc-700' : 'bg-emerald-600'
              }`}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text className="text-center font-medium text-white">{strings.signingIn}</Text>
                </>
              ) : (
                <>
                  <Text className="text-center font-medium text-white">{strings.signIn}</Text>
                  <ArrowRight size={16} color="#ffffff" />
                </>
              )}
            </Pressable>

            {error && (
              <View className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <Text className="text-center text-sm font-medium text-red-500">{error}</Text>
              </View>
            )}

            <View className="my-6 flex-row items-center">
              <View className="h-px flex-1 bg-zinc-800" />
              <Text className="px-2 text-xs uppercase text-zinc-500">{strings.orContinueWith}</Text>
              <View className="h-px flex-1 bg-zinc-800" />
            </View>
            {/* Google Sign-In block intentionally omitted here — see Faz 1 plan decision 1. */}

            <View className="flex-row justify-center">
              <Text className="text-sm text-zinc-400">{strings.dontHaveAccount} </Text>
              <Link href="/register" asChild>
                <Pressable>
                  <Text className="text-sm font-medium text-emerald-500">{strings.signUp}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
