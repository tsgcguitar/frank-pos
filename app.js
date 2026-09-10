const DATA = window.POS_DATA;
const allOrders = DATA.orders;
const allItems = DATA.items;
const capacities = DATA.metadata.tableCapacity;
const charts = {};

Chart.defaults.font.family = 'Inter, "Noto Sans TC", "Microsoft JhengHei", sans-serif';
Chart.defaults.color = '#65788d';
Chart.defaults.borderColor = '#e7edf4';

const $ = (id) => document.getElementById(id);
const fmtMoney = n => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
const fmtNum = n => Math.round(Number(n || 0)).toLocaleString('en-US');
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const sum = arr => arr.reduce((a,b)=>a+Number(b||0),0);
const unique = arr => [...new Set(arr)];
const groupBy = (arr, fn) => arr.reduce((m,x)=>{const k=fn(x);(m[k]??=[]).push(x);return m;},{});

function safeDate(s){ return new Date(String(s).replace(' ','T')); }
function activeDayCount(orders){
  const days = unique(orders.filter(o=>o.Status==='完成').map(o=>o.Business_Date));
  return Math.max(days.length, 1);
}
function isMember(o){ return !!o.Member_ID; }

function initFilters(){
  unique(allOrders.map(o=>o.Store_Name)).sort().forEach(s=>{
    $('storeFilter').insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`);
  });
  $('sideOrders').textContent = allOrders.length.toLocaleString();
  $('sideItems').textContent = allItems.length.toLocaleString();

  ['dateFrom','dateTo','storeFilter','orderTypeFilter','memberFilter'].forEach(id=>{
    $(id).addEventListener('change', renderAll);
  });
  $('resetFilters').addEventListener('click', ()=>{
    $('dateFrom').value='2026-08-01'; $('dateTo').value='2026-08-31';
    $('storeFilter').value='ALL'; $('orderTypeFilter').value='ALL'; $('memberFilter').value='ALL';
    renderAll();
  });
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active'); $(btn.dataset.view).classList.add('active');
    setTimeout(()=>Object.values(charts).forEach(c=>c?.resize()),50);
  }));
}

function getFiltered(){
  const from=$('dateFrom').value, to=$('dateTo').value, store=$('storeFilter').value, type=$('orderTypeFilter').value, member=$('memberFilter').value;
  const orders=allOrders.filter(o=>{
    if(o.Business_Date<from || o.Business_Date>to) return false;
    if(store!=='ALL' && o.Store_Name!==store) return false;
    if(type!=='ALL' && o.Order_Type!==type) return false;
    if(member==='MEMBER' && !isMember(o)) return false;
    if(member==='NON_MEMBER' && isMember(o)) return false;
    return true;
  });
  const ids = new Set(orders.map(o=>o.Transaction_ID));
  const items=allItems.filter(i=>ids.has(i.Transaction_ID));
  return {orders,items};
}

function completed(orders){return orders.filter(o=>o.Status==='完成');}
function completedItems(items){return items.filter(i=>i.Status==='完成');}
function getKpis(orders){
  const c=completed(orders), dine=c.filter(o=>o.Order_Type==='內用');
  const revenue=sum(c.map(o=>o.Final_Total));
  const guests=sum(c.map(o=>o.Guest_Count));
  const dining=avg(dine.map(o=>Number(o.Dining_Minutes||0)));
  const days=activeDayCount(c);
  let turn=0;
  if(dine.length){
    const byStore=groupBy(dine,o=>o.Store_Name);
    const perStore=Object.entries(byStore).map(([s,rows])=>rows.length/(capacities[s]||1)/Math.max(unique(rows.map(r=>r.Business_Date)).length,1));
    turn=avg(perStore);
  }
  return {revenue,guests,avgSpend:guests?revenue/guests:0,dining,turn,orders:c.length,days};
}

function setChart(id,config){
  if(charts[id]) charts[id].destroy();
  charts[id]=new Chart($(id),config);
}
function baseOptions(extra={}){
  return {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#edf1f5'}}},...extra};
}
function palette(n){const p=['#2f6feb','#22a06b','#7556e8','#f59e0b','#e15b64','#56b4e9','#3ba6a0','#9a6dd7','#f28e5b','#6b86a5'];return Array.from({length:n},(_,i)=>p[i%p.length]);}

function renderOverview(orders){
  const k=getKpis(orders);
  $('kpiRevenue').textContent=fmtMoney(k.revenue);
  $('kpiGuests').textContent=fmtNum(k.guests);
  $('kpiAvgSpend').textContent=fmtMoney(k.avgSpend);
  $('kpiTurnover').textContent=k.turn.toFixed(2)+' 次';
  $('kpiDining').textContent=Math.round(k.dining)+' min';

  const c=completed(orders);
  const byDate=groupBy(c,o=>o.Business_Date);
  const dates=Object.keys(byDate).sort();
  setChart('revenueTrendChart',{type:'line',data:{labels:dates.map(d=>d.slice(5)),datasets:[{label:'Revenue',data:dates.map(d=>sum(byDate[d].map(x=>x.Final_Total))),borderColor:'#2f6feb',backgroundColor:'rgba(47,111,235,.10)',fill:true,tension:.35,pointRadius:2}]},options:baseOptions()});

  const byHour=groupBy(c,o=>String(safeDate(o.Open_Time).getHours()).padStart(2,'0')+':00');
  const hours=Object.keys(byHour).sort();
  setChart('hourlyRevenueChart',{type:'bar',data:{labels:hours,datasets:[{data:hours.map(h=>sum(byHour[h].map(x=>x.Final_Total))),backgroundColor:hours.map((h,i)=>i===hours.reduce((mi,x,j,a)=>sum(byHour[x].map(r=>r.Final_Total))>sum(byHour[a[mi]].map(r=>r.Final_Total))?j:mi,0)?'#f59e0b':'#6fa6f7'),borderRadius:6}]},options:baseOptions()});

  const channels=groupBy(c,o=>o.Order_Channel||'其他');
  const channelKeys=Object.keys(channels).sort((a,b)=>channels[b].length-channels[a].length);
  setChart('channelChart',{type:'doughnut',data:{labels:channelKeys,datasets:[{data:channelKeys.map(k=>channels[k].length),backgroundColor:palette(channelKeys.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true}}}}});

  const pays=groupBy(c,o=>o.Payment_Method||'其他');
  const payKeys=Object.keys(pays).sort((a,b)=>pays[b].length-pays[a].length);
  setChart('paymentChart',{type:'bar',data:{labels:payKeys,datasets:[{data:payKeys.map(k=>pays[k].length),backgroundColor:'#7556e8',borderRadius:6}]},options:{...baseOptions(),indexAxis:'y'}});

  const dine=c.filter(o=>o.Order_Type==='內用');
  const storeDining=Object.entries(groupBy(dine,o=>o.Store_Name)).map(([s,r])=>[s,avg(r.map(x=>Number(x.Dining_Minutes||0)))]);
  storeDining.sort((a,b)=>b[1]-a[1]);
  const peakHour=hours.length?hours.reduce((best,h)=>sum(byHour[h].map(x=>x.Final_Total))>sum(byHour[best].map(x=>x.Final_Total))?h:best,hours[0]):'—';
  const memberRev=sum(c.filter(isMember).map(o=>o.Final_Total));
  const memberShare=k.revenue?memberRev/k.revenue*100:0;
  $('overviewInsights').innerHTML=`
    <div class="insight-item"><strong>尖峰營收時段：${peakHour}</strong><span>可進一步對照排班、出餐與外送量。</span></div>
    <div class="insight-item"><strong>${storeDining[0]?.[0]||'—'} 用餐時間最長</strong><span>平均 ${Math.round(storeDining[0]?.[1]||0)} 分鐘，適合進一步做 Root Cause Analysis。</span></div>
    <div class="insight-item"><strong>會員營收占比 ${memberShare.toFixed(1)}%</strong><span>可觀察會員是否帶來更高的消費與回購。</span></div>`;
}

function storeMetrics(orders){
  const c=completed(orders), by=groupBy(c,o=>o.Store_Name);
  return Object.entries(by).map(([s,r])=>{
    const dine=r.filter(o=>o.Order_Type==='內用'), guests=sum(r.map(o=>o.Guest_Count)), revenue=sum(r.map(o=>o.Final_Total));
    const days=Math.max(unique(r.map(o=>o.Business_Date)).length,1);
    return {store:s,revenue,guests,avgSpend:guests?revenue/guests:0,dineOrders:dine.length,turn:dine.length/(capacities[s]||1)/days,dining:avg(dine.map(o=>Number(o.Dining_Minutes||0)))};
  }).sort((a,b)=>b.revenue-a.revenue);
}
function renderStore(orders){
  const m=storeMetrics(orders);
  setChart('storeRevenueChart',{type:'bar',data:{labels:m.map(x=>x.store),datasets:[{data:m.map(x=>x.revenue),backgroundColor:palette(m.length),borderRadius:7}]},options:baseOptions()});
  setChart('storeDiningChart',{type:'bar',data:{labels:m.map(x=>x.store),datasets:[{data:m.map(x=>x.dining),backgroundColor:m.map(x=>x.dining===Math.max(...m.map(y=>y.dining))?'#e15b64':'#6fa6f7'),borderRadius:7}]},options:baseOptions()});
  $('storeTableBody').innerHTML=m.map((x,i)=>`<tr>
    <td><strong>${x.store}</strong></td><td>${fmtMoney(x.revenue)}</td><td>${fmtNum(x.guests)}</td><td>${fmtMoney(x.avgSpend)}</td>
    <td>${fmtNum(x.dineOrders)}</td><td>${x.turn.toFixed(2)} 次</td><td class="${i===0&&x.dining===Math.max(...m.map(y=>y.dining))?'metric-bad':''}">${Math.round(x.dining)} min</td></tr>`).join('');
}

function renderCustomer(orders){
  const c=completed(orders), mem=c.filter(isMember), non=c.filter(o=>!isMember(o));
  const vals=[sum(mem.map(o=>o.Final_Total)),sum(non.map(o=>o.Final_Total))];
  setChart('memberRevenueChart',{type:'doughnut',data:{labels:['會員','非會員'],datasets:[{data:vals,backgroundColor:['#2f6feb','#d9e3f0'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom'}}}});

  const levels=groupBy(c,o=>o.Member_Level||'非會員');
  const levelKeys=Object.keys(levels).sort((a,b)=>sum(levels[b].map(x=>x.Final_Total))-sum(levels[a].map(x=>x.Final_Total)));
  setChart('memberLevelChart',{type:'bar',data:{labels:levelKeys,datasets:[{data:levelKeys.map(k=>sum(levels[k].map(x=>x.Final_Total))),backgroundColor:palette(levelKeys.length),borderRadius:6}]},options:{...baseOptions(),indexAxis:'y'}});

  const memberGuests=sum(mem.map(o=>o.Guest_Count)), nonGuests=sum(non.map(o=>o.Guest_Count));
  $('memberKpis').innerHTML=`
    <div class="stat-box"><span>會員訂單占比</span><strong>${c.length?(mem.length/c.length*100).toFixed(1):0}%</strong></div>
    <div class="stat-box"><span>會員客單價</span><strong>${fmtMoney(memberGuests?vals[0]/memberGuests:0)}</strong></div>
    <div class="stat-box"><span>非會員客單價</span><strong>${fmtMoney(nonGuests?vals[1]/nonGuests:0)}</strong></div>
    <div class="stat-box"><span>活躍會員數</span><strong>${unique(mem.map(o=>o.Member_ID)).length}</strong></div>`;

  const byMember=groupBy(mem,o=>o.Member_ID);
  const rows=Object.entries(byMember).map(([id,r])=>({name:r[0].Member_Name||id,level:r[0].Member_Level||'一般',count:r.length,total:sum(r.map(x=>x.Final_Total))})).sort((a,b)=>b.total-a.total).slice(0,10);
  $('topMembersBody').innerHTML=rows.map(x=>`<tr><td><strong>${x.name}</strong></td><td>${x.level}</td><td>${x.count}</td><td>${fmtMoney(x.total)}</td><td>${fmtMoney(x.total/x.count)}</td></tr>`).join('') || '<tr><td colspan="5">目前篩選條件沒有會員資料</td></tr>';
}

function renderProduct(orders,items){
  const cItems=completedItems(items);
  const byItem=groupBy(cItems,i=>i.Item_Name);
  const itemRows=Object.entries(byItem).map(([name,r])=>({name,revenue:sum(r.map(x=>x.Line_Total)),qty:sum(r.map(x=>x.Qty)),discount:sum(r.map(x=>x.Allocated_Discount||0))})).sort((a,b)=>b.revenue-a.revenue);
  const top=itemRows.slice(0,10);
  setChart('topItemsChart',{type:'bar',data:{labels:top.map(x=>x.name),datasets:[{data:top.map(x=>x.revenue),backgroundColor:'#2f6feb',borderRadius:6}]},options:{...baseOptions(),indexAxis:'y'}});

  const cats=groupBy(cItems,i=>i.Category);
  const catKeys=Object.keys(cats).sort((a,b)=>sum(cats[b].map(x=>x.Line_Total))-sum(cats[a].map(x=>x.Line_Total)));
  setChart('categoryChart',{type:'doughnut',data:{labels:catKeys,datasets:[{data:catKeys.map(k=>sum(cats[k].map(x=>x.Line_Total))),backgroundColor:palette(catKeys.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'}}}});

  // Basket pairs by transaction, unique item names
  const tx=groupBy(cItems,i=>i.Transaction_ID), pairCounts={};
  Object.values(tx).forEach(rows=>{
    const names=unique(rows.map(r=>r.Item_Name)).sort();
    for(let a=0;a<names.length;a++) for(let b=a+1;b<names.length;b++){
      const key=names[a]+'|||'+names[b]; pairCounts[key]=(pairCounts[key]||0)+1;
    }
  });
  const pairs=Object.entries(pairCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  $('basketPairs').innerHTML=pairs.map(([k,count])=>{const [a,b]=k.split('|||');return `<div class="pair-item"><div><div class="pair-main">${a} + ${b}</div><div class="pair-sub">同張訂單一起出現</div></div><div class="pair-count">${count}</div></div>`}).join('') || '<div class="insight-item">目前沒有足夠商品組合資料</div>';

  const disc=itemRows.filter(x=>x.discount>0).sort((a,b)=>b.discount-a.discount).slice(0,10);
  $('discountItemsBody').innerHTML=disc.map(x=>`<tr><td>${x.name}</td><td>${fmtMoney(x.discount)}</td><td>${fmtMoney(x.revenue)}</td><td>${(x.discount/(x.revenue+x.discount)*100).toFixed(1)}%</td></tr>`).join('') || '<tr><td colspan="4">目前沒有商品折扣</td></tr>';
}

function renderOperations(orders){
  const c=completed(orders), dine=c.filter(o=>o.Order_Type==='內用');
  const byHour=groupBy(dine,o=>String(safeDate(o.Open_Time).getHours()).padStart(2,'0')+':00');
  const hours=Object.keys(byHour).sort();
  const hourDining=hours.map(h=>avg(byHour[h].map(x=>Number(x.Dining_Minutes||0))));
  setChart('diningByHourChart',{type:'line',data:{labels:hours,datasets:[{data:hourDining,borderColor:'#e15b64',backgroundColor:'rgba(225,91,100,.10)',fill:true,tension:.35,pointRadius:3}]},options:baseOptions()});

  const byStore=groupBy(c,o=>o.Store_Name);
  const stores=Object.keys(byStore);
  const rates=stores.map(s=>{const r=byStore[s], gross=sum(r.map(x=>Number(x.Subtotal||0))), disc=sum(r.map(x=>Number(x.Discount_Amount||0)));return gross?disc/gross*100:0});
  setChart('discountByStoreChart',{type:'bar',data:{labels:stores,datasets:[{data:rates,backgroundColor:rates.map(x=>x===Math.max(...rates)?'#f59e0b':'#6fa6f7'),borderRadius:6}]},options:baseOptions()});

  const metrics=storeMetrics(orders);
  const longest=[...metrics].sort((a,b)=>b.dining-a.dining)[0];
  const otherAvg=avg(metrics.filter(x=>x.store!==longest?.store).map(x=>x.dining));
  let peakIdx=0; hourDining.forEach((v,i)=>{if(v>hourDining[peakIdx])peakIdx=i});
  const busiestDiningHour=hours[peakIdx]||'—';
  const maxDiscIdx=rates.length?rates.indexOf(Math.max(...rates)):-1;
  const discStore=maxDiscIdx>=0?stores[maxDiscIdx]:'—';

  $('problemTitle').textContent = longest ? `${longest.store} 平均用餐時間偏長` : '目前篩選條件資料不足';
  $('problemText').textContent = longest ? `平均 ${Math.round(longest.dining)} 分鐘；其他門市平均約 ${Math.round(otherAvg)} 分鐘。內用停留時間較長可能進一步影響翻桌與尖峰接客能力。` : '請調整篩選條件。';

  $('rootCauseList').innerHTML=`
    <div class="flow-row">尖峰用餐時間最高：${busiestDiningHour}</div>
    <div class="flow-row">檢查：點餐 → 出餐是否變慢</div>
    <div class="flow-row">檢查：外送訂單是否與內用同時集中</div>
    <div class="flow-row">檢查：桌邊服務 / 結帳是否形成等待</div>
    <div class="flow-row">另一個異常訊號：${discStore} 折扣率最高</div>`;

  $('actionList').innerHTML=`
    <div class="flow-row">依每小時訂單量調整尖峰排班</div>
    <div class="flow-row">高峰前完成備料與工作站配置</div>
    <div class="flow-row">內用 / 外送出餐動線分流</div>
    <div class="flow-row">縮短結帳等待：桌邊 / 行動支付</div>
    <div class="flow-row">改善後重新比較 Dining Time、Turnover、Revenue</div>`;
}

function renderAll(){
  const {orders,items}=getFiltered();
  renderOverview(orders);
  renderStore(orders);
  renderCustomer(orders);
  renderProduct(orders,items);
  renderOperations(orders);
}

initFilters();
renderAll();
