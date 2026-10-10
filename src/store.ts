import {useEffect,useRef,useState} from 'react';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type User} from 'firebase/auth';
import {getFirestore,collection,doc,onSnapshot,runTransaction} from 'firebase/firestore';
import {demoFarm,emptyFarm,type Farm,type Mutation} from './model';
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const configured=Object.values(config).every(Boolean);
const app=configured?initializeApp(config):null;
export const auth=app?getAuth(app):null;
const db=app?getFirestore(app):null;
export function useFarm() {
  const [user,setUser]=useState<User|null>(null),[demo,setDemo]=useState(false),[farm,setFarm]=useState<Farm>(emptyFarm),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const revisions=useRef<Record<string,number>>({});
  useEffect(()=>auth?onAuthStateChanged(auth,u=>{setUser(u);setReady(false);setFarm(emptyFarm());revisions.current={};}):undefined,[]);
  useEffect(()=>{
    if(demo||!user||!db)return;
    const seen=new Set<string>();
    return (()=>{const off=(['fields','crops','tasks','settings'] as const).map(name=>onSnapshot(collection(db,'users',user.uid,name),snapshot=>{
      const rows=snapshot.docs.map(d=>{const v=d.data();revisions.current[`${name}/${d.id}`]=v._rev||0;delete v._rev;return {...v,id:d.id}});
      setFarm(old=>({...old,[name]:name==='settings'?(rows[0]||old.settings):rows} as Farm));seen.add(name);if(seen.size===4)setReady(true);
    },()=>{setError('データを読み込めません。通信状況とFirebaseのアクセス設定を確認してください。');setReady(false);}));return ()=>off.forEach(f=>f());})();
  },[user,demo]);
  async function save(changes:Mutation[]) {
    if(!changes.length)return;
    setSaving(true);setError('');
    try {
      if(demo) {
        setFarm(old=>{
          const next=structuredClone(old);
          for(const m of changes){if(m.collection==='settings'){if(m.value)next.settings=m.value as Farm['settings'];continue;}
            const list=next[m.collection] as {id:string}[];const index=list.findIndex(v=>v.id===m.id);
            if(!m.value){if(index>=0)list.splice(index,1);}else if(index>=0)list[index]=m.value;else list.push(m.value);
          }return next;
        });return;
      }
      if(!user||!db||!ready)throw new Error('ログインと読み込み完了が必要です。');
      if(changes.length>450)throw new Error('一度に変更する件数が多いため、圃場を分けて登録してください。');
      const database=db;const account=user;
      const expected={...revisions.current};
      await runTransaction(database,async tx=>{
        const refs=changes.map(m=>doc(database,'users',account.uid,m.collection,m.id));
        const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
        for(let i=0;i<changes.length;i++) {
          const m=changes[i],revision=snapshots[i].data()?._rev||0;
          if(revision!==(expected[`${m.collection}/${m.id}`]||0))throw new Error('別の端末で変更されました。最新の内容を確認して、もう一度操作してください。');
          if(m.value)tx.set(refs[i],{...m.value,_rev:revision+1});else tx.delete(refs[i]);
        }
      });
    }catch(e){setError(e instanceof Error?e.message:'保存できませんでした。もう一度操作してください。');throw e;}
    finally{setSaving(false);}
  }
  return {farm,user,demo,ready,saving,error,setError,save,
    startDemo:()=>{setFarm(demoFarm());setDemo(true);setReady(true);setError('');},
    exitDemo:()=>{setDemo(false);setFarm(emptyFarm());setReady(false);},
    login:async()=>{if(!auth)return;try{await signInWithPopup(auth,new GoogleAuthProvider());}catch{setError('Googleログインを完了できませんでした。ポップアップを許可して再試行してください。');}},
    logout:async()=>{if(auth)await signOut(auth);setFarm(emptyFarm());setReady(false);}};
}
