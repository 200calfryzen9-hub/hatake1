import {timingSafeEqual} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import type {ServerResponse} from 'node:http';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import {database,readFarm,respond,type Request} from '../server/server';
import {createBackup} from '../server/backup';
import {fieldLabel,taskStage,today} from '../src/model';
export const config={maxDuration:60};
export default async function handler(req:Request,res:ServerResponse){
  const expected=`Bearer ${process.env.CRON_SECRET||''}`,received=req.headers.authorization||'';
  if(req.method!=='GET'||!process.env.CRON_SECRET||expected.length!==received.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(received))){respond(res,401,{error:'Unauthorized'});return}
  let release:(()=>Promise<void>)|undefined;
  try{
    const db=database();if(!process.env.OWNER_EMAIL)throw new Error('Owner missing');
    const owner=await getAuth().getUserByEmail(process.env.OWNER_EMAIL),date=today(),farm=await readFarm(owner.uid);
    const lease=db.doc(`cronLocks/${owner.uid}`),now=Date.now();
    const acquired=await db.runTransaction(async tx=>{const existing=await tx.get(lease);if((existing.data()?.until||0)>now)return false;tx.set(lease,{until:now+120000});return true});
    if(!acquired){respond(res,409,{error:'Already running'});return}
    release=async()=>{await lease.set({until:0})};
    await createBackup(owner.uid,date,farm);
    const pending=farm.tasks.filter(t=>t.status==='pending'&&(['ready','overdue','soon'].includes(taskStage(t,date,farm.settings.noticeDays))||t.name==='ロール運搬'));
    const unconfirmed=farm.tasks.filter(t=>t.name==='田植え'&&t.status==='done'&&t.simultaneous==='unknown');
    const currentYear=date.slice(0,4);
    const reminders:string[]=[];
    if(date>=`${currentYear}-09-18`&&date<=`${currentYear}-11-10`)reminders.push('イタリアンの優先播種期間（9月末〜11月初頭）を確認してください。');
    if(farm.settings.waterDeadline&&date>=new Date(Date.parse(farm.settings.waterDeadline+'T00:00:00Z')-7*86400000).toISOString().slice(0,10)&&date<=farm.settings.waterDeadline)reminders.push(`稲作の耕起最終日：${farm.settings.waterDeadline}`);
    const lines=pending.map(t=>`${fieldLabel(farm.fields.find(f=>f.id===t.fieldId))}：${t.name}${t.end?`（${t.deadlineKind==='guide'?'目安':'期限'} ${t.end}）`:''}`);
    const body=[`${date}の作業確認`,...lines,...(unconfirmed.length?[`田植え時の除草剤同時散布が未確認：${unconfirmed.length}圃場`]:[]),...reminders].join('\n');
    if(!pending.length&&!unconfirmed.length&&!reminders.length){respond(res,200,{backup:true,sent:0});return}
    const ref=db.doc(`notifications/${owner.uid}`),settings=(await ref.get()).data()||{};
    const log=db.doc(`deliveries/${owner.uid}/days/${date}`);const logData=(await log.get()).data()||{};
    let sent=0;const failures:string[]=[];
    if(settings.emailEnabled&&!logData.emailSent){
      if(!process.env.GMAIL_USER||!process.env.GMAIL_APP_PASSWORD)failures.push('email configuration');
      else try{const transport=nodemailer.createTransport({service:'gmail',auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}});await transport.sendMail({from:process.env.GMAIL_USER,to:owner.email,subject:`畑しごと｜${date} 作業${pending.length}件`,text:body});await log.set({emailSent:true},{merge:true});sent++;}catch{failures.push('email delivery')}
    }
    const subs=await ref.collection('subscriptions').get();
    if(subs.size&&(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT))failures.push('push configuration');
    else if(subs.size){
      webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
      for(const sub of subs.docs){if(logData[`push_${sub.id}`])continue;try{await webpush.sendNotification(sub.data() as webpush.PushSubscription,JSON.stringify({title:`畑しごと｜未完了の作業${pending.length}件`,body:body.slice(0,700),url:'/'}));await log.set({[`push_${sub.id}`]:true},{merge:true});sent++;}catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await sub.ref.delete();else failures.push('push delivery');}}
    }
    respond(res,failures.length?500:200,{backup:true,sent,failures});
  }catch{respond(res,500,{error:'定期実行に失敗しました。Firebaseと通知設定を確認してください。'});}
  finally{if(release)await release().catch(()=>{});}
}
