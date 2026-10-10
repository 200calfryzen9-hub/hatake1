import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const output='test-results';fs.mkdirSync(output,{recursive:true});
try{
  for(const [label,width,height] of [['desktop',1440,1000],['iphone',390,844]]){
    const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'デモを試す'}).click();
    await page.getByRole('heading',{name:'今日の作業',exact:true}).waitFor();
    const nav=width<800?page.locator('.mobile-nav'):page.locator('.sidebar nav');
    await nav.getByRole('button',{name:'圃場一覧'}).click();await page.getByRole('button',{name:'圃場を追加',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByLabel('地区',{exact:true}).fill('テスト地区');await dialog.getByLabel('圃場の呼び名').fill('新しい畑');await dialog.getByRole('button',{name:'保存する'}).click();
    await page.getByRole('heading',{name:'新しい畑',exact:true}).waitFor();
    await nav.getByRole('button',{name:'栽培計画'}).click();await page.getByRole('button',{name:'栽培計画を追加'}).click();
    await dialog.getByLabel('作物').selectOption('夏草');await dialog.getByLabel('テスト地区の新しい畑',{exact:true}).check();
    const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
    await dialog.getByLabel('開始予定',{exact:true}).fill(now);await dialog.getByLabel('終了予定の精度').selectOption('day');await dialog.getByLabel('終了予定',{exact:true}).fill(now);await dialog.getByRole('button',{name:'保存する'}).click();
    await page.locator('.crop-plan-row').filter({hasText:'新しい畑'}).waitFor();
    await nav.getByRole('button',{name:'今日の作業'}).click();
    const harvest=page.locator('.task-row').filter({hasText:'新しい畑'}).filter({hasText:'収穫'});await harvest.getByRole('button',{name:'完了',exact:true}).click();await dialog.getByRole('button',{name:'完了を記録'}).click();
    await page.locator('.task-row').filter({hasText:'新しい畑'}).filter({hasText:'ロール運搬'}).waitFor();
    await page.screenshot({path:`${output}/${label}-today.png`,fullPage:true});
    await nav.getByRole('button',{name:'栽培計画'}).click();await page.screenshot({path:`${output}/${label}-plan.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Page overflow');assert.deepEqual(errors,[]);await page.close();
    console.log(`${label}: field creation, crop creation, harvest, automatic transport, layout passed`);
  }
}finally{await browser.close()}
