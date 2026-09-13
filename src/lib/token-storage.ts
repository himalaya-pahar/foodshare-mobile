import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "foodshare.access_token";

export function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function saveAccessToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function deleteAccessToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}