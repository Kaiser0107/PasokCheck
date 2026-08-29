import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

type Post = {
  id: string;
  text: string;
  timestamp: string;
};

type TrackedPage = {
  id: string;
  url: string;
  latestPost?: Post;
};

export default function HomeScreen() {
  const [pages, setPages] = useState<TrackedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputUrl, setInputUrl] = useState('');

  useEffect(() => {
    // 1. Listen to all tracked pages
    const pagesRef = ref(db, 'tracked_pages');
    
    const unsubscribePages = onValue(pagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setPages([]);
        setLoading(false);
        return;
      }

      const pageList: TrackedPage[] = Object.keys(data).map(key => ({
        id: key,
        url: data[key].url,
      }));

      // 2. Fetch the latest post for each page to determine status
      Promise.all(
        pageList.map(async (page) => {
          const snapshot = await get(ref(db, `announcements/${page.id}`));
          const posts = snapshot.val();
          if (posts && Array.isArray(posts) && posts.length > 0) {
            page.latestPost = posts[0]; // Assuming index 0 is the newest
          }
          return page;
        })
      ).then((enrichedPages) => {
        setPages(enrichedPages);
        setLoading(false);
      });
    }, (error) => {
      console.error("Firebase read error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribePages();
    };
  }, []);

  const handleAddUrl = async () => {
    if (!inputUrl) return;
    
    try {
      // Very basic URL extraction to get the page ID
      // e.g., https://www.facebook.com/PGNEOfficial -> PGNEOfficial
      const urlObj = new URL(inputUrl);
      const paths = urlObj.pathname.split('/').filter(Boolean);
      const pageId = paths[0];

      if (!pageId) {
        Alert.alert("Invalid URL", "Could not extract Facebook Page ID.");
        return;
      }

      await set(ref(db, `tracked_pages/${pageId}`), {
        url: inputUrl,
        addedAt: new Date().toISOString()
      });

      setInputUrl('');
      Alert.alert("Success", `${pageId} added! The scraper will fetch its data shortly.`);
    } catch (e) {
      Alert.alert("Error", "Please enter a valid URL (e.g. https://facebook.com/name)");
    }
  };

  const getStatus = (text?: string) => {
    if (!text) return { label: "No Data Yet", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400" };
    
    const lowerText = text.toLowerCase();
    if (lowerText.includes("walang pasok") || lowerText.includes("suspended")) {
      return { label: "Suspended", color: "bg-red-100 text-red-700", dot: "bg-red-500" };
    }
    return { label: "Normal", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
  };

  const renderCard = ({ item }: { item: TrackedPage }) => {
    const status = getStatus(item.latestPost?.text);
    
    return (
      <View className="bg-white p-5 mb-4 rounded-2xl shadow-sm border border-slate-100 mx-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-3 border border-blue-100">
              <Text className="text-blue-600 font-bold text-lg">{item.id.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1 pr-2">
              <Text className="font-bold text-slate-800 text-lg" numberOfLines={1}>{item.id}</Text>
              <Text className="text-xs text-slate-400">Facebook Page</Text>
            </View>
          </View>
          
          {/* Status Badge */}
          <View className={`px-3 py-1.5 rounded-full flex-row items-center ${status.color}`}>
            <View className={`w-2 h-2 rounded-full mr-1.5 ${status.dot}`} />
            <Text className={`font-semibold text-xs ${status.color.split(' ')[1]}`}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Latest Post Snippet */}
        <View className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <Text className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Latest Update</Text>
          {item.latestPost ? (
            <>
              <Text className="text-slate-700 leading-5" numberOfLines={3}>
                {item.latestPost.text}
              </Text>
              <Text className="text-[10px] text-slate-400 mt-2">
                {new Date(item.latestPost.timestamp).toLocaleString()}
              </Text>
            </>
          ) : (
            <Text className="text-slate-400 italic py-2">Waiting for the backend scraper...</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="pt-2 pb-4 px-4 bg-white border-b border-slate-200 mb-4 shadow-sm">
        <Text className="text-3xl font-black text-slate-900 tracking-tight">PasokCheck</Text>
        <Text className="text-slate-500 font-medium">Dynamic Page Tracker</Text>
      </View>

      {/* Input Area */}
      <View className="px-4 mb-4 flex-row">
        <TextInput 
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 mr-2 text-slate-700"
          placeholder="Paste Facebook Page URL..."
          value={inputUrl}
          onChangeText={setInputUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity 
          onPress={handleAddUrl}
          className="bg-blue-600 rounded-xl px-5 justify-center items-center shadow-sm"
        >
          <Text className="text-white font-bold">Track</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-slate-500 font-medium">Loading pages...</Text>
        </View>
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          ListEmptyComponent={
            <View className="p-8 items-center justify-center mt-10">
              <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="search" size={24} color="#94a3b8" />
              </View>
              <Text className="text-slate-500 text-center text-lg font-medium">No pages tracked yet.</Text>
              <Text className="text-slate-400 text-center mt-2">Paste a URL above to start monitoring a school or LGU.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}
