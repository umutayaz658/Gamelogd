import { TextInput, View } from 'react-native';
import { Lock, Mail, User as UserIcon } from 'lucide-react-native';

import PhoneNumberField from '@/components/auth/PhoneNumberField';
import { RegisterFormData } from './types';

interface Step1Props {
  formData: RegisterFormData;
  setFormData: (updater: (prev: RegisterFormData) => RegisterFormData) => void;
}

export default function Step1AccountContact({ formData, setFormData }: Step1Props) {
  return (
    <View className="gap-4">
      <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <UserIcon size={20} color="#71717a" style={{ marginLeft: 12 }} />
        <TextInput
          value={formData.username}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, username: text }))}
          placeholder="Username"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 px-3 py-3 text-zinc-200"
        />
      </View>

      <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <UserIcon size={20} color="#71717a" style={{ marginLeft: 12 }} />
        <TextInput
          value={formData.realName}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, realName: text }))}
          placeholder="Display Name"
          placeholderTextColor="#52525b"
          maxLength={100}
          className="flex-1 px-3 py-3 text-zinc-200"
        />
      </View>

      <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <Mail size={20} color="#71717a" style={{ marginLeft: 12 }} />
        <TextInput
          value={formData.email}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, email: text }))}
          placeholder="Email address"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          className="flex-1 px-3 py-3 text-zinc-200"
        />
      </View>

      <PhoneNumberField
        value={formData.phoneNumber}
        onChange={(value) => setFormData((prev) => ({ ...prev, phoneNumber: value }))}
      />

      {/* Web stacks these full-width on mobile (grid-cols-1, md:grid-cols-2 only at
          desktop widths) — matched here rather than placed side by side. */}
      <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <Lock size={20} color="#71717a" style={{ marginLeft: 12 }} />
        <TextInput
          value={formData.password}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, password: text }))}
          placeholder="Password"
          placeholderTextColor="#52525b"
          secureTextEntry
          className="flex-1 px-3 py-3 text-zinc-200"
        />
      </View>
      <View className="relative flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950/50">
        <Lock size={20} color="#71717a" style={{ marginLeft: 12 }} />
        <TextInput
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, confirmPassword: text }))}
          placeholder="Confirm Password"
          placeholderTextColor="#52525b"
          secureTextEntry
          className="flex-1 px-3 py-3 text-zinc-200"
        />
      </View>
    </View>
  );
}
