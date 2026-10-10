import fs from 'node:fs';
import {cert,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const [file,uid,confirm]=process.argv.slice(2);
if(!file||!uid||confirm!=='--replace-current-data')throw new Error('Usage: node scripts/restore-backup.mjs <backup.json> <owner-uid> --replace-current-data');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
if(data.version!==1||!data.farm||!['fields','crops','tasks'].every(k=>Array.isArray(data.farm[k])))throw new Error('Invalid backup');
initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')})});
const owner=await getAuth().getUser(uid);
if(!process.env.OWNER_EMAIL||owner.email?.toLowerCase()!==process.env.OWNER_EMAIL.toLowerCase())throw new Error('Owner mismatch');
const db=getFirestore(),writes=[];
for(const name of ['fields','crops','tasks','settings']){
  const items=name==='settings'?[data.farm.settings]:data.farm[name];
  for(const item of items)if(!item?.id||item.id.includes('/')||typeof item.id!=='string')throw new Error('Invalid document ID');
  const ids=new Set(items.map(v=>v.id));
  const existing=await db.collection(`users/${uid}/${name}`).get();
  for(const d of existing.docs)if(!ids.has(d.id))writes.push({ref:d.ref,value:null});
  for(const item of items){const doc=existing.docs.find(d=>d.id===item.id);writes.push({ref:db.doc(`users/${uid}/${name}/${item.id}`),value:{...item,_rev:(doc?.data()._rev||0)+1}});}
}
for(let i=0;i<writes.length;i+=400){const batch=db.batch();for(const w of writes.slice(i,i+400))if(w.value)batch.set(w.ref,w.value);else batch.delete(w.ref);await batch.commit();}
console.log('Restored. Reopen the app on all devices.');
