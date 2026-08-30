import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDatabase, ref, set } from 'firebase/database';
import { app } from './firebase';

let handlerSet = false;

// helper to safely get Notifications module (Expo Go Android will throw)
async function getNotifications(): Promise<any | null> {
  if (Platform.OS === 'web') return null;
  // Expo Go Android push removed in SDK 53+ — avoid crash
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo && Platform.OS === 'android') {
    console.log('[notifications] Expo Go Android push not supported — use dev build');
    return null;
  }
  try {
    const mod = await import('expo-notifications');
    if (!handlerSet) {
      handlerSet = true;
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    return mod;
  } catch (e: any) {
    console.log('[notifications] not available:', e?.message || e);
    return null;
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[notifications] web — skipping');
    return null;
  }
  if (!Device.isDevice) {
    console.log('[notifications] must use physical device');
    return null;
  }
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Announcements',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFE600',
        sound: 'default',
      });
    } catch {}
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[notifications] permission not granted', finalStatus);
    return null;
  }

  const projectId =
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    (Constants?.expoConfig as any)?.projectId;

  let token: string;
  try {
    if (projectId) {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    }
  } catch (e) {
    console.error('[notifications] getExpoPushTokenAsync failed', e);
    return null;
  }

  try {
    const db = getDatabase(app);
    const key = token.replace(/[\.\#\$\[\]]/g, '_');
    await set(ref(db, `expo_push_tokens/${key}`), {
      token,
      platform: Platform.OS,
      createdAt: new Date().toISOString(),
      device: Device.modelName || 'unknown',
    });
    console.log('[notifications] token saved', token.slice(0, 16) + '...');
  } catch (e) {
    console.error('[notifications] save failed', e);
  }

  return token;
}

export function addNotificationListeners(
  onReceive?: (n: any) => void,
  onResponse?: (r: any) => void
) {
  // fire-and-forget async to get module
  let cleanup: (() => void) | undefined;
  (async () => {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    const subReceived = Notifications.addNotificationReceivedListener((n: any) => {
      console.log('[notifications] received', n.request.content.title);
      onReceive?.(n);
    });
    const subResponse = Notifications.addNotificationResponseReceivedListener((r: any) => {
      console.log('[notifications] response', r.notification.request.content.data);
      onResponse?.(r);
    });
    cleanup = () => {
      subReceived.remove();
      subResponse.remove();
    };
  })();
  return () => cleanup?.();
}

export function isExpoGoPushUnsupported(): boolean {
  return Constants.appOwnership === 'expo' && Platform.OS === 'android';
}
