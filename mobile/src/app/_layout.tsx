import { Stack, useRouter } from 'expo-router';
import '../../global.css';
import { useEffect } from 'react';
import { registerForPushNotificationsAsync, addNotificationListeners } from '../lib/notifications';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    registerForPushNotificationsAsync();
    // cold start from push — native only
    if (require('react-native').Platform.OS !== 'web') {
      import('expo-notifications').then(({ getLastNotificationResponseAsync }) => {
        getLastNotificationResponseAsync().then((res) => {
          const data = res?.notification.request.content.data as any;
          if (data?.pageId) router.push(`/page/${data.pageId}`);
        });
      });
    }
    const cleanup = addNotificationListeners(undefined, (response) => {
      const data = response.notification.request.content.data as any;
      if (data?.pageId) {
        router.push(`/page/${data.pageId}`);
      }
    });
    return cleanup;
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
