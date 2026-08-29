import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView } from 'react-native';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { StatusBar } from 'expo-status-bar';

type Post = {
  id: string;
  text: string;
  timestamp: string;
};

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to the PGNEOfficial announcements node
    const postsRef = ref(db, 'announcements/PGNEOfficial');
    
    const unsubscribe = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Data comes in as an array from the scraper
        setPosts(data.filter(Boolean));
      } else {
        setPosts([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase read error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderPost = ({ item }: { item: Post }) => (
    <View className="bg-white p-4 mb-4 rounded-xl shadow-sm border border-slate-100 mx-4">
      <View className="flex-row items-center mb-2">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Text className="text-blue-600 font-bold">LGU</Text>
        </View>
        <View>
          <Text className="font-bold text-slate-800">Nueva Ecija Gov</Text>
          <Text className="text-xs text-slate-500">
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>
      <Text className="text-slate-700 leading-6" numberOfLines={10}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar style="auto" />
      <View className="pt-6 pb-4 px-4 bg-white border-b border-slate-200 mb-4 shadow-sm">
        <Text className="text-2xl font-black text-slate-900 tracking-tight">PasokCheck</Text>
        <Text className="text-slate-500 font-medium">Live Suspension Updates</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-slate-500 font-medium">Loading updates...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListEmptyComponent={
            <View className="p-8 items-center justify-center">
              <Text className="text-slate-400 text-center text-lg">No announcements found right now.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}
