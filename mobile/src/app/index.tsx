import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';
import { app } from '../lib/firebase';
import { Plus, Search, Building2, ChevronRight, AlertCircle, Trash2, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface TrackedPage {
  id: string;
  url: string;
  latestStatus?: string;
  timestamp?: string;
  hasWeekendClasses?: boolean;
}

export default function HomeScreen() {
  const [inputUrl, setInputUrl] = useState('');
  const [ignoreWeekends, setIgnoreWeekends] = useState(false);
  const [trackedPages, setTrackedPages] = useState<TrackedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();

  // Clock ticking effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const db = getDatabase(app);
    const pagesRef = ref(db, 'tracked_pages');

    const unsubscribePages = onValue(pagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const pagesList = Object.keys(data).map(key => ({
          id: key,
          url: data[key].url,
          latestStatus: data[key].latestStatus || 'Scanning...',
          timestamp: data[key].lastUpdated || ''
        }));
        
        setTrackedPages(pagesList);
      } else {
        setTrackedPages([]);
      }
      setLoading(false);
    });

    return () => unsubscribePages();
  }, []);

  const getOverallStatus = () => {
    if (trackedPages.length === 0) return { status: 'No Data', sub: 'Add a Page', color: 'bg-slate-100 border-slate-200', text: 'text-slate-600', badge: 'bg-slate-200 text-slate-700' };
    
    const day = new Date().getDay();
    const isWeekendDay = day === 0 || day === 6;

    // If it's a weekend AND they haven't checked the "Force Status" box, just show Weekend!
    if (isWeekendDay && !ignoreWeekends) {
      return { status: 'Weekend', sub: 'No Classes', color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' };
    }

    const validPages = trackedPages.filter(p => p.latestStatus !== 'Scanning...');
    if (validPages.length === 0) {
      return { status: 'Scanning...', sub: 'Please Wait', color: 'bg-slate-50 border-slate-200', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600' };
    }

    const totalTracked = validPages.length;
    const asyncCount = validPages.filter(p => p.latestStatus === 'Asynchronous').length;
    const syncCount = validPages.filter(p => p.latestStatus === 'Synchronous').length;
    const noAnnouncementCount = validPages.filter(p => p.latestStatus === 'No Announcement').length;
    
    if (noAnnouncementCount === totalTracked) {
      return { status: 'Face to Face', sub: 'No Announcement', color: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
    }
    
    if (asyncCount + syncCount === totalTracked) {
      return { status: 'Classes Suspended', sub: 'Stay Home', color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' };
    }
    
    return { status: 'Partial Suspensions', sub: 'Mixed', color: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-200 text-yellow-800' };
  };

  const handleAddUrl = async () => {
    if (!inputUrl.includes('facebook.com/')) {
      alert("Please enter a valid Facebook URL.");
      return;
    }

    setAdding(true);
    Keyboard.dismiss();
    try {
      let pageId = inputUrl.split('facebook.com/')[1].split('/')[0].split('?')[0];
      if (pageId === 'profile.php') {
        const urlParams = new URLSearchParams(inputUrl.split('?')[1]);
        pageId = urlParams.get('id') || 'unknown';
      }

      const db = getDatabase(app);
      const newPageRef = ref(db, `tracked_pages/${pageId}`);
      
      await set(newPageRef, {
        url: inputUrl,
        addedAt: new Date().toISOString()
      });

      setInputUrl('');
    } catch (error) {
      console.error(error);
      alert("Failed to add URL.");
    }
    setAdding(false);
  };

  const deletePage = async (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to stop tracking ${id}?`)) {
        const db = getDatabase(app);
        await remove(ref(db, `tracked_pages/${id}`));
      }
    } else {
      Alert.alert(
        "Untrack Page",
        `Are you sure you want to stop tracking ${id}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: async () => {
              const db = getDatabase(app);
              await remove(ref(db, `tracked_pages/${id}`));
            }
          }
        ]
      );
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Connect to local Express server running on port 3000
      // For mobile devices, you may need to use your computer's local IP address instead of localhost
      const host = Platform.OS === 'web' ? 'localhost' : '10.0.2.2'; // 10.0.2.2 is Android emulator loopback
      
      const response = await fetch(`http://${host}:3000/api/refresh`, {
        method: 'POST'
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to refresh");
      }
      
      if (Platform.OS === 'web') {
        window.alert("Scraping complete!");
      } else {
        Alert.alert("Success", "Scraping complete!");
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(`Refresh Failed: ${error.message}. Make sure your Node backend is running.`);
      } else {
        Alert.alert("Refresh Failed", `${error.message}. Make sure your Node backend is running.`);
      }
    }
    setLoading(false);
  };

  const overall = getOverallStatus();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-50">
      
      {/* Overall Status Banner */}
      <View className="pt-16 pb-6 px-6 bg-white border-b border-slate-200 shadow-sm z-10">
        <View className="flex-row justify-between items-end mb-3">
          <Text className="text-slate-500 font-semibold tracking-wider text-xs uppercase">Overall Status Today</Text>
          <Text className="text-slate-400 font-medium text-xs">
            {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
        <View className={`p-5 rounded-2xl border ${overall.color} flex-row items-center justify-between`}>
          <View>
            <Text className={`text-2xl font-black ${overall.text} mb-1`}>{overall.status}</Text>
            <View className={`self-start px-2 py-0.5 rounded-full ${overall.badge}`}>
              <Text className={`text-xs font-bold uppercase tracking-wider ${overall.text}`}>{overall.sub}</Text>
            </View>
          </View>
          <AlertCircle size={32} className={overall.text} strokeWidth={2} />
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-4 pt-6">
        
        {/* Header with Refresh Button */}
        <View className="flex-row justify-between items-center mb-4 ml-1 mr-1">
          <Text className="text-lg font-bold text-slate-800">Tracked Schools</Text>
          <TouchableOpacity 
            onPress={handleRefresh}
            disabled={loading}
            className={`px-4 py-2 rounded-lg flex-row items-center ${loading ? 'bg-slate-300' : 'bg-blue-600 active:bg-blue-700'}`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">Refresh Data</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Add URL Input */}
        <View className="mb-8">
          <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <Search size={20} color="#94a3b8" />
            <TextInput
              className="flex-1 h-12 ml-3 text-slate-800 text-base"
              placeholder="Paste Facebook URL..."
              placeholderTextColor="#94a3b8"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              className="bg-slate-900 w-10 h-10 rounded-xl items-center justify-center active:bg-slate-800"
              onPress={handleAddUrl}
              disabled={adding}
            >
              {adding ? <ActivityIndicator color="#fff" size="small" /> : <Plus color="#fff" size={24} />}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            className="flex-row items-center mt-3 ml-2" 
            onPress={() => setIgnoreWeekends(!ignoreWeekends)}
          >
            <View className={`w-5 h-5 rounded items-center justify-center mr-2 border ${ignoreWeekends ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
              {ignoreWeekends && <Check size={14} color="white" />}
            </View>
            <Text className="text-slate-600 text-sm font-medium">Force status calculation on Weekends</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-lg font-bold text-slate-900 mb-4 px-2">Tracked Pages</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#0f172a" className="mt-10" />
        ) : (
          <FlatList
            data={trackedPages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const displayStatus = item.latestStatus || 'Scanning...';
              
              const isAsync = displayStatus === 'Asynchronous';
              const isSync = displayStatus === 'Synchronous';
              
              const dotColor = isAsync ? 'bg-green-500' : isSync ? 'bg-blue-500' : 'bg-red-500';

              return (
                <TouchableOpacity 
                  className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 flex-row items-center shadow-sm active:bg-slate-50"
                  onPress={() => router.push(`/page/${item.id}`)}
                >
                  <View className="w-12 h-12 bg-slate-100 rounded-full items-center justify-center mr-4">
                    <Building2 size={24} color="#64748b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-slate-900" numberOfLines={1}>{item.id}</Text>
                    <View className="flex-row items-center mt-1">
                      <View className={`w-2 h-2 rounded-full mr-2 ${dotColor}`} />
                      <Text className="text-slate-500 text-sm font-medium">{displayStatus}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => deletePage(item.id)}
                    className="p-2 mr-1 active:bg-red-50 rounded-full"
                  >
                    <Trash2 size={20} color="#ef4444" />
                  </TouchableOpacity>
                  <ChevronRight size={20} color="#cbd5e1" />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
