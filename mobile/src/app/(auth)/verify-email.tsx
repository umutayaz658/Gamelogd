import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputInstance,
  TextInputKeyPressEvent,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react-native';

import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { strings } from '@/lib/strings';

const CODE_LENGTH = 6;

// Mirrors frontend/src/app/verify-email/page.tsx. RN's TextInput has no onPaste event
// (unlike the DOM), so paste/SMS-autofill is handled by NOT capping each box at
// maxLength=1 in the native sense — instead onChangeText checks for a multi-character
// value (a paste or an OS autofill suggestion lands the whole code in one box) and
// distributes it across all 6 boxes, same end result as web's container-level paste
// listener.
export default function VerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = emailParam || '';
  const { login } = useAuth();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRefs = useRef<(TextInputInstance | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.replace('/register');
    }
  }, [email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');

    if (digitsOnly.length > 1) {
      // Paste or OS autofill suggestion — distribute across all boxes from the start,
      // matching web's container-level paste handler.
      const chars = digitsOnly.slice(0, CODE_LENGTH).split('');
      const next = Array(CODE_LENGTH).fill('');
      chars.forEach((char, i) => {
        next[i] = char;
      });
      setCode(next);
      setError(null);
      // Focus the next empty box so the user can keep typing after a partial
      // paste/autofill — the LAST box only when the paste already filled all 6.
      const nextFocusIndex = chars.length < CODE_LENGTH ? chars.length : CODE_LENGTH - 1;
      inputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    if (!/^[0-9]?$/.test(digitsOnly)) return;

    const next = [...code];
    next[index] = digitsOnly;
    setCode(next);
    setError(null);

    if (digitsOnly && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, e: TextInputKeyPressEvent) => {
    if (e.nativeEvent.key !== 'Backspace') return;

    if (!code[index] && index > 0) {
      const next = [...code];
      next[index - 1] = '';
      setCode(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.post('/resend-verification/', { email });
      setSuccessMsg(strings.newCodeSent);
      setResendCooldown(60);
      setCode(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      setError(err.response?.data?.error || strings.failedToSendCode);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length < CODE_LENGTH) {
      setError(strings.enterSixDigitCode);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/verify-email/', { email, code: verificationCode });
      setSuccessMsg(strings.verificationSuccessfulLoggingIn);
      await login(res.data.token);
      setSuccessMsg(strings.verificationSuccessfulManualLogin);
    } catch (err: any) {
      setError(err.response?.data?.error || strings.verificationFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = code.every((digit) => digit !== '');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-zinc-950">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <View className="mb-8 items-center">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <Mail size={24} color="#10b981" />
              </View>
              <Text className="mb-2 text-2xl font-bold text-white">{strings.emailVerification}</Text>
              <Text className="text-center text-sm text-zinc-400">
                {strings.verifyEmailSentTo} <Text className="font-medium text-zinc-200">{email}.</Text>
              </Text>
            </View>

            <View className="gap-6">
              <View className="flex-row justify-between gap-2">
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleChange(index, text)}
                    onKeyPress={(e) => handleKeyPress(index, e)}
                    keyboardType="number-pad"
                    textAlign="center"
                    className="h-14 w-12 rounded-xl border border-zinc-800 bg-zinc-950/50 text-2xl font-bold text-white"
                  />
                ))}
              </View>

              <Pressable
                onPress={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="flex-row items-center justify-center gap-2"
              >
                {isResending ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <RefreshCw size={16} color={resendCooldown > 0 ? '#71717a' : '#10b981'} />
                )}
                <Text className={`text-sm font-bold ${resendCooldown > 0 ? 'text-zinc-500' : 'text-emerald-500'}`}>
                  {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : strings.resendCode}
                </Text>
              </Pressable>

              {error && (
                <View className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <Text className="text-center text-sm font-medium text-red-500">{error}</Text>
                </View>
              )}
              {successMsg && (
                <View className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <Text className="text-center text-sm font-medium text-emerald-500">{successMsg}</Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting || !isComplete}
                className={`flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                  isSubmitting || !isComplete ? 'bg-zinc-700' : 'bg-emerald-600'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text className="text-center font-bold text-white">{strings.verifying}</Text>
                  </>
                ) : (
                  <Text className="text-center font-bold text-white">{strings.verifyAccount}</Text>
                )}
              </Pressable>
            </View>

            <View className="mt-8 flex-row items-center justify-center gap-2">
              <ArrowLeft size={16} color="#71717a" />
              <Link href="/login" asChild>
                <Pressable>
                  <Text className="text-sm font-medium text-zinc-500">{strings.backToLogin}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
