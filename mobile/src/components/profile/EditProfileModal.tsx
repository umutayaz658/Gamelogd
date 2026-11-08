import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, Check, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Image } from '@/components/ui/Image';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getImageUrl } from '@/lib/utils';
import { strings } from '@/lib/strings';
import { User } from '@/types';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (updatedUser: User) => void;
}

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

// Port of frontend/src/components/EditProfileModal.tsx. Image cropping uses
// expo-image-picker's built-in `allowsEditing` editor rather than web's custom
// ImageCropModal (Faz 2 plan decision 2, approved) — Android honors `aspect`, iOS's
// built-in crop is always square regardless of the requested aspect (an accepted,
// platform-level deviation: cover photos end up square on iOS, not web's ~3:1).
// Multipart upload shape ({uri,name,type} appended to FormData) is RN's own convention,
// replacing web's File/Blob objects — the backend's multipart handling is unaffected.
export default function EditProfileModal({ visible, onClose, user, onUpdate }: EditProfileModalProps) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [realName, setRealName] = useState(user.real_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [location, setLocation] = useState(user.location || '');
  const [birthDate, setBirthDate] = useState(user.birth_date || '');
  const [showBirthDate, setShowBirthDate] = useState(user.show_birth_date || false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [coverPreview, setCoverPreview] = useState<string | null>(user.cover_image ? getImageUrl(user.cover_image) : null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(getImageUrl(user.avatar, user.username));
  const [coverFile, setCoverFile] = useState<PickedImage | null>(null);
  const [avatarFile, setAvatarFile] = useState<PickedImage | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  // Reset the form each time the modal is opened — mirrors web's isOpen-keyed effect.
  // A Modal's `visible` prop hides without unmounting, so local state would otherwise
  // carry over stale edits from a previously-cancelled session (same reasoning as
  // GameSearchModal's wasVisible reset).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setRealName(user.real_name || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setBirthDate(user.birth_date || '');
      setShowBirthDate(user.show_birth_date || false);
      setCoverPreview(user.cover_image ? getImageUrl(user.cover_image) : null);
      setAvatarPreview(getImageUrl(user.avatar, user.username));
      setCoverFile(null);
      setAvatarFile(null);
      setCoverRemoved(false);
      setAvatarRemoved(false);
    }
  }

  const pickImage = async (type: 'cover' | 'avatar') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error(strings.mediaLibraryPermissionRequired);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const picked: PickedImage = { uri: asset.uri, name: `${type}.jpg`, type: 'image/jpeg' };
    if (type === 'cover') {
      setCoverFile(picked);
      setCoverPreview(asset.uri);
      setCoverRemoved(false);
    } else {
      setAvatarFile(picked);
      setAvatarPreview(asset.uri);
      setAvatarRemoved(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverRemoved(true);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarRemoved(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setBirthDate(selected.toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('real_name', realName);
      formData.append('bio', bio);
      formData.append('location', location);
      if (birthDate) {
        formData.append('birth_date', birthDate);
        formData.append('show_birth_date', showBirthDate ? 'true' : 'false');
      }

      if (coverFile) {
        formData.append('cover_image', coverFile as unknown as Blob);
      } else if (coverRemoved) {
        formData.append('remove_cover_image', 'true');
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile as unknown as Blob);
      } else if (avatarRemoved) {
        formData.append('remove_avatar', 'true');
      }

      const { data } = await api.patch<User>('/users/me/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onUpdate(data);
      updateUser(data);
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(strings.errorFailedUpdateProfile);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
          <View className="flex-row items-center gap-4">
            <Pressable onPress={onClose} className="rounded-full p-2">
              <X size={20} color="#a1a1aa" />
            </Pressable>
            <Text className="text-xl font-bold text-white">{strings.editProfile}</Text>
          </View>
          <Pressable onPress={handleSubmit} disabled={isLoading} className="rounded-full bg-emerald-600 px-5 py-1.5">
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-center text-sm font-bold text-white">{strings.save}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1">
          <Pressable onPress={() => pickImage('cover')} className="relative h-48 w-full bg-zinc-900">
            {coverPreview ? (
              <Image source={{ uri: coverPreview }} style={{ flex: 1 }} contentFit="cover" />
            ) : (
              <View className="flex-1 bg-zinc-800" />
            )}
            <View className="absolute inset-0 flex-row items-center justify-center gap-4 bg-black/25">
              <View className="rounded-full bg-black/50 p-3">
                <Camera size={18} color="#ffffff" />
              </View>
              {!!coverPreview && (
                <Pressable onPress={handleRemoveCover} className="rounded-full bg-black/50 p-3">
                  <X size={18} color="#ffffff" />
                </Pressable>
              )}
            </View>
          </Pressable>

          <View className="-mt-14 px-4 pb-4">
            <View className="relative h-28 w-28">
              <Pressable onPress={() => pickImage('avatar')} className="h-28 w-28 overflow-hidden rounded-full border-4 border-black bg-zinc-900">
                <Image source={{ uri: avatarPreview || getImageUrl(null, user.username) }} style={{ flex: 1 }} contentFit="cover" />
                <View className="absolute inset-0 items-center justify-center bg-black/25">
                  <Camera size={22} color="#ffffff" />
                </View>
              </Pressable>
              {!!avatarPreview && (
                <Pressable
                  onPress={handleRemoveAvatar}
                  className="absolute bottom-0 right-0 rounded-full border-2 border-black bg-black/70 p-1.5"
                >
                  <X size={14} color="#ffffff" />
                </Pressable>
              )}
            </View>
          </View>

          <View className="gap-6 px-4 pb-8">
            <View className="gap-1">
              <Text className="ml-1 text-sm font-bold text-zinc-500">{strings.fieldName}</Text>
              <TextInput
                value={realName}
                onChangeText={setRealName}
                placeholder={strings.placeholderDisplayName}
                placeholderTextColor="#3f3f46"
                className="rounded-lg border border-zinc-800 bg-black p-3 text-white"
              />
            </View>

            <View className="gap-1">
              <Text className="ml-1 text-sm font-bold text-zinc-500">{strings.fieldBio}</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder={strings.placeholderBio}
                placeholderTextColor="#3f3f46"
                multiline
                numberOfLines={3}
                className="rounded-lg border border-zinc-800 bg-black p-3 text-white"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <View className="gap-1">
              <Text className="ml-1 text-sm font-bold text-zinc-500">{strings.location}</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder={strings.placeholderLocation}
                placeholderTextColor="#3f3f46"
                className="rounded-lg border border-zinc-800 bg-black p-3 text-white"
              />
            </View>

            <View className="gap-1">
              <Text className="ml-1 text-sm font-bold text-zinc-500">{strings.fieldBirthDate}</Text>
              <Pressable onPress={() => setShowDatePicker(true)} className="rounded-lg border border-zinc-800 bg-black p-3">
                <Text className={birthDate ? 'text-white' : 'text-zinc-700'}>{birthDate || strings.selectDate}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={birthDate ? new Date(birthDate) : new Date(2000, 0, 1)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
              <Pressable onPress={() => setShowBirthDate((v) => !v)} className="mt-3 flex-row items-center gap-3">
                <View
                  className={`h-5 w-5 items-center justify-center rounded border ${
                    showBirthDate ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600 bg-zinc-800'
                  }`}
                >
                  {showBirthDate && <Check size={14} color="#ffffff" />}
                </View>
                <Text className="text-sm font-medium text-zinc-300">{strings.fieldShowOnProfile}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
