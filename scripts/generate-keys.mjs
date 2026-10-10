import webpush from 'web-push';
import {randomBytes} from 'node:crypto';
const keys=webpush.generateVAPIDKeys();
console.log('新規生成した値をVercel環境変数に登録してください。Gitには保存しないでください。');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nCRON_SECRET=${randomBytes(32).toString('hex')}`);
