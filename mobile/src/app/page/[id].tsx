import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Calendar, Bell, Sparkles, PartyPopper, BookOpen, Clock, ShieldCheck, Megaphone } from 'lucide-react-native';

export default function PageDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase(app);
    const pageRef = ref(db, `tracked_pages/${id}`);
    const unsubscribe = onValue(pageRef, (snapshot) => {
      setPageData(snapshot.val());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const getStatusTheme = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'asynchronous': return { 
        bg: 'bg-[#D1FAE5]', border: 'border-[#6EE7B7]', text: 'text-[#065F46]', emoji: '🏠', label: 'Async — Stay Home!',
        desc: 'Online tasks lang today. No need to commute!',
        iconBg: 'bg-emerald-500'
      };
      case 'synchronous': return { 
        bg: 'bg-[#DBEAFE]', border: 'border-[#93C5FD]', text: 'text-[#1E40AF]', emoji: '💻', label: 'Sync — Online Class',
        desc: 'Join your online class on time!',
        iconBg: 'bg-sky-500'
      };
      case 'weekend': return { 
        bg: 'bg-[#EDE9FE]', border: 'border-[#C4B5FD]', text: 'text-[#6D28D9]', emoji: '🛋️', label: 'Weekend Vibes',
        desc: 'Rest day! Recharge for next week ✨',
        iconBg: 'bg-violet-500'
      };
      case 'no announcement':
      case 'face to face':
        return { 
          bg: 'bg-[#FEE2E2]', border: 'border-[#FCA5A5]', text: 'text-[#991B1B]', emoji: '🎒', label: 'Face to Face',
          desc: 'Tuloy ang pasok — see you on campus!',
          iconBg: 'bg-red-500'
        };
      default: return { 
        bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', emoji: '⏳', label: status || 'Unknown',
        desc: 'Checking latest bulletin...',
        iconBg: 'bg-amber-500'
      };
    }
  };

  const theme = getStatusTheme(pageData?.latestStatus);

  return (
    <View className="flex-1 bg-[#FFFBEB]">
      {/* Fun Header */}
      <View className="pt-14 pb-4 px-4 bg-white border-b-2 border-slate-900 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white border-2 border-slate-900 rounded-xl items-center justify-center active:bg-slate-50">
          <ArrowLeft size={20} color="#0f172a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View className="w-10 h-10 bg-[#FFD23F] rounded-xl items-center justify-center border-2 border-slate-900" style={{ transform: [{rotate: '-3deg'}] }}>
          <BookOpen size={18} color="#0f172a" strokeWidth={2.5} />
        </View>
        <View className="flex-1">
          <Text className="text-[17px] font-black text-slate-900 tracking-tight" numberOfLines={1}>{id}</Text>
          <View className="flex-row items-center gap-1">
            <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <Text className="text-[11px] font-black tracking-widest text-slate-500 uppercase">Official Page • Tracked</Text>
          </View>
        </View>
        <View className="bg-slate-900 px-3 py-1.5 rounded-full">
          <Text className="text-[10px] font-black text-amber-300 tracking-widest">DETAILS</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-white border-2 border-slate-900 rounded-[24px] p-8 items-center w-full">
            <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center border-2 border-slate-900 mb-4">
              <ActivityIndicator size="large" color="#0f172a" />
            </View>
            <Text className="text-base font-black text-slate-900">Loading {id}...</Text>
            <Text className="text-xs font-semibold text-slate-500 mt-1">Fetching latest announcements ✨</Text>
          </View>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* HERO STATUS */}
          <View className="px-4 pt-5">
            <View className={`rounded-[28px] border-2 ${theme.border} ${theme.bg} p-5 shadow-sm overflow-hidden relative`}>
              <View className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full" />
              <View className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/30 rounded-full" />
              
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <Sparkles size={14} color="#0f172a" />
                    <Text className="text-[11px] font-black tracking-widest text-slate-600 uppercase">Current Status</Text>
                  </View>
                  <View className={`self-start bg-white border-2 border-slate-900 rounded-full px-3 py-1 flex-row items-center gap-2`}>
                    <View className={`w-2.5 h-2.5 rounded-full ${theme.iconBg}`} />
                    <Text className="text-xs font-black tracking-wide text-slate-900">{theme.label}</Text>
                  </View>
                  <Text className={`text-[26px] font-black mt-3 leading-7 ${theme.text} tracking-tight`}>{pageData?.latestStatus || 'UNKNOWN'}</Text>
                  <Text className="text-[13px] font-semibold text-slate-600 mt-2 leading-4">{theme.desc}</Text>
                </View>
                <View className="w-[84px] h-[84px] bg-white rounded-[20px] border-2 border-slate-900 items-center justify-center shadow-sm" style={{ transform: [{rotate: '4deg'}] }}>
                  <Text className="text-4xl">{theme.emoji}</Text>
                </View>
              </View>

              <View className="flex-row gap-2 mt-5">
                <View className="flex-1 bg-white rounded-2xl border-2 border-slate-900 p-3 flex-row items-center gap-2.5">
                  <View className="w-8 h-8 bg-slate-900 rounded-xl items-center justify-center">
                    <Clock size={16} color="white" strokeWidth={2.5} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Last Checked</Text>
                    <Text className="text-xs font-black text-slate-900" numberOfLines={1}>{pageData?.lastUpdated ? new Date(pageData.lastUpdated).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</Text>
                  </View>
                </View>
                <View className="bg-slate-900 rounded-2xl border-2 border-slate-900 p-3 items-center justify-center px-4">
                  <ShieldCheck size={20} color="#4ECDC4" strokeWidth={2.5} />
                  <Text className="text-[10px] font-black text-amber-300 tracking-widest mt-1">VERIFIED</Text>
                </View>
              </View>
            </View>
          </View>

          {/* INFO PILLS */}
          <View className="flex-row gap-2 px-4 mt-4">
            <View className="flex-1 bg-white border-2 border-slate-900 rounded-2xl p-3 flex-row items-center gap-2">
              <View className="w-7 h-7 bg-[#FFD23F] rounded-full items-center justify-center border border-slate-900">
                <Calendar size={14} color="#0f172a" strokeWidth={2.5} />
              </View>
              <View>
                <Text className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Added</Text>
                <Text className="text-xs font-bold text-slate-900">{pageData?.addedAt ? new Date(pageData.addedAt).toLocaleDateString() : '—'}</Text>
              </View>
            </View>
            <View className="flex-1 bg-white border-2 border-slate-900 rounded-2xl p-3 flex-row items-center gap-2">
              <View className="w-7 h-7 bg-[#4ECDC4] rounded-full items-center justify-center border border-slate-900">
                <Bell size={14} color="#0f172a" strokeWidth={2.5} />
              </View>
              <View>
                <Text className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Posts</Text>
                <Text className="text-xs font-bold text-slate-900">{pageData?.history?.length || 0} announcements</Text>
              </View>
            </View>
          </View>

          {/* HISTORY */}
          <View className="px-4 mt-6">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-8 h-8 bg-slate-900 rounded-xl items-center justify-center">
                <Megaphone size={16} color="#FFD23F" strokeWidth={2.5} />
              </View>
              <Text className="text-[16px] font-black text-slate-900 tracking-tight">Announcement History</Text>
              <View className="bg-white border border-slate-200 px-2 py-1 rounded-full">
                <Text className="text-[10px] font-black text-slate-600">{pageData?.history?.length || 0} posts</Text>
              </View>
            </View>
            
            {pageData?.history && pageData.history.length > 0 ? (
              <View className="gap-3">
                {pageData.history.map((post: any, index: number) => {
                  const t = getStatusTheme(post.status);
                  return (
                    <View key={post.postId || index} className="bg-white border-2 border-slate-900 rounded-[20px] p-4 shadow-sm">
                      <View className="flex-row justify-between items-center mb-2.5">
                        <View className={`px-3 py-1 rounded-full border-2 flex-row items-center gap-1.5 ${t.bg} ${t.border}`}>
                          <Text className="text-sm">{t.emoji}</Text>
                          <Text className={`font-black text-xs tracking-wide ${t.text}`}>{post.status}</Text>
                        </View>
                        <View className="bg-slate-900 px-2.5 py-1 rounded-full">
                          <Text className="text-white text-[10px] font-black tracking-widest">
                            {new Date(post.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(post.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                      <View className="bg-[#FFFBEB] border border-amber-100 rounded-2xl p-3">
                        <Text className="text-slate-800 leading-5 text-[13px] font-medium">
                          {post.text || "No text content — likely an image announcement. Tap View on Facebook to see details."}
                        </Text>
                      </View>
                      {index === 0 && (
                        <View className="mt-2.5 flex-row items-center gap-1.5">
                          <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          <Text className="text-[10px] font-black tracking-widest text-emerald-700 uppercase">Latest Update</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-white border-2 border-dashed border-slate-300 rounded-[20px] p-8 items-center">
                <View className="w-16 h-16 bg-slate-50 rounded-full items-center justify-center border-2 border-slate-900 mb-3">
                  <Text className="text-2xl">📭</Text>
                </View>
                <Text className="text-sm font-black text-slate-900">No announcements yet</Text>
                <Text className="text-xs font-semibold text-slate-500 text-center mt-1 leading-4">We&apos;ll show posts here once the scraper runs.{"\n"}Try hitting Refresh!</Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <View className="px-4 mt-6 gap-3">
            <TouchableOpacity 
              className="bg-[#6C5CE7] rounded-[20px] py-4 flex-row justify-center items-center gap-2 border-2 border-slate-900 shadow-sm active:bg-[#5A4BD1]"
              onPress={() => Linking.openURL(pageData?.url || `https://facebook.com/${id}`)}
            >
              <Text className="text-white font-black text-[15px] tracking-wide">View on Facebook</Text>
              <ExternalLink size={18} color="white" strokeWidth={2.5} />
            </TouchableOpacity>
            
            <View className="bg-white border-2 border-slate-900 rounded-2xl p-3.5 flex-row items-center gap-3">
              <View className="w-10 h-10 bg-amber-100 rounded-xl items-center justify-center border border-slate-900">
                <PartyPopper size={18} color="#0f172a" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-slate-900">Share with classmates! 👯</Text>
                <Text className="text-xs font-semibold text-slate-500">Add the same page to stay synced</Text>
              </View>
              <View className="w-8 h-8 bg-slate-900 rounded-full items-center justify-center">
                <Text className="text-white font-black">↗</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
