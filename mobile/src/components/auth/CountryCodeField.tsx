import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, Search } from 'lucide-react-native';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/mobile';

interface CountryOption {
  code: string;
  name: string;
  callingCode: string;
}

function getCountryName(code: string): string {
  try {
    // Intl.DisplayNames — supported by Hermes on current RN/Expo SDK versions. Falls
    // back to the raw ISO code if a given engine/version doesn't have it.
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code) || code;
  } catch {
    return code;
  }
}

const COUNTRIES: CountryOption[] = getCountries()
  .map((code) => ({ code, name: getCountryName(code), callingCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface CountryCodeFieldProps {
  value: string;
  onChange: (code: string) => void;
}

// Web's CustomCountrySelect.tsx is pure DOM/CSS and can't be ported as-is (Faz 1 plan
// decision 8) — this is a from-scratch RN modal picker over the same underlying
// libphonenumber-js metadata, styled in the same dark/searchable-list language.
export default function CountryCodeField({ value, onChange }: CountryCodeFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
    );
  }, [search]);

  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true);
          setSearch('');
        }}
        className="flex-row items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5"
      >
        <Text className="text-xs font-semibold uppercase text-zinc-200">
          {selected ? `${selected.code} (+${selected.callingCode})` : 'Select'}
        </Text>
        <ChevronDown size={12} color="#71717a" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/60 p-4" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] w-full max-w-xs overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center gap-2 border-b border-zinc-800 bg-zinc-950/30 p-2">
              <Search size={16} color="#71717a" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search country..."
                placeholderTextColor="#52525b"
                autoFocus
                className="flex-1 text-sm text-zinc-200"
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              className="p-1"
              renderItem={({ item }) => {
                const isSelected = item.code === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.code);
                      setOpen(false);
                    }}
                    className={`flex-row items-center justify-between rounded-lg px-3 py-2 ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <View className="flex-shrink flex-row items-center gap-2">
                      <Text
                        numberOfLines={1}
                        className={isSelected ? 'text-xs font-semibold text-emerald-500' : 'text-xs text-zinc-300'}
                      >
                        {item.name}
                      </Text>
                      <Text className="text-[10px] font-bold text-zinc-500">(+{item.callingCode})</Text>
                    </View>
                    {isSelected && <Check size={14} color="#10b981" />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text className="py-4 text-center text-xs text-zinc-600">No countries found</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
