import { cssInterop } from 'nativewind';
import { Image as ExpoImage } from 'expo-image';

// expo-image (disk+memory caching, better decode perf than RN's core Image — used
// everywhere a remote avatar/cover/media URL is rendered in the feed) has no built-in
// NativeWind `className` support, unlike core RN components which NativeWind patches
// automatically. Registered once here; every feed/nav component imports Image from this
// file instead of 'react-native' or 'expo-image' directly.
cssInterop(ExpoImage, { className: 'style' });

export const Image = ExpoImage;
