import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Calendar, Bell } from 'lucide-react-native';

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

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'asynchronous': return 'bg-emerald-50 border-emerald-200 text-emerald-600';
      case 'synchronous': return 'bg-amber-50 border-amber-200 text-amber-600';
      case 'weekend': return 'bg-purple-50 border-purple-200 text-purple-600';
      case 'no announcement':
      case 'face to face':
      default: return 'bg-red-50 border-red-200 text-red-600';
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="pt-16 pb-4 px-6 bg-slate-50 border-b border-slate-200 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 -ml-2 rounded-full active:bg-slate-200">
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-slate-900">{id}</Text>
          <Text className="text-sm text-slate-500">Today's Agenda</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-6">
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center mb-4">
              <Calendar size={32} color="#3b82f6" />
            </View>
            <Text className="text-slate-500 font-medium mb-2">Current Status</Text>
            
            <View className={`px-6 py-2 rounded-full border-2 ${getStatusColor(pageData?.latestStatus)}`}>
              <Text className="text-xl font-black uppercase tracking-widest">{pageData?.latestStatus || 'UNKNOWN'}</Text>
            </View>
            
            <Text className="text-slate-400 text-xs mt-4">
              Last Checked: {pageData?.lastUpdated ? new Date(pageData.lastUpdated).toLocaleString() : 'Never'}
            </Text>
          </View>

          <View className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
            <View className="flex-row items-center mb-3">
              <Bell size={18} color="#64748b" />
              <Text className="text-slate-700 font-bold ml-2 text-lg">Latest Announcement</Text>
            </View>
            
            <Text className="text-slate-600 leading-relaxed text-base">
              {pageData?.recentPostText || "No recent class announcements found on this page."}
            </Text>
          </View>

          <TouchableOpacity 
            className="bg-blue-600 rounded-xl py-4 flex-row justify-center items-center gap-2 active:bg-blue-700 shadow-sm"
            onPress={() => Linking.openURL(pageData?.url || `https://facebook.com/${id}`)}
          >
            <Text className="text-white font-bold text-lg">View Facebook Page</Text>
            <ExternalLink size={20} color="white" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
