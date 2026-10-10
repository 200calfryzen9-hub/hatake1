import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Farm} from '../src/model';
export type Request=IncomingMessage&{body?:unknown;query?:Record<string,string>};
export function database(){if(!getApps().length){const {FIREBASE_PROJECT_ID:projectId,FIREBASE_CLIENT_EMAIL:clientEmail,FIREBASE_PRIVATE_KEY:privateKey}=process.env;if(!projectId||!clientEmail||!privateKey)throw new Error('Firebaseサーバー設定が未完了です');initializeApp({credential:cert({projectId,clientEmail,privateKey:privateKey.replace(/\\n/g,'\n')})});}return getFirestore();}
export function respond(res:ServerResponse,status:number,body:unknown){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.statusCode=status;res.end(JSON.stringify(body));}
export async function authorize(req:Request){database();const header=req.headers.authorization||'';if(!header.startsWith('Bearer '))throw new Error('unauthorized');let token;try{token=await getAuth().verifyIdToken(header.slice(7),true)}catch{throw new Error('unauthorized')};if(!token.email_verified||!process.env.OWNER_EMAIL||token.email?.toLowerCase()!==process.env.OWNER_EMAIL.toLowerCase())throw new Error('unauthorized');return token;}
export async function readFarm(uid:string):Promise<Farm>{const db=database();const read=async(name:string)=>(await db.collection(`users/${uid}/${name}`).get()).docs.map(d=>{const data=d.data();delete data._rev;return {...data,id:d.id}});const [fields,crops,tasks,settings]=await Promise.all(['fields','crops','tasks','settings'].map(read));return {fields,crops,tasks,settings:settings[0]||{id:'main',waterDeadline:'',noticeDays:3}} as Farm;}
