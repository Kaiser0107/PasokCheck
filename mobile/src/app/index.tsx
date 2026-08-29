import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';
import { app } from '../lib/firebase';
import { Plus, Search, Trash2, Check, RefreshCw, Sparkles, GraduationCap, Moon, Sun, BellOff, PartyPopper, BookOpen, CloudRain } from 'lucide-react-native';
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
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
    if (trackedPages.length === 0) return { 
      status: 'Add your school!', 
      sub: '🎒 Ready when you are',
      emoji: '👋',
      color: 'bg-white border-slate-200',
      text: 'text-slate-700',
      badge: 'bg-amber-100 text-amber-700 border border-amber-200',
      accent: '#f59e0b',
      message: 'Paste a Facebook page link below to start tracking!'
    };
    
    const day = new Date().getDay();
    const isWeekendDay = day === 0 || day === 6;
    if (isWeekendDay && !ignoreWeekends) {
      return { 
        status: 'Weekend Mode', 
        sub: 'No classes, fam ✨',
        emoji: '🛋️',
        color: 'bg-[#EDE9FE] border-[#DDD6FE]',
        text: 'text-[#6D28D9]',
        badge: 'bg-white text-violet-700 border border-violet-200',
        accent: '#7c3aed',
        message: 'Chill muna! Enjoy your weekend 🎮'
      };
    }

    const validPages = trackedPages.filter(p => p.latestStatus !== 'Scanning...');
    if (validPages.length === 0) {
      return { 
        status: 'Checking...', 
        sub: 'Scanning bulletins 🔍',
        emoji: '🔎',
        color: 'bg-white border-slate-200',
        text: 'text-slate-600',
        badge: 'bg-slate-100 text-slate-600 border border-slate-200',
        accent: '#64748b',
        message: 'Hold tight, checking your schools!'
      };
    }

    const totalTracked = validPages.length;
    const asyncCount = validPages.filter(p => p.latestStatus === 'Asynchronous').length;
    const syncCount = validPages.filter(p => p.latestStatus === 'Synchronous').length;
    const noAnnouncementCount = validPages.filter(p => p.latestStatus === 'No Announcement').length;
    
    if (noAnnouncementCount === totalTracked) {
      return { 
        status: 'May Pasok 😭', 
        sub: 'Face-to-face today',
        emoji: '🎒',
        color: 'bg-[#FEE2E2] border-[#FECACA]',
        text: 'text-[#DC2626]',
        badge: 'bg-white text-red-600 border border-red-200',
        accent: '#ef4444',
        message: 'Walang suspension — pasok pa rin, kaya mo yan! 💪'
      };
    }
    
    if (asyncCount + syncCount === totalTracked) {
      return { 
        status: 'WALANG PASOK! 🎉', 
        sub: 'Classes suspended',
        emoji: '🎉',
        color: 'bg-[#D1FAE5] border-[#A7F3D0]',
        text: 'text-[#065F46]',
        badge: 'bg-white text-emerald-700 border border-emerald-200',
        accent: '#10b981',
        message: 'Tara, tambay! Stay safe at home 🏠'
      };
    }
    
    return { 
      status: 'Half-Half 🤔', 
      sub: 'Some schools suspended',
      emoji: '🌦️',
      color: 'bg-[#FEF3C7] border-[#FDE68A]',
      text: 'text-[#92400E]',
      badge: 'bg-white text-amber-700 border border-amber-200',
      accent: '#f59e0b',
      message: 'Check each school — mixed announcements today!'
    };
  };

  const handleAddUrl = async () => {
    if (!inputUrl.includes('facebook.com/')) {
      Alert.alert("Oops! 🤭", "Please enter a valid Facebook URL. Example: facebook.com/OfficialNEUST");
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
      Alert.alert("Failed 😢", "Couldn't add URL. Try again!");
    }
    setAdding(false);
  };

  const deletePage = async (id: string) => {
    const doDelete = async () => {
      const db = getDatabase(app);
      await remove(ref(db, `tracked_pages/${id}`));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${id} from tracking? 🗑️`)) doDelete();
    } else {
      Alert.alert("Untrack School?", `Remove ${id}? You can add it again later.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doDelete }
      ]);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const host = Platform.OS === 'web' ? 'localhost' : '10.0.2.2';
      const response = await fetch(`http://${host}:3000/api/refresh`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to refresh");
      Alert.alert("Updated! ✨", "Fresh data loaded. Check your schools!");
    } catch (error: any) {
      Alert.alert("Refresh Failed 😢", `${error.message}. Make sure scraper is running on port 3000.`);
    }
    setLoading(false);
  };

  const overall = getOverallStatus();

  const getStatusMeta = (status?: string) => {
    switch(status) {
      case 'Asynchronous': return { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', emoji: '🏠', label: 'Async' };
      case 'Synchronous': return { dot: 'bg-sky-500', pill: 'bg-sky-50 text-sky-700 border-sky-200', emoji: '💻', label: 'Sync' };
      case 'No Announcement': return { dot: 'bg-red-400', pill: 'bg-red-50 text-red-700 border-red-200', emoji: '🎒', label: 'F2F' };
      default: return { dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200', emoji: '⏳', label: status || '...' };
    }
  };

  return (
    <View className="flex-1 bg-[#FFFBEB]">
      {/* Fun Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-amber-100 shadow-sm">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-[#FFD23F] rounded-2xl items-center justify-center border-2 border-slate-900 shadow-sm" style={{ transform: [{rotate: '-3deg'}] }}>
              <GraduationCap size={22} color="#0f172a" strokeWidth={2.5} />
            </View>
            <View>
              <View className="flex-row items-center gap-1">
                <Text className="text-[22px] font-black text-slate-900 tracking-tight">PasokCheck</Text>
                <View className="bg-[#4ECDC4] px-1.5 py-0.5 rounded-full ml-1 border border-slate-900">
                  <Text className="text-[10px] font-black text-slate-900 tracking-widest">BETA</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-slate-400 -mt-1 tracking-wide">WALANG PASOK CHECKER ✨</Text>
            </View>
          </View>
          <View className="bg-slate-900 px-3 py-2 rounded-2xl items-center">
            <Text className="text-[10px] font-black text-amber-300 tracking-widest uppercase">{currentTime.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text>
            <Text className="text-white font-black text-sm leading-none">{currentTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO STATUS CARD */}
        <View className="px-4 pt-5">
          <View className={`rounded-[28px] border-2 ${overall.color} p-5 shadow-sm overflow-hidden relative`}>
            {/* decorative dots */}
            <View className="absolute -top-6 -right-6 w-24 h-24 bg-white/40 rounded-full" />
            <View className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/30 rounded-full" />
            
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Sparkles size={14} color={overall.accent} />
                  <Text className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Today&apos;s Verdict</Text>
                </View>
                <Text className={`text-[28px] font-black leading-8 ${overall.text} tracking-tight`}>{overall.status}</Text>
                <View className={`self-start mt-2 px-3 py-1.5 rounded-full border bg-white flex-row items-center gap-1`}>
                  <View className={`w-2 h-2 rounded-full`} style={{ backgroundColor: overall.accent }} />
                  <Text className={`text-xs font-black ${overall.text} tracking-wide`}>{overall.sub}</Text>
                </View>
                <Text className="text-[13px] font-semibold text-slate-600 mt-3 leading-4">{overall.message}</Text>
              </View>
              <View className="w-[86px] h-[86px] bg-white rounded-[22px] border-2 border-slate-900 items-center justify-center shadow-sm" style={{ transform: [{rotate: '3deg'}] }}>
                <Text className="text-4xl">{overall.emoji}</Text>
              </View>
            </View>

            {/* Pill stats */}
            <View className="flex-row gap-2 mt-5">
              <View className="flex-1 bg-white rounded-2xl py-3 items-center border border-slate-200">
                <Text className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tracked</Text>
                <Text className="text-xl font-black text-slate-900">{trackedPages.length}</Text>
              </View>
              <View className="flex-1 bg-slate-900 rounded-2xl py-3 items-center border border-slate-900">
                <Text className="text-[10px] font-black tracking-widest text-amber-300 uppercase">As of</Text>
                <Text className="text-[13px] font-black text-white">{currentTime.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'})}</Text>
              </View>
              <TouchableOpacity 
                onPress={handleRefresh}
                disabled={loading}
                className={`flex-1 rounded-2xl py-3 items-center border-2 flex-row justify-center gap-1.5 ${loading ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-900 active:bg-amber-50'}`}
              >
                {loading ? <ActivityIndicator size="small" color="#0f172a" /> : <RefreshCw size={16} color="#0f172a" strokeWidth={2.5} />}
                <Text className="text-xs font-black text-slate-900 tracking-wide">{loading ? '...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ADD SCHOOL CARD */}
        <View className="px-4 mt-5">
          <View className="bg-white rounded-[24px] border-2 border-slate-900 p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 bg-[#FF6B6B] rounded-xl items-center justify-center border border-slate-900">
                  <BookOpen size={16} color="white" strokeWidth={2.5} />
                </View>
                <Text className="text-[15px] font-black text-slate-900">Add a school 🏫</Text>
              </View>
              <Text className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-200">Facebook page</Text>
            </View>
            
            <View className="flex-row items-center bg-[#FFF7ED] border-2 border-slate-900 rounded-2xl px-3 py-1.5 focus-within:border-amber-400">
              <Search size={18} color="#0f172a" strokeWidth={2.5} />
              <TextInput
                className="flex-1 h-11 ml-2.5 text-slate-900 text-[15px] font-semibold"
                placeholder="facebook.com/OfficialNEUST"
                placeholderTextColor="#9ca3af"
                value={inputUrl}
                onChangeText={setInputUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity 
                className={`w-10 h-10 rounded-xl items-center justify-center border-2 border-slate-900 ${adding ? 'bg-slate-200' : 'bg-[#FFD23F] active:bg-amber-400'}`}
                onPress={handleAddUrl}
                disabled={adding}
              >
                {adding ? <ActivityIndicator color="#0f172a" size="small" /> : <Plus color="#0f172a" size={20} strokeWidth={3} />}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              className="flex-row items-center mt-3 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 active:bg-slate-100" 
              onPress={() => setIgnoreWeekends(!ignoreWeekends)}
            >
              <View className={`w-6 h-6 rounded-full items-center justify-center border-2 ${ignoreWeekends ? 'bg-[#6C5CE7] border-slate-900' : 'bg-white border-slate-300'}`}>
                {ignoreWeekends ? <Check size={14} color="white" strokeWidth={3} /> : <Moon size={12} color="#94a3b8" />}
              </View>
              <View className="ml-2.5 flex-1">
                <Text className="text-[13px] font-black text-slate-800">Force check on weekends</Text>
                <Text className="text-[11px] font-semibold text-slate-500">Ignore weekend mode & show real status</Text>
              </View>
              <View className={`px-2 py-1 rounded-full border ${ignoreWeekends ? 'bg-[#6C5CE7] border-slate-900' : 'bg-white border-slate-200'}`}>
                <Text className={`text-[10px] font-black tracking-widest ${ignoreWeekends ? 'text-white' : 'text-slate-400'}`}>{ignoreWeekends ? 'ON' : 'OFF'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* TRACKED LIST */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-[16px] font-black text-slate-900 tracking-tight">Your schools</Text>
              <View className="bg-slate-900 px-2.5 py-1 rounded-full">
                <Text className="text-xs font-black text-white">{trackedPages.length}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <Text className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Live</Text>
            </View>
          </View>

          {loading ? (
            <View className="bg-white rounded-[24px] border-2 border-slate-900 p-10 items-center">
              <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center border-2 border-slate-900 mb-3">
                <ActivityIndicator size="large" color="#0f172a" />
              </View>
              <Text className="text-sm font-black text-slate-900">Loading your schools...</Text>
              <Text className="text-xs font-semibold text-slate-500 mt-1">Fetching fresh announcements ✨</Text>
            </View>
          ) : trackedPages.length === 0 ? (
            <View className="bg-white rounded-[24px] border-2 border-dashed border-slate-300 p-8 items-center">
              <View className="w-20 h-20 bg-[#FFF7ED] rounded-full items-center justify-center border-2 border-slate-900 mb-4" style={{ transform: [{rotate: '-6deg'}] }}>
                <Text className="text-4xl">🎒</Text>
              </View>
              <Text className="text-[18px] font-black text-slate-900 text-center">No schools yet!</Text>
              <Text className="text-[13px] font-semibold text-slate-500 text-center mt-1 leading-5">Add your university&apos;s Facebook page above{"\n"}to get instant pasok updates.</Text>
              <View className="mt-4 bg-[#FFD23F] border-2 border-slate-900 rounded-full px-4 py-2">
                <Text className="text-xs font-black text-slate-900">Try: facebook.com/OfficialNEUST</Text>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              {trackedPages.map((item) => {
                const meta = getStatusMeta(item.latestStatus);
                const isSuspended = item.latestStatus === 'Asynchronous' || item.latestStatus === 'Synchronous';
                const isF2F = item.latestStatus === 'No Announcement';
                const cardAccent = isSuspended ? 'border-emerald-200 bg-emerald-50/50' : isF2F ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30';
                return (
                  <TouchableOpacity 
                    key={item.id}
                    className={`bg-white rounded-[20px] border-2 border-slate-900 p-3.5 flex-row items-center shadow-sm active:scale-[0.98] ${cardAccent}`}
                    onPress={() => router.push(`/page/${item.id}`)}
                    activeOpacity={0.9}
                  >
                    <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center border-2 border-slate-900 mr-3">
                      <Text className="text-xl">{meta.emoji}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[15px] font-black text-slate-900" numberOfLines={1}>{item.id}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <View className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <View className={`px-2 py-0.5 rounded-full border ${meta.pill}`}>
                          <Text className="text-[11px] font-black tracking-wide">{meta.label}</Text>
                        </View>
                        <Text className="text-[11px] font-semibold text-slate-500 flex-1" numberOfLines={1}>{item.latestStatus}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <TouchableOpacity 
                        onPress={() => deletePage(item.id)}
                        className="w-9 h-9 bg-white border border-slate-200 rounded-full items-center justify-center active:bg-red-50"
                        hitSlop={8}
                      >
                        <Trash2 size={16} color="#ef4444" strokeWidth={2} />
                      </TouchableOpacity>
                      <View className="w-9 h-9 bg-slate-900 rounded-full items-center justify-center">
                        <Text className="text-white font-black text-sm">›</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Fun footer */}
        <View className="mx-4 mt-6 bg-slate-900 rounded-[24px] p-4 flex-row items-center border-2 border-slate-900">
          <View className="w-10 h-10 bg-[#4ECDC4] rounded-xl items-center justify-center border border-white">
            <PartyPopper size={18} color="#0f172a" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-black text-[13px]">Tip: Enable notifications 🔔</Text>
            <Text className="text-slate-400 text-xs font-semibold">Get pasok alerts before you leave home!</Text>
          </View>
          <View className="bg-white px-3 py-1.5 rounded-full">
            <Text className="text-xs font-black text-slate-900">Soon!</Text>
          </View>
        </View>

        <View className="items-center mt-6 gap-1">
          <Text className="text-[11px] font-black tracking-widest text-slate-400 uppercase">PasokCheck • For Students, By Students 🎓</Text>
          <View className="flex-row items-center gap-1">
            <CloudRain size={12} color="#94a3b8" />
            <Text className="text-[11px] font-semibold text-slate-400">Stay safe, stay updated — May 2026</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
