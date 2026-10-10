export const CROP_NAMES = ['稲作','甘藷','デントコーン','えん麦','イタリアン','夏草'] as const;
export type CropName = typeof CROP_NAMES[number];
export interface Field {id:string;district:string;name:string;kind:'畑'|'田んぼ';area:string;active:boolean;note:string}
export interface Crop {id:string;fieldId:string;name:CropName;start:string;end:string;actualEnd:string;ended:boolean;note:string;startPrecision:'day'|'month'|'period';endPrecision:'day'|'month'|'period';afterCropId:string}
export interface Task {id:string;cropId:string;fieldId:string;name:string;start:string;end:string;status:'pending'|'done'|'cancelled';actual:string;note:string;basisId:string;offsetStart:number;offsetEnd:number;deadlineKind:'deadline'|'guide';simultaneous:'yes'|'no'|'unknown';history:{from:string;to:string;at:string}[]}
export interface Settings {id:string;waterDeadline:string;noticeDays:number}
export interface Farm {fields:Field[];crops:Crop[];tasks:Task[];settings:Settings}
export type Mutation = {collection:'fields'|'crops'|'tasks'|'settings';id:string;value:Field|Crop|Task|Settings|null};
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function addDays(date:string,n:number) {if(!date)return '';const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const uid=()=>crypto.randomUUID();
export const fieldLabel=(f:Field|undefined)=>f?`${f.district}の${f.name}`:'圃場未登録';
export const emptyFarm=():Farm=>({fields:[],crops:[],tasks:[],settings:{id:'main',waterDeadline:`${today().slice(0,4)}-06-04`,noticeDays:3}});
export function taskStage(t:Task,date=today(),noticeDays=3) {
  if(t.status!=='pending')return t.status;
  if(!t.start&&!t.end)return 'undated';
  if(t.end&&t.end<date)return 'overdue';
  if(t.start&&t.start>date)return t.start<=addDays(date,noticeDays)?'soon':'future';
  return 'ready';
}
export function occupancy(f:Field,crops:Crop[],date=today()) {
  const list=crops.filter(c=>c.fieldId===f.id);
  const current=list.find(c=>!c.ended&&(!c.start||c.start<=date)&&(!c.afterCropId||crops.find(prev=>prev.id===c.afterCropId)?.ended));
  if(current)return {label:current.name==='甘藷'?'甘藷で使用中':`${current.name} 栽培中`,crop:current,kind:'used'};
  const next=list.filter(c=>!c.ended&&c.start>date).sort((a,b)=>a.start.localeCompare(b.start))[0];
  return {label:next?'空き・次作予定あり':'空き',crop:next,kind:'free'};
}
export function isAvailable(fieldId:string,crops:Crop[],from:string,to:string,forecast:boolean) {
  return !crops.some(c=>{
    if(c.fieldId!==fieldId)return false;
    const end=c.ended?c.actualEnd:(forecast?c.end:'');
    return (!c.start||c.start<=to)&&(!end||end>=from);
  });
}
export function createTasks(c:Crop,{compost=false,tillage=1,sow='',waterDeadline=''}:{compost?:boolean;tillage?:number;sow?:string;waterDeadline?:string}={}):Task[] {
  if(c.name==='甘藷')return [];
  const result:Task[]=[];
  const make=(name:string,start='',end=start,kind:'deadline'|'guide'='deadline')=>{
    const t:Task={id:uid(),cropId:c.id,fieldId:c.fieldId,name,start,end,status:'pending',actual:'',note:'',basisId:'',offsetStart:0,offsetEnd:0,deadlineKind:kind,simultaneous:'unknown',history:[]};result.push(t);return t;
  };
  const link=(t:Task,base:Task,a:number,b:number)=>{t.basisId=base.id;t.offsetStart=a;t.offsetEnd=b;};
  if(compost&&c.name==='デントコーン')make('堆肥散布');
  for(let i=0;i<tillage;i++) {
    let end='';let start='';
    if(i===tillage-1&&sow) {
      if(c.name==='稲作'){end=[addDays(sow,-10),waterDeadline||`${sow.slice(0,4)}-06-04`].sort()[0];start=end;}
      else if(c.name==='デントコーン'){start=addDays(sow,-3);end=addDays(sow,-1);}
    }
    make(`耕起 ${i+1}回目`,start,end);
  }
  if(c.name==='稲作') {
    const puddle=make('代かき',addDays(sow,-2));
    const planting=make('田植え',sow);link(puddle,planting,-2,-2);
    make('殺虫剤散布');
    make('稲刈り',c.endPrecision==='day'?c.end:c.end?c.end.slice(0,7)+'-01':'',c.end,'guide');
  }else {
    const planting=make('播種',sow);
    const press=make('鎮圧',sow,addDays(sow,c.name==='デントコーン'?2:30),'guide');link(press,planting,0,c.name==='デントコーン'?2:30);
    if(c.name==='デントコーン'){const herb=make('除草剤散布');link(herb,press,0,14);}
    make('収穫',c.endPrecision==='day'?c.end:c.end?c.end.slice(0,7)+'-01':'',c.end,'guide');
  }
  return result;
}
export function completeTask(farm:Farm,id:string,actual:string,simultaneous:Task['simultaneous']='unknown'):Task[] {
  const tasks=farm.tasks.map(t=>({...t}));const target=tasks.find(t=>t.id===id);
  if(!target)return tasks;
  target.status='done';target.actual=actual;if(target.name==='田植え')target.simultaneous=simultaneous;
  for(const t of tasks)if(t.basisId===id&&t.status==='pending'){t.start=addDays(actual,t.offsetStart);t.end=addDays(actual,t.offsetEnd);}
  const c=farm.crops.find(c=>c.id===target.cropId);
  const generated=(name:string,start:string,end:string):Task=>({...target,id:uid(),name,start,end,status:'pending',actual:'',note:'',basisId:id,offsetStart:0,offsetEnd:14,deadlineKind:'guide',simultaneous:'unknown',history:[]});
  if(target.name==='田植え') {
    const existing=tasks.find(t=>t.basisId===id&&t.name==='除草剤散布');
    if(simultaneous==='no'){
      if(existing&&existing.status!=='done'){existing.status='pending';existing.start=addDays(actual,7);existing.end=addDays(actual,20);}
      else if(!existing){const t=generated('除草剤散布',addDays(actual,7),addDays(actual,20));t.offsetStart=7;t.offsetEnd=20;t.deadlineKind='deadline';tasks.push(t);}
    }else if(existing&&existing.status==='pending')existing.status='cancelled';
  }
  if(target.name==='収穫'&&c&&['えん麦','イタリアン','夏草'].includes(c.name)&&!tasks.some(t=>t.basisId===id&&t.name==='ロール運搬'))tasks.push(generated('ロール運搬',actual,addDays(actual,14)));
  return tasks;
}
export function rescheduleTask(tasks:Task[],id:string,start:string,end:string) {
  const old=tasks.find(t=>t.id===id);if(!old)return tasks;
  const delta=old.start&&start?Math.round((Date.parse(start)-Date.parse(old.start))/86400000):0;
  return tasks.map(t=>{
    if(t.id===id)return {...t,start,end,history:[...t.history,{from:`${t.start}〜${t.end}`,to:`${start}〜${end}`,at:new Date().toISOString()}]};
    if(t.status==='pending'&&t.basisId===id&&(t.name==='代かき'||t.name==='鎮圧'))return {...t,start:addDays(start,t.offsetStart),end:addDays(start,t.offsetEnd)};
    if(t.status==='pending'&&t.cropId===old.cropId&&t.name.startsWith('耕起')&&t.start&&delta&&old.name==='播種')return {...t,start:addDays(t.start,delta),end:addDays(t.end,delta)};
    return t;
  });
}
export function copyTasks(farm:Farm,source:Crop,target:Crop):Task[]{
  const originals=farm.tasks.filter(t=>t.cropId===source.id&&t.status!=='cancelled'&&t.name!=='ロール運搬'&&!(t.name==='除草剤散布'&&source.name==='稲作'));
  const ids=new Map(originals.map(t=>[t.id,uid()]));
  const delta=source.start&&target.start?Math.round((Date.parse(target.start)-Date.parse(source.start))/86400000):0;
  return originals.map(t=>({...t,id:ids.get(t.id)!,cropId:target.id,fieldId:target.fieldId,start:t.start?addDays(t.start,delta):'',end:t.end?addDays(t.end,delta):'',status:'pending',actual:'',note:'',history:[],simultaneous:'unknown',basisId:ids.get(t.basisId)||''}));
}
export function demoFarm():Farm {
  const f=emptyFarm();
  f.fields=[{id:'demo-a',district:'東地区',name:'5反',kind:'畑',area:'',active:true,note:''},{id:'demo-b',district:'東地区',name:'集会所の前',kind:'田んぼ',area:'',active:true,note:''},{id:'demo-c',district:'西地区',name:'川沿い',kind:'畑',area:'',active:true,note:''}];
  const now=today();
  f.crops=[{id:'demo-crop',fieldId:'demo-a',name:'イタリアン',start:now,end:`${Number(now.slice(0,4))+1}-05-31`,actualEnd:'',ended:false,note:'画面確認用のサンプルです',startPrecision:'day',endPrecision:'month',afterCropId:''}];
  f.tasks=createTasks(f.crops[0],{sow:now,tillage:2});
  return f;
}
