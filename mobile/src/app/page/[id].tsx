import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabase, ref, onValue, remove } from 'firebase/database';
import { app } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Calendar, Bell, Clock, ShieldCheck, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function PageDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pfpError, setPfpError] = useState(false);
  const [allPages, setAllPages] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsub = onValue(ref(getDatabase(app), `tracked_pages/${id}`), (s) => { setPageData(s.val()); setLoading(false); });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsubAll = onValue(ref(getDatabase(app), 'tracked_pages'), (s) => setAllPages(s.val() || {}));
    return () => unsubAll();
  }, []);

  const getTheme = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'asynchronous': return { bg: 'bg-emerald-50', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'No class — Async', desc: 'Stay home, do async tasks' };
      case 'synchronous': return { bg: 'bg-amber-50', chip: 'bg-amber-100 text-amber-800 border-amber-200', label: 'No class — Sync', desc: 'Online class today' };
      case 'no announcement':
      case 'face to face': return { bg: 'bg-white', chip: 'bg-zinc-100 text-zinc-700 border-zinc-200', label: 'Regular class', desc: 'No suspension posted — tuloy ang pasok' };
      default: return { bg: 'bg-white', chip: 'bg-white text-zinc-600 border-zinc-300', label: status || 'Unknown', desc: 'Checking latest bulletin...' };
    }
  };

  const parentId = (pageData as any)?.parentId || null;
  const parent = parentId ? (allPages as any)[parentId] : null;
  const isSuspended = (s?: string) => s === 'Asynchronous' || s === 'Synchronous';
  const effectiveStatus = parentId && parent && isSuspended(parent.latestStatus) ? parent.latestStatus : pageData?.latestStatus;
  const isInherited = effectiveStatus !== pageData?.latestStatus;
  const children: any[] = Object.keys(allPages).filter(k => (allPages as any)[k]?.parentId === id).map(k => ({ id: k, ...(allPages as any)[k] }));
  const theme = getTheme(effectiveStatus);
  const softShadow = { boxShadow: '4px 4px 0px #000' } as any;

  const pfpUrl = pageData?.pfp || `https://graph.facebook.com/${encodeURIComponent((id as string) || '')}/picture?type=large&width=200&height=200`;
  const displayName = pageData?.pageName || (id as string);
  useEffect(() => setPfpError(false), [pfpUrl]);

  const handleDelete = async () => {
    const go = async () => { await remove(ref(getDatabase(app), `tracked_pages/${id}`)); router.back(); };
    Alert.alert("Remove page?", `Stop tracking ${id}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: go }]);
  };

  return (
    <View className="flex-1 bg-[#F8F6F1]">
      <View className="bg-white pt-12 pb-3 px-4 flex-row items-center gap-3 border-b border-zinc-200">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-white border border-zinc-200 rounded-xl items-center justify-center">
          <ArrowLeft size={16} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <View className="w-9 h-9 rounded-full overflow-hidden border border-zinc-200 bg-zinc-900 items-center justify-center">
          {!pfpError ? (
            <Image source={{ uri: pfpUrl }} style={{ width: 36, height: 36 }} contentFit="cover" cachePolicy="memory-disk" onError={() => setPfpError(true)} />
          ) : (
            <Text className="text-white font-black text-xs">{(displayName[0] || '?').toUpperCase()}</Text>
          )}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-zinc-900 font-bold text-[15px]" numberOfLines={1}>{displayName}</Text>
          <Text className="text-[#5A5A5A] text-[11px]" numberOfLines={1}>{id as string} • Tap to open on Facebook</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} className="w-9 h-9 bg-white border border-zinc-200 rounded-xl items-center justify-center">
          <Trash2 size={14} color="#71717a" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-white rounded-2xl border border-zinc-200 p-8 items-center w-full">
            <ActivityIndicator size="small" color="#000" />
            <Text className="text-[#5A5A5A] text-sm mt-2">Loading {id}…</Text>
          </View>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {parent && (
            <View className="px-5 pt-4">
              <TouchableOpacity onPress={() => router.push(`/page/${parentId}`)} className="bg-zinc-900 rounded-xl px-3 py-2.5 flex-row items-center gap-2.5">
                <View className="w-7 h-7 rounded-full bg-white items-center justify-center border border-zinc-200">
                  <Text className="text-zinc-900 font-black text-xs">{((parent as any).pageName || parentId || '?')[0].toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-xs">Part of {(parent as any).pageName || parentId}</Text>
                  <Text className="text-zinc-400 text-[11px]">LGU • Tap to view parent</Text>
                </View>
                <ExternalLink size={12} color="#a1a1aa" strokeWidth={2} />
              </TouchableOpacity>
              {isInherited && (
                <View className="mt-2 bg-[#FFE600] border-2 border-black rounded-xl px-3 py-2">
                  <Text className="text-black font-bold text-xs">Inherited: {effectiveStatus} via LGU — all schools under this LGU are suspended</Text>
                </View>
              )}
            </View>
          )}

          {/* Verdict — Level 1 only with shadow */}
          <View className="px-5 pt-6">
            <View className={`rounded-2xl border-2 ${effectiveStatus === 'Asynchronous' || effectiveStatus === 'Synchronous' ? 'border-black bg-[#FFE600]' : 'border-zinc-200 bg-white'} p-5`} style={effectiveStatus === 'Asynchronous' || effectiveStatus === 'Synchronous' ? softShadow : undefined}>
              <View className="flex-row items-center gap-2 mb-2">
                {(() => {
                  const p = theme.chip.split(' ');
                  const bg = p.filter(c=>c.startsWith('bg-')||c.startsWith('border')).join(' ');
                  const tx = p.filter(c=>c.startsWith('text-')).join(' ')||'text-zinc-900';
                  return (
                    <View className={`px-2.5 py-1 rounded-full border ${bg}`}>
                      <Text className={`font-bold text-xs ${tx}`}>{theme.label}</Text>
                    </View>
                  );
                })()}
                <Text className="text-[#5A5A5A] text-xs">• {effectiveStatus || 'Unknown'}{isInherited ? ' • via LGU' : ''}</Text>
              </View>
              <Text className="text-zinc-900 font-black text-xl tracking-tight">{effectiveStatus || 'Unknown'}</Text>
              <Text className="text-[#5A5A5A] text-[13px] leading-5 mt-1">{theme.desc}{isInherited ? ` — inherited from ${(parent as any)?.pageName || parentId}` : ''}</Text>
              <View className="flex-row gap-2 mt-4">
                <View className="flex-1 bg-zinc-900 rounded-xl px-3 py-2">
                  <Text className="text-zinc-400 font-bold text-[10px] tracking-widest">CHECKED</Text>
                  <Text className="text-white font-semibold text-xs">{pageData?.lastUpdated ? `${timeAgo(pageData.lastUpdated)} • ${new Date(pageData.lastUpdated).toLocaleString()}` : 'Just now'}</Text>
                </View>
                <View className="bg-white rounded-xl border border-zinc-200 px-3 py-2 flex-row items-center gap-2">
                  <ShieldCheck size={14} color="#16a34a" strokeWidth={2.5} />
                  <Text className="text-[#5A5A5A] font-bold text-xs">Scraped from FB</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => Linking.openURL(pageData?.url || `https://facebook.com/${id}`)} className="mt-3 bg-white border border-zinc-200 rounded-xl py-2.5 flex-row justify-center items-center gap-2">
                <Text className="text-zinc-900 font-semibold text-sm">View source post on Facebook</Text>
                <ExternalLink size={14} color="#52525b" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row gap-3 px-5 mt-4">
            <View className="flex-1 bg-white rounded-xl border border-zinc-200 p-3 flex-row items-center gap-2">
              <View className="w-7 h-7 bg-zinc-50 rounded-lg border border-zinc-200 items-center justify-center">
                <Calendar size={12} color="#52525b" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-[#5A5A5A] font-bold text-[10px] tracking-widest">ADDED</Text>
                <Text className="text-zinc-900 font-semibold text-xs">{pageData?.addedAt ? new Date(pageData.addedAt).toLocaleDateString() : '—'}</Text>
              </View>
            </View>
            <View className="flex-1 bg-white rounded-xl border border-zinc-200 p-3 flex-row items-center gap-2">
              <View className="w-7 h-7 bg-zinc-50 rounded-lg border border-zinc-200 items-center justify-center">
                <Bell size={12} color="#52525b" strokeWidth={2} />
              </View>
              <View>
                <Text className="text-[#5A5A5A] font-bold text-[10px] tracking-widest">POSTS</Text>
                <Text className="text-zinc-900 font-semibold text-xs">{pageData?.history?.length || 0} posts</Text>
              </View>
            </View>
          </View>

          <View className="px-5 mt-6">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-zinc-900 font-bold">Announcement history</Text>
              <View className="bg-white border border-zinc-200 rounded-full px-2 py-0.5">
                <Text className="text-[#5A5A5A] font-bold text-xs">{pageData?.history?.length || 0}</Text>
              </View>
            </View>
            {pageData?.history?.length ? (
              <View className="gap-2.5">
                {pageData.history.map((post: any, i: number) => {
                  const t = getTheme(post.status);
                  return (
                    <View key={post.postId || i} className="bg-white rounded-2xl border border-zinc-200 p-4">
                      <View className="flex-row justify-between items-center mb-2">
                        {(() => {
                          const p = t.chip.split(' ');
                          const bg = p.filter(c=>c.startsWith('bg-')||c.startsWith('border')).join(' ');
                          const tx = p.filter(c=>c.startsWith('text-')).join(' ')||'text-zinc-900';
                          return (
                            <View className={`px-2.5 py-1 rounded-full border ${bg}`}>
                              <Text className={`font-bold text-xs ${tx}`}>{post.status}</Text>
                            </View>
                          );
                        })()}
                        <Text className="text-[#71717a] text-[11px]">{new Date(post.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(post.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View className="bg-zinc-50 rounded-xl border border-zinc-100 p-3">
                        <Text className="text-zinc-700 text-[13px] leading-5">{post.text || "Image announcement — tap View on Facebook to see original."}</Text>
                      </View>
                      <View className="flex-row items-center gap-2 mt-2">
                        <Clock size={10} color="#a1a1aa" strokeWidth={2} />
                        <Text className="text-zinc-400 text-[11px]">Posted {timeAgo(post.timestamp)} • {new Date(post.timestamp).toLocaleString()}</Text>
                        {i === 0 && <View className="ml-auto bg-[#FFE600] rounded-full px-2 py-0.5 border border-black"><Text className="font-bold text-[10px]">Latest</Text></View>}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-white rounded-2xl border border-dashed border-zinc-300 p-6 items-center">
                <Text className="text-2xl">📭</Text>
                <Text className="text-zinc-900 font-semibold mt-2">No announcements yet</Text>
                <Text className="text-[#5A5A5A] text-xs text-center mt-1">We’ll show posts here after the next scrape. Pull to refresh.</Text>
              </View>
            )}
          </View>

          {children.length > 0 && (
            <View className="px-5 mt-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-zinc-900 font-bold">Schools under this LGU</Text>
                <View className="bg-[#FFE600] border border-black rounded-full px-2 py-0.5">
                  <Text className="font-black text-[11px]">{children.length}</Text>
                </View>
              </View>
              <View className="gap-2">
                {children.map((child: any) => {
                  const childEff = (child.parentId && allPages[child.parentId] && (allPages[child.parentId].latestStatus === 'Asynchronous' || allPages[child.parentId].latestStatus === 'Synchronous')) ? allPages[child.parentId].latestStatus : child.latestStatus;
                  const isChildInherited = childEff !== child.latestStatus;
                  return (
                    <TouchableOpacity key={child.id} onPress={() => router.push(`/page/${child.id}`)} className="bg-white rounded-xl border border-zinc-200 p-3 flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 items-center justify-center overflow-hidden">
                        <Image source={{ uri: child.pfp || `https://graph.facebook.com/${encodeURIComponent(child.id)}/picture?type=large&width=200&height=200` }} style={{ width: 32, height: 32 }} contentFit="cover" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-900 font-semibold text-sm" numberOfLines={1}>{child.pageName || child.id}</Text>
                        <Text className="text-[#5A5A5A] text-xs">{childEff}{isChildInherited ? ' • via LGU' : ''} • {child.latestStatus}</Text>
                      </View>
                      <ExternalLink size={14} color="#a1a1aa" strokeWidth={2} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="text-zinc-500 text-[11px] mt-2 leading-4">If this LGU posts a suspension, all schools above will automatically show as suspended (inherited). No need to post per-school.</Text>
            </View>
          )}

          <View className="px-5 mt-6">
            <TouchableOpacity className="bg-zinc-900 rounded-xl py-3.5 flex-row justify-center items-center gap-2" onPress={() => Linking.openURL(pageData?.url || `https://facebook.com/${id}`)}>
              <Text className="text-white font-bold">View on Facebook</Text>
              <ExternalLink size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text className="text-zinc-400 text-[11px] text-center mt-2">Source: {pageData?.url || `https://facebook.com/${id}`}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
