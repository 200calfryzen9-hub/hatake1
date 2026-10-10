import {describe,it,expect} from 'vitest';
import {addDays,completeTask,copyTasks,createTasks,emptyFarm,isAvailable,occupancy,rescheduleTask,taskStage,type Crop,type Field} from '../src/model';
const field:Field={id:'f',district:'東地区',name:'5反',kind:'畑',area:'',active:true,note:''};
const crop=(name:Crop['name'],start='2026-03-10',end='2026-07-31'):Crop=>({id:'c',fieldId:'f',name,start,end,actualEnd:'',ended:false,note:'',startPrecision:'day',endPrecision:'month',afterCropId:''});
describe('栽培と作業の日付ルール',()=>{
  it('年をまたぐ日付を計算する',()=>expect(addDays('2026-12-25',14)).toBe('2027-01-08'));
  it('堆肥は省略可能で、耕起は個別の3回として登録する',()=>{
    const tasks=createTasks(crop('デントコーン'),{tillage:3,sow:'2026-03-10'});
    expect(tasks.filter(t=>t.name.startsWith('耕起'))).toHaveLength(3);
    expect(tasks.some(t=>t.name==='堆肥散布')).toBe(false);
    expect(tasks.find(t=>t.name==='耕起 3回目')).toMatchObject({start:'2026-03-07',end:'2026-03-09'});
  });
  it('鎮圧実績を基準に除草剤散布を設定する',()=>{
    const c=crop('デントコーン'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c,{sow:c.start})};
    const id=farm.tasks.find(t=>t.name==='鎮圧')!.id;
    expect(completeTask(farm,id,'2026-03-12').find(t=>t.name==='除草剤散布')).toMatchObject({start:'2026-03-12',end:'2026-03-26'});
  });
  it('稲作の耕起期限は田植え10日前と用水前の早い方',()=>{
    const c=crop('稲作','2026-06-20','2026-10-31');
    expect(createTasks(c,{sow:c.start,waterDeadline:'2026-06-04'})[0].end).toBe('2026-06-04');
  });
  it('同時散布ありなら後日の散布を追加しない',()=>{
    const c=crop('稲作'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c,{sow:c.start})};
    const planting=farm.tasks.find(t=>t.name==='田植え')!;
    expect(completeTask(farm,planting.id,c.start,'yes').some(t=>t.name==='除草剤散布')).toBe(false);
  });
  it('同時散布なしなら7〜20日後の別作業を追加し、重複しない',()=>{
    const c=crop('稲作'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c,{sow:c.start})};
    const id=farm.tasks.find(t=>t.name==='田植え')!.id;
    farm.tasks=completeTask(farm,id,'2026-06-10','no');
    expect(farm.tasks.find(t=>t.name==='除草剤散布')).toMatchObject({start:'2026-06-17',end:'2026-06-30'});
    expect(completeTask(farm,id,'2026-06-10','no').filter(t=>t.name==='除草剤散布')).toHaveLength(1);
  });
  it('収穫ごとに運搬を追加し、実施日から14日後を目安にする',()=>{
    const c=crop('イタリアン'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c)};
    const id=farm.tasks.find(t=>t.name==='収穫')!.id;
    farm.tasks=completeTask(farm,id,'2026-05-07');
    expect(farm.tasks.find(t=>t.name==='ロール運搬')).toMatchObject({end:'2026-05-21',deadlineKind:'guide'});
    expect(completeTask(farm,id,'2026-05-07').filter(t=>t.name==='ロール運搬')).toHaveLength(1);
  });
  it('播種延期時、未完了の鎮圧を連動し完了実績は維持する',()=>{
    const c=crop('デントコーン'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c,{sow:c.start,tillage:3})};
    farm.tasks[0].status='done';farm.tasks[0].actual='2026-03-01';
    const id=farm.tasks.find(t=>t.name==='播種')!.id;
    const revised=rescheduleTask(farm.tasks,id,'2026-03-15','2026-03-15');
    expect(revised.find(t=>t.name==='鎮圧')).toMatchObject({start:'2026-03-15',end:'2026-03-17'});
    expect(revised[0].actual).toBe('2026-03-01');
  });
  it('甘藷は作業を作らず、予定終了を過ぎても空き扱いにしない',()=>{
    const c=crop('甘藷','2026-03-01','2026-08-31');
    expect(createTasks(c)).toHaveLength(0);
    expect(occupancy(field,[c],'2026-09-10').kind).toBe('used');
    expect(isAvailable(field.id,[c],'2026-09-10','2026-09-10',true)).toBe(true);
    expect(isAvailable(field.id,[c],'2026-09-10','2026-09-10',false)).toBe(false);
  });
  it('使用終了を確認した圃場だけ現在の空きとして扱う',()=>{
    const c={...crop('甘藷'),ended:true,actualEnd:'2026-08-20'};
    expect(occupancy(field,[c],'2026-08-21').kind).toBe('free');
  });
  it('年をまたぐイタリアンの栽培を継続として表示する',()=>expect(occupancy(field,[crop('イタリアン','2026-11-01','2027-05-31')],'2027-01-01').kind).toBe('used'));
  it('未確定の作業は消さず、未定状態になる',()=>expect(taskStage(createTasks(crop('夏草'))[0],'2026-08-01')).toBe('undated'));
  it('計画コピーは工程と関連を維持し、実績を引き継がない',()=>{
    const source=crop('デントコーン'),target={...source,id:'new',start:'2027-03-10',end:'2027-07-31'};
    const farm={...emptyFarm(),crops:[source],tasks:createTasks(source,{sow:source.start,tillage:3})};
    farm.tasks[0].status='done';farm.tasks[0].actual='2026-03-01';
    const copied=copyTasks(farm,source,target);
    expect(copied[0]).toMatchObject({status:'pending',actual:'',cropId:'new'});
    const base=copied.find(t=>t.name==='播種')!,press=copied.find(t=>t.name==='鎮圧')!;
    expect(base.start).toBe('2027-03-10');expect(press.basisId).toBe(base.id);
  });
  it('収穫実施日の訂正で未完了の運搬目安を更新する',()=>{
    const c=crop('えん麦'),farm={...emptyFarm(),crops:[c],tasks:createTasks(c)};
    const id=farm.tasks.find(t=>t.name==='収穫')!.id;farm.tasks=completeTask(farm,id,'2026-12-10');
    expect(completeTask(farm,id,'2026-12-12').find(t=>t.name==='ロール運搬')?.end).toBe('2026-12-26');
  });
});
