import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

import api from '@/lib/api';
import { strings } from '@/lib/strings';
import ProgressBar from '@/components/auth/register/ProgressBar';
import Step1AccountContact from '@/components/auth/register/Step1AccountContact';
import Step2IdentityPersona from '@/components/auth/register/Step2IdentityPersona';
import Step3TasteProfile from '@/components/auth/register/Step3TasteProfile';
import { initialRegisterFormData, RegisterFormData } from '@/components/auth/register/types';

const TOTAL_STEPS = 3;

// Mirrors frontend/src/app/register/page.tsx's 3-step wizard. The Google-prefill effect
// (reading a localStorage stash left by the web Google Sign-In flow) doesn't apply —
// Google Sign-In is deferred past Phase 1 (Faz 1 plan decision 1). Per-step slide/fade
// transition (web's framer-motion AnimatePresence) is skipped for now — steps swap
// instantly; a minor animation-polish gap, not a missing field or behavior.
export default function RegisterScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegisterFormData>(initialRegisterFormData);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateStep1 = (): string | null => {
    if (!formData.username.trim()) return 'Username is required.';
    if (!formData.realName.trim()) return 'Display Name is required.';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match!';
    if (formData.password.length < 8) return 'Password must be at least 8 characters long.';
    return null;
  };

  const validateStep2 = (): string | null => {
    const { birthDate } = formData;
    if (!birthDate) return null;

    if (birthDate.length !== 10) return 'Birth Date must be in DD/MM/YYYY format.';
    const [dayStr, monthStr, yearStr] = birthDate.split('/');
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      return 'Birth Date contains invalid characters.';
    }
    if (month < 1 || month > 12) return 'Birth Date month must be between 01 and 12.';
    if (day < 1 || day > 31) return 'Birth Date day must be between 01 and 31.';

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return `Invalid day for the selected month (max ${daysInMonth}).`;

    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return `Birth Date year must be between 1900 and ${currentYear}.`;

    return null;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    let formattedBirthDate: string | null = null;
    if (formData.birthDate.length === 10) {
      const [day, month, year] = formData.birthDate.split('/');
      formattedBirthDate = `${year}-${month}-${day}`;
    }

    const payload = {
      username: formData.username.trim(),
      real_name: formData.realName.trim(),
      email: formData.email,
      password: formData.password,
      phone_number: formData.phoneNumber,
      is_gamer: formData.roles.includes('gamer'),
      is_developer: formData.roles.includes('developer'),
      is_investor: formData.roles.includes('investor'),
      gender: formData.gender,
      birth_date: formattedBirthDate,
      platforms: formData.platforms,
      interests: formData.interests,
      roles: formData.roles,
    };

    try {
      await api.post('/register/', payload);
      router.push({ pathname: '/verify-email', params: { email: formData.email } });
    } catch (err: any) {
      const data = err.response?.data;
      let errorMsg = strings.registrationFailed;
      if (data) {
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else {
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const msgs = Array.isArray(data[firstKey]) ? data[firstKey].join(' ') : data[firstKey];
            errorMsg = `${firstKey}: ${msgs}`;
          }
        }
      }
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    const validationError = currentStep === 1 ? validateStep1() : currentStep === 2 ? validateStep2() : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((step) => step - 1);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-zinc-950">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

            <View className="mb-6 mt-6 items-center">
              <Text className="mb-2 text-3xl font-bold text-white">Gamelogd</Text>
              <Text className="text-zinc-400">
                {strings.stepLabel} {currentStep} {strings.stepOf3} {strings.stepTitles[currentStep - 1]}
              </Text>
            </View>

            {currentStep === 1 && <Step1AccountContact formData={formData} setFormData={setFormData} />}
            {currentStep === 2 && <Step2IdentityPersona formData={formData} setFormData={setFormData} />}
            {currentStep === 3 && <Step3TasteProfile formData={formData} setFormData={setFormData} />}

            <View className="mt-6 flex-row gap-4 border-t border-zinc-800 pt-4">
              {currentStep > 1 && (
                <Pressable
                  onPress={handleBack}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3"
                >
                  <ArrowLeft size={16} color="#ffffff" />
                  <Text className="text-center font-medium text-white">{strings.back}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleNext}
                disabled={isSubmitting}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                  isSubmitting ? 'bg-zinc-700' : 'bg-emerald-600'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text className="text-center font-medium text-white">{strings.creatingAccount}</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-center font-medium text-white">
                      {currentStep === TOTAL_STEPS ? strings.completeRegistration : strings.nextStep}
                    </Text>
                    {currentStep < TOTAL_STEPS && <ArrowRight size={16} color="#ffffff" />}
                  </>
                )}
              </Pressable>
            </View>

            {error && (
              <View className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <Text className="text-center text-sm font-medium text-red-500">{error}</Text>
              </View>
            )}

            <View className="mt-6 flex-row justify-center">
              <Text className="text-sm text-zinc-500">{strings.alreadyHaveAccount} </Text>
              <Link href="/login" asChild>
                <Pressable>
                  <Text className="text-sm font-medium text-emerald-500">{strings.signIn}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
