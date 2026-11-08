import { Pressable, Text, TextInput, View } from 'react-native';
import { Briefcase, Check, Code2, Gamepad2 } from 'lucide-react-native';

import CustomGenderSelect from '@/components/auth/CustomGenderSelect';
import { strings } from '@/lib/strings';
import { RegisterFormData } from './types';

const ROLES = [
  { id: 'gamer', label: 'Gamer', Icon: Gamepad2, color: '#3b82f6' },
  { id: 'developer', label: 'Developer', Icon: Code2, color: '#10b981' },
  { id: 'investor', label: 'Investor', Icon: Briefcase, color: '#f59e0b' },
];

interface Step2Props {
  formData: RegisterFormData;
  setFormData: (updater: (prev: RegisterFormData) => RegisterFormData) => void;
}

function formatBirthDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let formatted = digits.slice(0, 2);
  if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
  if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
  return formatted;
}

export default function Step2IdentityPersona({ formData, setFormData }: Step2Props) {
  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleId) ? prev.roles.filter((r) => r !== roleId) : [...prev.roles, roleId],
    }));
  };

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">
          {strings.selectYourRoles}
        </Text>
        {/* Web stacks these full-width on mobile (grid-cols-1, md:grid-cols-3 only at
            desktop widths) — matched here rather than placed side by side. */}
        <View className="gap-4">
          {ROLES.map((role) => {
            const selected = formData.roles.includes(role.id);
            return (
              <Pressable
                key={role.id}
                onPress={() => toggleRole(role.id)}
                className={`relative items-center gap-3 rounded-xl border-2 p-4 ${
                  selected ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/50'
                }`}
              >
                <role.Icon size={28} color={role.color} />
                <Text className={`font-bold ${selected ? 'text-white' : 'text-zinc-400'}`}>{role.label}</Text>
                {selected && (
                  <View className="absolute right-2 top-2">
                    <Check size={16} color="#10b981" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Web stacks these full-width on mobile (grid-cols-1, md:grid-cols-2 only at
          desktop widths) — matched here rather than placed side by side. */}
      <View className="gap-4">
        <View>
          <Text className="mb-2 text-sm font-bold text-zinc-400">{strings.gender}</Text>
          <CustomGenderSelect
            value={formData.gender}
            onChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
          />
        </View>
        <View>
          <Text className="mb-2 text-sm font-bold text-zinc-400">{strings.birthDate}</Text>
          <TextInput
            value={formData.birthDate}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, birthDate: formatBirthDate(text) }))}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#52525b"
            maxLength={10}
            keyboardType="number-pad"
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-zinc-200"
          />
        </View>
      </View>
    </View>
  );
}
