self.addEventListener('push', event => {
  let data = {title:'畑しごと',body:'作業予定を確認してください',url:'/'};
  try { data = {...data,...event.data.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'daily-work',data:{url:'/'}}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows => {
    for (const win of windows) if(new URL(win.url).origin===self.location.origin) {await win.focus();return;}
    await clients.openWindow('/');
  }));
});
