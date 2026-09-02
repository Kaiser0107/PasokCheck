import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform, Keyboard, Alert, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import { app } from '../lib/firebase';
import { Plus, Search, RefreshCw, GraduationCap, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFileCircleQuestion, faMagnifyingGlass, faGraduationCap, faPartyHorn, faCloudSunRain, faTriangleExclamation, faUmbrellaBeach } from '@fortawesome/free-solid-svg-icons';

interface TrackedPage { id: string; url: string; latestStatus?: string; timestamp?: string; pfp?: string; pageName?: string; parentId?: string | null; type?: 'lgu'|'school'|string; }

function getPfpUrl(page: TrackedPage) {
  if (page.pfp) return page.pfp;
  return `https://graph.facebook.com/${encodeURIComponent(page.id)}/picture?type=large&width=200&height=200`;
}

function PageAvatar({ page, size = 36 }: { page: TrackedPage; size?: number }) {
  const [error, setError] = useState(false);
  const uri = getPfpUrl(page);
  const initial = (page.pageName?.[0] || page.id[0] || '?').toUpperCase();
  if (error || !uri) {
    return (
      <View style={{ width: size, height: size }} className="rounded-full bg-zinc-900 items-center justify-center shrink-0">
        <Text className="text-white font-black text-xs">{initial}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }} className="rounded-full bg-zinc-200 items-center justify-center shrink-0 overflow-hidden border border-zinc-200">
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size/2 }}
        contentFit="cover"
        onError={() => setError(true)}
        cachePolicy="memory-disk"
        transition={150}
      />
    </View>
  );
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function HomeScreen() {
  const [inputUrl, setInputUrl] = useState('');
  const [trackedPages, setTrackedPages] = useState<TrackedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [now, setNow] = useState(new Date());
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => { const t = setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(t); }, []);
  useEffect(() => {
    const unsub = onValue(ref(getDatabase(app),'tracked_pages'), snap=>{
      const d=snap.val();
      if(d) setTrackedPages(Object.keys(d).map(k=>({id:k,url:d[k].url,latestStatus:d[k].latestStatus||'Scanning...',timestamp:d[k].lastUpdated||d[k].addedAt||'', pfp: d[k].pfp || null, pageName: d[k].pageName || null, parentId: d[k].parentId || null, type: d[k].type || null})));
      else setTrackedPages([]);
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const isSuspended = (s?: string) => s === 'Asynchronous' || s === 'Synchronous';
  const getEffectiveStatus = (page: TrackedPage) => {
    if (page.parentId) {
      const parent = trackedPages.find(p => p.id === page.parentId);
      if (parent && isSuspended(parent.latestStatus)) return parent.latestStatus as string;
    }
    return page.latestStatus;
  };

  const getOverall = () => {
    if(trackedPages.length===0) return {
      title: 'No pages tracked yet',
      verdict: 'Add a page to get started',
      chip: null as any,
      bg: 'bg-white', border: 'border-zinc-200', shadow: false,
      icon: faFileCircleQuestion, iconColor: '#a1a1aa',
      hint: 'Track a school, LGU, or mayor page to see updates here',
    };
    const valid=trackedPages.filter(p=>getEffectiveStatus(p)!=='Scanning...');
    if(valid.length===0) return {
      title:'Waiting for posts',
      verdict:'No announcement yet',
      chip:{label:'PENDING', style:'bg-white text-zinc-600 border border-zinc-300'},
      bg:'bg-white', border:'border-zinc-300', shadow:false,
      icon: faMagnifyingGlass, iconColor: '#71717a',
      hint:'We haven't seen a post today — check back soon',
    };
    const newest=valid.reduce((a,b)=> (a.timestamp && b.timestamp && new Date(a.timestamp)>new Date(b.timestamp)?a:b));
    const stale=newest.timestamp ? (Date.now()-new Date(newest.timestamp).getTime()>6*3600*1000) : false;
    if(stale) return {
      title:'Updates may be stale',
      verdict:`Last check ${timeAgo(newest.timestamp)}`,
      chip:{label:'STALE', style:'bg-amber-100 text-amber-800 border border-amber-200'},
      bg:'bg-amber-50', border:'border-amber-200', shadow:false,
      icon: faTriangleExclamation, iconColor: '#d97706',
      hint:'Tap Refresh to re-scan',
    };
    const effective = valid.map(p => getEffectiveStatus(p));
    const total=effective.length;
    const asyncN=effective.filter(s=>s==='Asynchronous').length;
    const syncN=effective.filter(s=>s==='Synchronous').length;
    const holidayN=effective.filter(s=>s==='Holiday').length;
    const noAnn=effective.filter(s=>s==='No Announcement').length;
    if(holidayN===total) return {
      title:'Holiday today',
      verdict:'No classes — public holiday',
      chip:{label:'HOLIDAY', style:'bg-violet-100 text-violet-800 border border-violet-200'},
      bg:'bg-violet-50', border:'border-violet-200', shadow:false,
      icon: faUmbrellaBeach, iconColor: '#7c3aed',
      hint:'Enjoy the holiday! Schools are closed.',
    };
    if(noAnn===total) return {
      title:'Regular class',
      verdict:'No suspensions posted',
      chip:{label:'REGULAR CLASS', style:'bg-zinc-100 text-zinc-700 border border-zinc-200'},
      bg:'bg-white', border:'border-zinc-200', shadow:false,
      icon: faGraduationCap, iconColor: '#3f3f46',
      hint:'All tracked pages show no announcement',
    };
    if(asyncN+syncN===total) return {
      title:'No class',
      verdict:'Classes suspended — stay home',
      chip:{label:'NO CLASS', style:'bg-emerald-600 text-white border-emerald-600'},
      bg:'bg-[#FFE600]', border:'border-black', shadow:true,
      icon: faPartyHorn, iconColor: '#000',
      hint:'All pages report suspension',
    };
    return {
      title:'Mixed',
      verdict:'Some pages suspended',
      chip:{label:'PARTIAL', style:'bg-orange-100 text-orange-800 border border-orange-200'},
      bg:'bg-[#FFF7ED]', border:'border-orange-200', shadow:false,
      icon: faCloudSunRain, iconColor: '#c2410c',
      hint:'Check each page — results differ',
    };
  };

  const handleAdd = async ()=>{
    if(!inputUrl.includes('facebook.com/')) { Alert.alert("Check the URL","Use a full Facebook link, e.g. facebook.com/YourPageName"); return; }
    setAdding(true); Keyboard.dismiss();
    try{
      let pid=inputUrl.split('facebook.com/')[1].split('/')[0].split('?')[0];
      if(pid==='profile.php') pid=new URLSearchParams(inputUrl.split('?')[1]).get('id')||'unknown';
      if(trackedPages.some(p=>p.id===pid)) { Alert.alert("Already tracked",`${pid} is already in your list`); setAdding(false); return; }
      const pfp = `https://graph.facebook.com/${encodeURIComponent(pid)}/picture?type=large&width=200&height=200`;
      const parentId = selectedParentId;
      await set(ref(getDatabase(app),`tracked_pages/${pid}`),{
        url:inputUrl,
        addedAt:new Date().toISOString(),
        pfp,
        parentId: parentId || null,
        type: parentId ? 'school' : 'lgu',
      });
      setInputUrl(''); setShowAdd(false); setSelectedParentId(null);
    }catch{ Alert.alert("Couldn’t add","Please try again."); }
    setAdding(false);
  };

  const handleRefresh=useCallback(async()=>{
    setRefreshing(true);
    try{
      const host=Platform.OS==='web'?'localhost':'10.0.2.2';
      const r=await fetch(`http://${host}:3000/api/refresh`,{method:'POST'});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||"Failed");
    }catch(e:any){ Alert.alert("Refresh failed",e.message); }
    setRefreshing(false); setLoading(false);
  },[]);

  const overall=getOverall();
  const lastChecked=trackedPages.length? trackedPages.reduce((a,b)=>(a.timestamp && b.timestamp && new Date(a.timestamp)>new Date(b.timestamp)?a:b)).timestamp : undefined;
  const lastAgo=lastChecked? timeAgo(lastChecked) : null;

  const getRow=(s?:string)=>{
    if(s==='Asynchronous') return {label:'No class', sub:'Async — stay home', chip:'bg-emerald-100 text-emerald-800 border-emerald-200', dot:'bg-emerald-500'};
    if(s==='Synchronous') return {label:'No class', sub:'Online — sync', chip:'bg-amber-100 text-amber-800 border-amber-200', dot:'bg-amber-500'};
    if(s==='Holiday') return {label:'Holiday', sub:'Public holiday — no class', chip:'bg-violet-100 text-violet-800 border-violet-200', dot:'bg-violet-400'};
    if(s==='No Announcement') return {label:'Regular class', sub:'No suspension posted', chip:'bg-zinc-100 text-zinc-700 border-zinc-200', dot:'bg-zinc-400'};
    if(s==='Scanning...') return {label:'Pending', sub:'No announcement yet', chip:'bg-white text-zinc-600 border-zinc-300', dot:'bg-zinc-300'};
    return {label:s||'—', sub:'—', chip:'bg-white text-zinc-600 border-zinc-200', dot:'bg-zinc-300'};
  };

  const strongShadow={boxShadow:'5px 5px 0px #000'} as any;

  return (
    <View className="flex-1 bg-[#F8F6F1]">
      {/* v2 black lockup — back, but no FAB collision and single time source */}
      <View className="bg-black pt-12 pb-3 px-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-[#FFE600] border-2 border-black rounded-xl items-center justify-center">
              <GraduationCap size={18} color="#000" strokeWidth={2.7} />
            </View>
            <View>
              <Text className="leading-none tracking-tighter">
                <Text className="text-white font-black text-[19px]">PASOK</Text>
                <Text className="text-[#FFE600] font-black text-[19px]">CHECK</Text>
              </Text>
              <Text className="text-zinc-400 font-semibold text-[10px] tracking-wide">Walang pasok radar</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-white font-bold text-xs">{now.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'})}</Text>
            <Text className="text-[#FFE600] font-bold text-[10px] tracking-widest">LIVE • {trackedPages.length} {trackedPages.length===1?'PAGE':'PAGES'}</Text>
          </View>
        </View>
      </View>
      {/* marquee — now single line, useful, not decorative */}
      <View className="bg-[#FFE600] border-y-2 border-black px-4 py-1.5">
        <Text className="text-black font-bold text-[11px] tracking-wide text-center" numberOfLines={1}>
          {lastAgo ? `Last checked ${lastAgo}` : 'Not checked yet'} • {trackedPages.length} pages • pull to refresh
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:32}} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000"/>}>
        {/* VERDICT — collapsed ~40%: single line title+chip, corner badge, compact stats */}
        <View className="px-4 pt-4">
          <View className={`rounded-2xl border-2 ${overall.border} ${overall.bg} p-4`} style={overall.shadow? strongShadow: undefined}>
            {/* top row: section label + freshness tied together */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-zinc-500 font-bold text-[10px] tracking-widest">TODAY'S VERDICT</Text>
              <View className="flex-row items-center gap-2">
                <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <Text className="text-zinc-600 text-[11px] font-medium">{lastAgo? `checked ${lastAgo}`: '—'}</Text>
                <View className="bg-emerald-500 rounded-full px-1.5 py-0.5">
                  <Text className="text-white font-black text-[9px] tracking-widest">LIVE</Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-3 items-start">
              <View className="flex-1">
                {/* merged line: verdict + chip inline, sentence case for body */}
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-zinc-900 font-black text-[20px] leading-6 tracking-tight">{overall.verdict}</Text>
                  {overall.chip && (() => {
                    const parts = overall.chip.style.split(' ');
                    const bg = parts.filter((c: string) => c.startsWith('bg-') || c.startsWith('border')).join(' ');
                    const tx = parts.filter((c: string) => c.startsWith('text-')).join(' ') || 'text-zinc-900';
                    return (
                      <View className={`px-2 py-0.5 rounded-full border ${bg}`}>
                        <Text className={`font-black text-[10px] tracking-wide ${tx}`}>{overall.chip.label}</Text>
                      </View>
                    );
                  })()}
                </View>
                <Text className="text-[#5A5A5A] text-[12px] leading-4 mt-1.5">{overall.hint}</Text>
              </View>
              {/* corner badge */}
              <View className="w-12 h-12 bg-white border-2 border-black rounded-xl items-center justify-center shrink-0">
                <FontAwesomeIcon icon={overall.icon} size={22} color={overall.iconColor} />
              </View>
            </View>
          </View>
        </View>

        {/* YOUR PAGES — Level 2: thin border, no shadow, 3 rows visible */}
        <View className="px-4 mt-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-zinc-900 font-black text-xs tracking-widest">YOUR PAGES</Text>
              <View className="bg-zinc-900 rounded-full px-2 py-0.5">
                <Text className="text-white font-bold text-[11px]">{String(trackedPages.length).padStart(2,'0')}</Text>
              </View>
            </View>
            <Text className="text-[#5A5A5A] text-[11px]">{trackedPages.length} tracked</Text>
          </View>

          {loading ? (
            <View className="bg-white rounded-2xl border border-zinc-200 p-6 items-center">
              <ActivityIndicator size="small" color="#000" />
              <Text className="text-[#5A5A5A] text-sm mt-2">Loading pages…</Text>
            </View>
          ) : trackedPages.length===0 ? (
            <View className="bg-white rounded-2xl border-2 border-dashed border-zinc-300 p-6 items-center">
              <View className="w-14 h-14 bg-[#FFF8B0] rounded-2xl border border-black items-center justify-center mb-3">
                <Text className="text-2xl">📄</Text>
              </View>
              <Text className="text-zinc-900 font-bold">No pages yet</Text>
              <Text className="text-[#5A5A5A] text-sm text-center mt-1">Track any Facebook page — school, LGU, or mayor.</Text>
              <TouchableOpacity onPress={()=>setShowAdd(true)} className="mt-4 bg-zinc-900 rounded-full px-5 py-2.5">
                <Text className="text-white font-bold text-sm">＋ Add your first page</Text>
              </TouchableOpacity>
              <Text className="text-zinc-400 text-xs mt-2">e.g. facebook.com/YourPageName</Text>
            </View>
          ) : (
            <View className="gap-3">
              {(() => {
                const topLevel = trackedPages.filter(p => !p.parentId);
                const orphans = trackedPages.filter(p => p.parentId && !trackedPages.some(par => par.id === p.parentId));
                const allGroups = [...topLevel, ...orphans];
                if (!allGroups.length) return null;
                return allGroups.map(parent => {
                  const children = trackedPages.filter(p => p.parentId === parent.id);
                  const parentEff = getEffectiveStatus(parent);
                  const parentRow = getRow(parentEff);
                  const parentInherited = parentEff !== parent.latestStatus;
                  const isLgu = children.length > 0 || parent.type === 'lgu';
                  return (
                    <View key={parent.id} className="gap-2">
                      <TouchableOpacity onPress={()=>router.push(`/page/${parent.id}`)} className={`bg-white rounded-xl border px-3 py-3 flex-row items-center gap-3 active:bg-zinc-50 ${isLgu ? 'border-zinc-900 border-2' : 'border-zinc-200'}`}>
                        <PageAvatar page={parent} size={36} />
                        <View className="flex-1 min-w-0">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-zinc-900 font-semibold text-[13px] flex-1" numberOfLines={1}>{parent.pageName || parent.id}</Text>
                            {isLgu && <View className="bg-[#FFE600] border border-black rounded-full px-1.5 py-0.5"><Text className="font-black text-[9px]">LGU • {children.length} {children.length===1?'school':'schools'}</Text></View>}
                          </View>
                          <View className="flex-row items-center gap-1.5 mt-0.5">
                            {(() => {
                              const parts = parentRow.chip.split(' ');
                              const bg = parts.filter((c: string) => c.startsWith('bg-') || c.startsWith('border')).join(' ');
                              const tx = parts.filter((c: string) => c.startsWith('text-')).join(' ') || 'text-zinc-700';
                              return (
                                <View className={`px-2 py-0.5 rounded-full border ${bg}`}>
                                  <Text className={`font-bold text-[10px] ${tx}`}>{parentRow.label}</Text>
                                </View>
                              );
                            })()}
                            <View className={`w-1.5 h-1.5 rounded-full ${parentRow.dot}`} />
                            <Text className="text-[#5A5A5A] text-[11px]" numberOfLines={1}>{parentRow.sub}</Text>
                          </View>
                          <Text className="text-zinc-400 text-[11px] mt-0.5">Checked {timeAgo(parent.timestamp)} • {parent.latestStatus}{parentInherited ? ` → ${parentEff} via parent` : ''}</Text>
                        </View>
                        <ChevronRight size={14} color="#a1a1aa" strokeWidth={2.2} />
                      </TouchableOpacity>

                      {children.length > 0 && (
                        <View className="ml-4 pl-3 border-l-2 border-dashed border-zinc-300 gap-2">
                          {children.map(child => {
                            const eff = getEffectiveStatus(child);
                            const r = getRow(eff);
                            const inherited = eff !== child.latestStatus;
                            const parentName = parent.pageName || parent.id;
                            return (
                              <TouchableOpacity key={child.id} onPress={()=>router.push(`/page/${child.id}`)} className="bg-white rounded-xl border border-zinc-200 px-3 py-2.5 flex-row items-center gap-3 active:bg-zinc-50">
                                <PageAvatar page={child} size={30} />
                                <View className="flex-1 min-w-0">
                                  <Text className="text-zinc-900 font-semibold text-[12px]" numberOfLines={1}>{child.pageName || child.id}</Text>
                                  <View className="flex-row items-center gap-1 mt-0.5">
                                    {(() => {
                                      const parts = r.chip.split(' ');
                                      const bg = parts.filter((c: string) => c.startsWith('bg-') || c.startsWith('border')).join(' ');
                                      const tx = parts.filter((c: string) => c.startsWith('text-')).join(' ') || 'text-zinc-700';
                                      return (
                                        <View className={`px-1.5 py-0.5 rounded-full border ${bg}`}>
                                          <Text className={`font-bold text-[9px] ${tx}`}>{r.label}</Text>
                                        </View>
                                      );
                                    })()}
                                    {inherited && <View className="bg-zinc-900 rounded-full px-1.5 py-0.5"><Text className="text-white font-bold text-[9px]">via {parentName.slice(0,12)}</Text></View>}
                                  </View>
                                  <Text className="text-zinc-400 text-[10px] mt-0.5">{inherited ? `Inherited: ${eff} • ` : ''}Checked {timeAgo(child.timestamp)} • {child.latestStatus}</Text>
                                </View>
                                <ChevronRight size={12} color="#a1a1aa" strokeWidth={2} />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                });
              })()}
              {/* standalone schools that are children of non-existent parents already handled as orphans above */}
            </View>
          )}
        </View>

        {/* ADD PAGE — now below list, Level 3: borderless subtle, not competing for yellow */}
        <View className="px-4 mt-4">
          {showAdd ? (
            <View className="bg-zinc-50 rounded-2xl border border-zinc-200 p-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-zinc-900 font-bold text-xs tracking-widest">ADD A PAGE</Text>
                <TouchableOpacity onPress={()=>{setShowAdd(false); setSelectedParentId(null);}}><Text className="text-zinc-500 font-bold text-xs">Close ✕</Text></TouchableOpacity>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 flex-row items-center bg-white border border-zinc-200 rounded-xl px-3" style={{height:44}}>
                  <Search size={14} color="#71717a" strokeWidth={2} />
                  <TextInput className="flex-1 ml-2 text-zinc-900 text-[13px]" placeholder="facebook.com/YourPageName" placeholderTextColor="#a1a1aa" value={inputUrl} onChangeText={setInputUrl} autoCapitalize="none" autoCorrect={false} autoFocus />
                </View>
                <TouchableOpacity onPress={handleAdd} disabled={adding} className={`h-11 px-4 rounded-xl border border-black items-center justify-center flex-row gap-1 ${adding?'bg-zinc-200':'bg-zinc-900'}`}>
                  {adding? <ActivityIndicator color="#fff" size="small"/> : <><Plus size={14} color="#fff" strokeWidth={3}/><Text className="text-white font-bold text-sm">Add</Text></>}
                </TouchableOpacity>
              </View>
              {trackedPages.filter(p=>!p.parentId).length > 0 && (
                <View className="mt-3">
                  <Text className="text-zinc-700 font-semibold text-xs mb-1.5">Part of LGU (optional) — LGU suspension will apply to this school</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8, paddingRight:12}}>
                    <TouchableOpacity onPress={()=>setSelectedParentId(null)} className={`px-3 py-2 rounded-full border ${!selectedParentId ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'}`}>
                      <Text className={`font-semibold text-xs ${!selectedParentId ? 'text-white' : 'text-zinc-700'}`}>Standalone</Text>
                    </TouchableOpacity>
                    {trackedPages.filter(p=>!p.parentId).map(p=>(
                      <TouchableOpacity key={p.id} onPress={()=>setSelectedParentId(p.id === selectedParentId ? null : p.id)} className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${selectedParentId===p.id ? 'bg-[#FFE600] border-black' : 'bg-white border-zinc-200'}`}>
                        <PageAvatar page={p} size={18} />
                        <Text className={`font-semibold text-xs max-w-[100px] ${selectedParentId===p.id ? 'text-black' : 'text-zinc-700'}`} numberOfLines={1}>{p.pageName || p.id}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Text className="text-zinc-400 text-[11px] mt-2">Paste any public Facebook page — we check it for class updates.</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={()=>setShowAdd(true)} className="border border-dashed border-zinc-300 rounded-2xl bg-zinc-50/70 py-3.5 items-center">
              <Text className="text-zinc-700 font-semibold text-sm">＋ Add a page</Text>
              <Text className="text-zinc-400 text-xs">School, LGU, or mayor</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications block temporarily removed */}

        {/* FOOTER */}
        <View className="px-4 mt-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-zinc-400 text-[11px]">Pull to refresh • Data from public Facebook pages</Text>
            <TouchableOpacity onPress={handleRefresh} className="flex-row items-center gap-1">
              <RefreshCw size={11} color="#71717a" strokeWidth={2} />
              <Text className="text-[#5A5A5A] font-semibold text-[11px]">Refresh now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
