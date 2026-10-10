import {it,expect} from 'vitest';
import cron from '../api/cron';
import notifications from '../api/notifications';
import backup from '../api/backup';
import type {Request} from '../server/server';
import type {ServerResponse} from 'node:http';
function response(){const result={statusCode:0,body:'',setHeader(){},end(v:string){this.body=v}};return result as typeof result&ServerResponse}
it('Cronは秘密鍵のないリクエストを拒否する',async()=>{const res=response();await cron({method:'GET',headers:{}} as Request,res);expect(res.statusCode).toBe(401);expect(JSON.parse(res.body)).toEqual({error:'Unauthorized'})});
it('CronはPOSTリクエストを拒否する',async()=>{const res=response();await cron({method:'POST',headers:{}} as Request,res);expect(res.statusCode).toBe(401)});
it('通知設定はGETで変更できない',async()=>{const res=response();await notifications({method:'GET',headers:{}} as Request,res);expect(res.statusCode).toBe(405)});
it('バックアップはPOSTで取得できない',async()=>{const res=response();await backup({method:'POST',headers:{}} as Request,res);expect(res.statusCode).toBe(405)});
