import { Stack, useRouter } from 'expo-router';
import '../../global.css';



export default function RootLayout() {
  const router = useRouter();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
