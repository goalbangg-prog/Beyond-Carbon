/* Context-aware chart explanations. Values are derived from the currently rendered data, never invented by AI. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const impacts=['탄소발자국','자원발자국','산성화','부영양화','물발자국'];
const rows=window.LCA_DATA||[];
const targets=[
 ['storyStageChart','report-stages'],['storyHist','report-hist'],
 ['storyScatter','report-scatter'],['storyCluster','report-clusters'],
 ['contribPlot','calc'],['exploreResult','explore'],['clusterResult','cluster']
];
const panels={};
const style=document.createElement('style');style.textContent=`
.looply-result-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(290px,1fr);gap:18px;align-items:start;margin-top:18px}
.looply-result-layout>.looply-context-ai{margin:0!important;position:sticky;top:18px}
.looply-result-layout>.viz,.looply-result-layout>#exploreResult,.looply-result-layout>#clusterResult{min-width:0}
.looply-context-ai button{margin-top:12px;width:100%}
@media(max-width:900px){.looply-result-layout{grid-template-columns:minmax(0,1fr)}.looply-result-layout>.looply-context-ai{position:static}}
`;document.head.append(style);
let calcRequest=0;let statsRequest=0;
const apiBase=()=> (window.LOOPLY_AI_API_URL||'https://looply-ai-api.onrender.com').replace(/[/]$/,'');
async function runStatisticalInsight(){
 const panel=panels.explore;if(!panel)return;
 const impact=impacts.indexOf($('exImpact')?.value);
 const payload={stage:$('exStage')?.value,unit:$('exUnit')?.value,impact};
 if(!payload.stage||!payload.unit||impact<0)return;
 const sequence=++statsRequest;panel.status.textContent='Python 통계 분석 결과를 불러오는 중…';
 try{
  const response=await fetch(apiBase()+'/api/statistical-insight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();
  if(sequence!==statsRequest||payload.stage!==$('exStage').value||payload.unit!==$('exUnit').value||payload.impact!==impacts.indexOf($('exImpact').value))return;
  panel.text.textContent=[result.finding,result.meaning,result.caution].join(' ');
  panel.status.textContent=result.generation==='ai'?'Python 검증 통계 + AI 해석 · 수치와 주의사항 고정':'Python 검증 통계 + 기본 해석 · AI 미사용 또는 안전 대체';
 }catch(_){if(sequence!==statsRequest)return;panel.status.textContent='통계 서버 연결 실패 · 화면 내 기본 해설 표시';panel.text.textContent=describe('explore');}
}

let advancedRequest=0;
async function runAdvancedInsight(kind){
 const panel=panels[kind];if(!panel)return;
 let endpoint,payload;
 if(kind==='explore'){
  const x=impacts.indexOf($('exImpact')?.value),y=impacts.indexOf($('exImpact2')?.value);
  if(x<0||y<0||x===y){panel.status.textContent='서로 다른 영향범주 두 개를 선택하세요.';return;}
  endpoint='correlation-insight';payload={stage:$('exStage')?.value,unit:$('exUnit')?.value,impact_x:x,impact_y:y};
 }else{
  const scope=$('clusterScope')?.value||'',parts=scope.split('|||');
  const selected=[...document.querySelectorAll('[data-cl]:checked')].map(el=>Number(el.value));
  if(parts.length!==2||selected.length<2){panel.status.textContent='분석 범위와 영향범주 두 개 이상을 선택하세요.';return;}
  endpoint='cluster-insight';payload={stage:parts[0],unit:parts[1],impacts:selected,k:Number($('clusterK')?.value)};
 }
 const seq=++advancedRequest;const signature=JSON.stringify(payload);
 panel.status.textContent='Python 통계 재계산 및 AI 해석을 요청하는 중…';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),26000);
  let response;try{response=await fetch(apiBase()+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:signature,signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();
  if(seq!==advancedRequest)return;
  const current=kind==='explore'?JSON.stringify({stage:$('exStage')?.value,unit:$('exUnit')?.value,impact_x:impacts.indexOf($('exImpact')?.value),impact_y:impacts.indexOf($('exImpact2')?.value)}):JSON.stringify({stage:($('clusterScope')?.value||'').split('|||')[0],unit:($('clusterScope')?.value||'').split('|||')[1],impacts:[...document.querySelectorAll('[data-cl]:checked')].map(el=>Number(el.value)),k:Number($('clusterK')?.value)});
  if(current!==signature)return;
  const profiles=kind==='cluster'?(result.facts?.profiles||[]).map(p=>p.cluster+'번 군집('+p.size+'개): '+p.distinguishing_impact+' '+p.direction+' · 예시 '+p.examples.join(', ')).join(' / '):'';
  if(kind==='cluster'&&result.facts?.profiles){
   const root=$('clusterResult');
   root.replaceChildren();
   const header=document.createElement('p');header.textContent='Python KMeans · 유효 '+result.facts.valid+'/'+result.facts.total+' · 실루엣 '+result.facts.silhouette;root.append(header);
   const grid=document.createElement('div');grid.className='grid three';
   for(const p of result.facts.profiles){
    const card=document.createElement('div');card.className='metric';
    const title=document.createElement('strong');title.textContent=p.cluster+'번 군집 · '+p.size+'개';card.append(title);
    const info=document.createElement('p');info.textContent=p.distinguishing_impact+' '+p.direction+' (중심값 '+p.standardized_center+')';card.append(info);
    const examples=document.createElement('small');examples.textContent=p.examples.join(', ');card.append(examples);grid.append(card);
   }
   root.append(grid);
  }
  if(kind==='explore'){
   const root=$('exploreResult'),old=root.querySelector('[data-correlation]');
   if(old)old.remove();
   const summary=document.createElement('p');summary.dataset.correlation='true';
   summary.textContent='Python Spearman ρ: '+result.facts.rho+' · 쌍별 유효 표본 '+result.facts.paired+'/'+result.facts.total;root.prepend(summary);
  }
  panel.text.textContent=[result.finding,profiles,result.meaning,result.caution].filter(Boolean).join(' ');
  panel.status.textContent=(result.generation==='ai'?'Python 통계 + AI 해석':'Python 통계 + 검증된 기본 해석')+' · 서버 재계산 기준'+(kind==='cluster'?' · 브라우저 군집과 별도 실행':'');
 }catch(e){if(seq!==advancedRequest)return;panel.status.textContent='통계 분석 API 연결 실패 · 기본 설명 유지';panel.text.textContent=describe(kind);}
}
function calcPayload(){
 if(typeof calculations!=='function')return null;
 const combined=new Map();
 for(const x of calculations()){
  if(!Number.isFinite(x.qty)||x.qty<0||!Number.isFinite(x.b.row.id))return null;
  const id=x.b.row.id;combined.set(id,(combined.get(id)||0)+x.qty);
 }
 const items=[...combined].map(([id,quantity])=>({id,quantity}));
 return items.length?{impact:Number($('impact')?.value||0),items}:null;
}
async function runCalcAI(){
 const panel=panels.calc;if(!panel)return;
 const payload=calcPayload();if(!payload){panel.status.textContent='항목과 유효한 사용량을 먼저 입력하세요.';return;}
 const sequence=++calcRequest;
 panel.status.textContent='서버에서 계수를 재검증하고 AI 설명을 생성하는 중…';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  let response;try{response=await fetch((window.LOOPLY_AI_API_URL||'https://looply-ai-api.onrender.com').replace(/[/]$/,'')+'/api/calculation-insight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();
  if(sequence!==calcRequest||JSON.stringify(payload)!==JSON.stringify(calcPayload()))return;
  if(!result.insight||typeof result.insight.finding!=='string')throw Error('Invalid response');
  panel.text.textContent=[result.insight.finding,result.insight.meaning,result.insight.caution].join(' ');
  panel.status.textContent=result.generation==='ai'?'서버 재계산 + AI 쉬운 해설':'서버 재계산 + 검증된 기본 해설';
 }catch(e){if(sequence!==calcRequest)return;panel.status.textContent='AI 서버 연결 오류 · 아래 데이터 기반 설명은 유지됩니다.';panel.text.textContent=describe('calc');}
}
function staleCalc(){calcRequest++;if(panels.calc){panels.calc.status.textContent='분석 조건이 변경되었습니다 · AI 해설을 다시 생성해 주세요.';panels.calc.text.textContent=describe('calc')}}
function n(v){return Number(v).toLocaleString('ko-KR',{maximumSignificantDigits:4})}
function createPanel(anchor,key){
 const card=document.createElement('aside');card.className='looply-context-ai';
 card.style.cssText='margin:15px 0;padding:17px 19px;border:1px solid #c9e1e8;background:#f4fafb;border-radius:14px;line-height:1.65';
 const title=document.createElement('strong');title.textContent='✦ 분석 조건에 따른 해설';
 const text=document.createElement('p');text.style.margin='8px 0';text.setAttribute('aria-live','polite');
 const status=document.createElement('small');status.style.color='#66788a';status.textContent='현재 화면의 데이터로 계산한 설명 · AI 맞춤 생성 연동 준비 중';
 card.append(title,text,status);
 if(key==='cluster'){
  const button=document.createElement('button');button.type='button';button.textContent='군집별 통계 발견과 AI 해석 보기';button.addEventListener('click',()=>runAdvancedInsight('cluster'));card.append(button);
 }
 if(key==='explore'){
  const correlation=document.createElement('button');correlation.type='button';correlation.textContent='Spearman 상관관계와 AI 해석 보기';correlation.addEventListener('click',()=>runAdvancedInsight('explore'));card.append(correlation);
  const button=document.createElement('button');button.type='button';button.textContent='현재 범위의 통계 발견과 AI 해석 보기';button.addEventListener('click',runStatisticalInsight);card.append(button);
 }
 if(key==='calc'){
  const button=document.createElement('button');button.type='button';button.textContent='현재 계산 결과 AI 해설';button.addEventListener('click',runCalcAI);card.append(button);
 }
 if(key.startsWith('report-')){const parent=anchor.closest('.story-card');if(parent?.nextElementSibling)parent.nextElementSibling.append(card);else anchor.after(card)}
 else if(['calc','explore','cluster'].includes(key)){
  const wrap=document.createElement('div');wrap.className='looply-result-layout';anchor.before(wrap);wrap.append(anchor,card);
 } else anchor.after(card);
 panels[key]={text,status};
}
function describe(key){
 if(key==='report-stages'){
  const counts={};rows.forEach(r=>counts[r.stage]=(counts[r.stage]||0)+1);
  const ordered=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  return '전체 '+n(rows.length)+'개 중 '+ordered[0][0]+' '+n(ordered[0][1])+'개, '+ordered.at(-1)[0]+' '+n(ordered.at(-1)[1])+'개입니다. 항목 수가 환경영향의 크기나 데이터의 충분성을 의미하지는 않습니다.';
 }
 if(key==='report-hist'){
  const a=rows.filter(r=>r.stage==='원료 및 에너지 생산'&&r.unit==='kg'&&r.v[0]>0);
  return '원료 및 에너지 생산 단계의 kg 기준 탄소발자국 양수 계수 '+n(a.length)+'개를 로그축으로 살펴봅니다. 로그축은 큰 수치 차이를 읽기 쉽게 하지만 실제 계수값을 바꾸지는 않습니다.';
 }
 if(key==='report-scatter'){
  const a=rows.filter(r=>r.stage==='원료 및 에너지 생산'&&r.unit==='kg'&&r.v[0]>0&&r.v[1]>0);
  return '동일한 kg 기준에서 탄소발자국과 자원발자국 값이 모두 양수인 '+n(a.length)+'개 항목을 비교합니다. 함께 증가하는 패턴이 보여도 인과관계를 뜻하지 않습니다.';
 }
 if(key==='report-clusters')return '리포트의 군집 프로필은 로그 변환과 표준화를 거친 값입니다. 색상은 원래 평가계수가 아니며, 군집 번호도 친환경 순위가 아닙니다.';
 if(key==='calc'){
  if(typeof calculations!=='function')return '계산 결과를 기다리고 있습니다.';
  const res=calculations(),j=Number($('impact')?.value||0);
  if(!res.length)return '항목을 추가하고 사용량을 입력하면 현재 계산 조건에 맞춰 설명이 표시됩니다.';
  const valid=res.filter(x=>Number.isFinite(x.v[j]));
  const total=valid.reduce((sum,x)=>sum+x.v[j],0);
  const ranked=[...valid].sort((a,b)=>b.v[j]-a.v[j]);const biggest=ranked[0];const positive=valid.reduce((a,x)=>a+Math.max(0,x.v[j]),0);const share=biggest&&positive>0?100*biggest.v[j]/positive:null;
  return '현재 '+n(res.length)+'개 항목을 계산했습니다. '+impacts[j]+' 범주에서 유효한 항목은 '+n(valid.length)+'개, 계산된 부분 합계는 '+n(total)+'입니다. '+(biggest?'가장 큰 기여 항목은 '+biggest.b.row.name+(share!=null?'(양수 기여량의 '+n(share)+'%)':'')+'입니다. ':'')+(ranked.length>1?'다음 기여 항목은 '+ranked[1].b.row.name+'입니다. ':'')+'기여도가 큰 항목부터 검토하되 기능적 동등성을 확인해야 합니다. 제품 전체 LCA 결과는 아닙니다.';
 }
 if(key==='explore'){
  const stage=$('exStage')?.value,unit=$('exUnit')?.value,mode=$('exMode')?.value;
  const j=impacts.indexOf($('exImpact')?.value);
  const a=rows.filter(r=>r.stage===stage&&r.unit===unit);
  const valid=a.filter(r=>j>=0&&Number.isFinite(r.v[j]));
  const labels={rank:'계수 순위',hist:'로그 분포',box:'박스플롯',scatter:'산점도',corr:'순위상관'};
  return stage+' / '+unit+' 기준 '+n(a.length)+'개 중 '+impacts[j]+' 유효 계수 '+n(valid.length)+'개입니다. 선택한 '+(labels[mode]||'분석')+'는 현재 범위에서 나타나는 패턴을 보여줍니다. 다른 기준 단위와 직접 비교하거나 상관관계를 원인으로 해석하지 마세요.';
 }
 if(key==='cluster'){
  const scope=$('clusterScope')?.value||'',sel=[...document.querySelectorAll('[data-cl]:checked')].map(x=>Number(x.value));
  const [stage,unit]=scope.split('|||'),k=Number($('clusterK')?.value||0);
  const valid=rows.filter(r=>r.stage===stage&&r.unit===unit&&sel.every(j=>r.v[j]>0));
  return '현재 '+(stage||'선택 전')+' / '+(unit||'단위 미선택')+'에서 '+n(sel.length)+'개 영향범주를 사용합니다. 모든 선택 범주의 계수가 양수인 항목은 '+n(valid.length)+'개이며, 군집 수 k='+n(k)+'입니다. 군집은 비슷한 계수 패턴의 탐색적 묶음이지 환경성 순위가 아닙니다.';
 }
 return '';
}
function update(key){const panel=panels[key];if(!panel)return;if((key==='explore'||key==='cluster')&&panel.status.textContent.includes('서버 재계산 기준'))return;panel.text.textContent=describe(key);if(key==='calc')panel.status.textContent='현재 화면의 데이터로 계산한 설명 · 버튼을 누르면 AI 해설 생성';}
for(const [id,key] of targets){const el=$(id);if(el)createPanel(el,key);}
function updateAll(){Object.keys(panels).forEach(update)}
updateAll();
const watch=['impact','exStage','exUnit','exImpact','exImpact2','exMode','clusterScope','clusterK','runCluster','add','clear','example','recommendK'];
watch.forEach(id=>$(id)?.addEventListener('change',()=>{if(id==='impact')staleCalc();if(['exStage','exUnit','exImpact','exMode','exImpact2','clusterScope','clusterK'].includes(id)){advancedRequest++;}if(['exStage','exUnit','exImpact','exMode','exImpact2'].includes(id)){statsRequest++;if(panels.explore)panels.explore.status.textContent='조건 변경됨 · 통계적 발견을 다시 확인하세요.';}setTimeout(updateAll,80)}));
watch.forEach(id=>$(id)?.addEventListener('click',()=>{if(['add','clear','example'].includes(id))staleCalc();setTimeout(updateAll,120)}));
['basket','clusterChecks'].forEach(id=>$(id)?.addEventListener('change',()=>{if(id==='basket')staleCalc();if(id==='clusterChecks')advancedRequest++;setTimeout(updateAll,120)}));
document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>setTimeout(updateAll,80)));
window.LooplyContextInsights={updateAll};
})();
