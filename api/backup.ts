import type {ServerResponse} from 'node:http';
import {authorize,respond,type Request} from '../server/server';
import {latestBackup} from '../server/backup';
export default async function handler(req:Request,res:ServerResponse){if(req.method!=='GET'){respond(res,405,{error:'Method not allowed'});return}try{const token=await authorize(req),backup=await latestBackup(token.uid);respond(res,backup?200:404,backup||{error:'自動バックアップはまだありません。初回の定期実行後に作成されます。'});}catch(e){respond(res,e instanceof Error&&e.message==='unauthorized'?401:500,{error:'バックアップを取得できません'});}}
