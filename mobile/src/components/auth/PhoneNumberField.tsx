import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { getCountryCallingCode } from 'libphonenumber-js/mobile';

import CountryCodeField from './CountryCodeField';

interface PhoneNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Combined country-code + digits input, producing the same "+<callingCode><digits>"
// shape web's react-phone-number-input produces for formData.phoneNumber — no
// client-side validity check here either, matching web (it just sends the string as-is).
export default function PhoneNumberField({ onChange }: PhoneNumberFieldProps) {
  const [countryCode, setCountryCode] = useState('');
  const [digits, setDigits] = useState('');

  const emit = (nextCountryCode: string, nextDigits: string) => {
    if (!nextCountryCode || !nextDigits) {
      onChange('');
      return;
    }
    onChange(`+${getCountryCallingCode(nextCountryCode as never)}${nextDigits}`);
  };

  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-2.5 py-2">
      <CountryCodeField
        value={countryCode}
        onChange={(code) => {
          setCountryCode(code);
          emit(code, digits);
        }}
      />
      <TextInput
        value={digits}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, '');
          setDigits(cleaned);
          emit(countryCode, cleaned);
        }}
        placeholder="Phone number"
        placeholderTextColor="#52525b"
        keyboardType="phone-pad"
        className="flex-1 px-2 py-1 text-zinc-200"
      />
    </View>
  );
}
