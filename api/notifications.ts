import {createHash} from 'node:crypto';
import {authorize,database,respond,type Request} from '../server/server';
import type {ServerResponse} from 'node:http';
export default async function handler(req:Request,res:ServerResponse){
  if(req.method!=='POST'){respond(res,405,{error:'Method not allowed'});return;}
  try{
    const token=await authorize(req),db=database(),ref=db.doc(`notifications/${token.uid}`);
    const body=req.body as {action?:string;subscription?:{endpoint?:string;keys?:{p256dh?:string;auth?:string}};endpoint?:string};
    if(!body||!['status','email-on','email-off','push-on','push-off'].includes(body.action||'')){respond(res,400,{error:'操作が正しくありません'});return;}
    if(body.action==='email-on'){
      if(!process.env.GMAIL_USER||!process.env.GMAIL_APP_PASSWORD){respond(res,503,{error:'メール送信のサーバー設定が必要です'});return}
      await ref.set({email:token.email,emailEnabled:true},{merge:true});
    }
    if(body.action==='email-off')await ref.set({emailEnabled:false},{merge:true});
    if(body.action==='push-on'){
      if(!process.env.VAPID_PRIVATE_KEY){respond(res,503,{error:'プッシュ通知のサーバー設定が必要です'});return}
      const sub=body.subscription;if(!sub?.endpoint||!sub.keys?.auth||!sub.keys.p256dh){respond(res,400,{error:'通知登録情報が不足しています'});return}
      const url=new URL(sub.endpoint);
      // Prevent the delivery endpoint from becoming an arbitrary server request.
      if(url.protocol!=='https:'||url.port||url.username||url.password||!['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(url.hostname)){respond(res,400,{error:'対応する通知サービスではありません'});return}
      if(sub.endpoint.length>2048||sub.keys.auth.length>100||sub.keys.p256dh.length>200){respond(res,400,{error:'通知情報が正しくありません'});return}
      const id=createHash('sha256').update(sub.endpoint).digest('hex');
      const existing=await ref.collection('subscriptions').get();if(existing.size>=10&&!existing.docs.some(d=>d.id===id)){respond(res,400,{error:'通知端末は10台までです'});return}
      await ref.collection('subscriptions').doc(id).set({endpoint:sub.endpoint,keys:sub.keys});
      await ref.set({email:token.email},{merge:true});
    }
    if(body.action==='push-off'&&body.endpoint)await ref.collection('subscriptions').doc(createHash('sha256').update(body.endpoint).digest('hex')).delete();
    const data=(await ref.get()).data(),subs=await ref.collection('subscriptions').get();respond(res,200,{emailEnabled:data?.emailEnabled||false,pushCount:subs.size});
  }catch(e){respond(res,e instanceof Error&&e.message==='unauthorized'?401:500,{error:e instanceof Error&&e.message==='unauthorized'?'ログインが必要です':'通知設定を保存できません。サーバー設定を確認してください。'});}
}
