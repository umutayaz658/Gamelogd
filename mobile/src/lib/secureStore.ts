import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'gamelogd_access_token';

export const getToken = (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (token: string): Promise<void> => SecureStore.setItemAsync(TOKEN_KEY, token);

export const clearToken = (): Promise<void> => SecureStore.deleteItemAsync(TOKEN_KEY);
