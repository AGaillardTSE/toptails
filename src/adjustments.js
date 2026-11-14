function initAdjustments(payload,context) {
  'use strict';
  context=context||{};
  const data=payload||{},rows=Array.isArray(data)?data:Array.isArray(data.rows)?data.rows:[],profiles=Array.isArray(data.distribution_profiles)?data.distribution_profiles:[];
  const $=id=>document.getElementById(id),finite=x=>typeof x==='number'&&Number.isFinite(x),pct=x=>finite(x)?(100*x).toLocaleString('en-US',{maximumFractionDigits:1})+'%':'—',num=(x,d=1)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const housingMatches=context.housingMatches||(row=>(row.housing_method||'benchmark')==='benchmark'),getHousingMethod=context.getHousingMethod||(()=>'benchmark');
  const surveyLabels={PSID:'PSID',CEX_BM_RECON:'CEX',HFCS:'HFCS',HILDA:'HILDA',SHIW:'SHIW',SCF:'SCF'};
  const countryLabels=new Map(rows.filter(r=>r.country).map(r=>[r.country,r.country_name||r.country]));
  let yearCharts=[],distributionCharts=[],figureSurvey='PSID',figureCountry='',figureMode='relative',distributionSurvey='PSID',distributionCountry='',distributionDomain='consumption';
  const selections={consumption:'consump_def1',income:'total_income',wealth:'networth_val'};

  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
  function surveyOrder(a,b){return ['PSID','CEX_BM_RECON','SCF','HFCS','HILDA','SHIW'].indexOf(a)-['PSID','CEX_BM_RECON','SCF','HFCS','HILDA','SHIW'].indexOf(b);}
  function domainOf(row){const g=(row.group||'').toLowerCase(),v=(row.variable||'').toLowerCase();if(g.includes('wealth')||v.includes('networth')||v.includes('wealth'))return'wealth';if(g.includes('income')||v.includes('income'))return'income';return'consumption';}
  function currentRows(){return rows.filter(r=>housingMatches(r)&&(r.survey||'PSID')===figureSurvey&&(!figureCountry||r.country===figureCountry));}
  function fillSurveySelectors(){
    const annual=[...new Set(rows.map(r=>r.survey||'PSID'))].filter(s=>surveyLabels[s]).sort(surveyOrder),dist=[...new Set(profiles.map(r=>r.survey))].filter(s=>surveyLabels[s]).sort(surveyOrder);
    $('adjustment-figure-survey').replaceChildren();annual.forEach(s=>option($('adjustment-figure-survey'),s,surveyLabels[s]));if(!annual.includes(figureSurvey))figureSurvey=annual[0]||'';$('adjustment-figure-survey').value=figureSurvey;
    $('adjustment-distribution-survey').replaceChildren();dist.forEach(s=>option($('adjustment-distribution-survey'),s,surveyLabels[s]));if(!dist.includes(distributionSurvey))distributionSurvey=dist[0]||'';$('adjustment-distribution-survey').value=distributionSurvey;
  }
  function fillCountry(selectId,controlId,survey,isDistribution){
    const source=isDistribution?profiles:rows,countries=[...new Set(source.filter(r=>r.survey===survey&&r.country).map(r=>r.country))].sort((a,b)=>(countryLabels.get(a)||a).localeCompare(countryLabels.get(b)||b)),select=$(selectId),control=$(controlId);
    select.replaceChildren();countries.forEach(c=>option(select,c,countryLabels.get(c)||c));control.hidden=countries.length<2;
    let value=isDistribution?distributionCountry:figureCountry;if(!countries.includes(value))value=countries[0]||'';select.value=value;if(isDistribution)distributionCountry=value;else figureCountry=value;
  }
  function fillVariables(){
    const available=currentRows(),specs=[['consumption','adjustment-figure-consumption-variable'],['income','adjustment-figure-income-variable'],['wealth','adjustment-figure-wealth-variable']];
    specs.forEach(([domain,id])=>{const select=$(id),map=new Map();available.filter(r=>domainOf(r)===domain).forEach(r=>{if(!map.has(r.variable))map.set(r.variable,r.label||r.variable);});select.replaceChildren();[...map].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([v,l])=>option(select,v,l));if(!map.has(selections[domain]))selections[domain]=map.keys().next().value||'';select.value=selections[domain];select.disabled=!map.size;});
  }
  function chartOptions(yTitle,levels,tooltip){return{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12,usePointStyle:true,boxWidth:9}},tooltip:{callbacks:{label:tooltip}}},scales:{x:{grid:{display:false},ticks:{font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{grid:{color:'#ececf0'},border:{display:false},title:{display:true,text:yTitle,font:{size:11}},ticks:{font:{size:11},callback:levels?x=>num(x,0):pct}}}};}
  function renderYears(){
    const root=$('adjustment-figure-results'),panel=root?.closest('[role="tabpanel"]');if(!root||$('panel-adjustments')?.hidden||panel?.hidden)return;
    yearCharts.forEach(c=>c.destroy());yearCharts=[];fillCountry('adjustment-figure-country','adjustment-figure-country-control',figureSurvey,false);fillVariables();
    const available=currentRows(),used=[];let minYear=Infinity,maxYear=-Infinity;
    [['consumption','adjustment-figure-consumption'],['income','adjustment-figure-income'],['wealth','adjustment-figure-wealth']].forEach(([domain,id])=>{
      const chosen=selections[domain],selected=available.filter(r=>r.variable===chosen&&finite(r.raw_total)).sort((a,b)=>a.year-b.year),canvas=$(id),card=canvas.closest('.adjustment-figure-card'),title=$('adjustment-figure-'+domain+'-title');
      card.classList.toggle('adjustment-figure-empty',!selected.length);canvas.hidden=!selected.length;title.textContent=selected[0]?.label||domain[0].toUpperCase()+domain.slice(1);if(!selected.length)return;
      used.push(...selected);minYear=Math.min(minYear,selected[0].year);maxYear=Math.max(maxYear,selected.at(-1).year);
      let datasets,levels=figureMode==='levels';
      if(levels){datasets=[['Reported','raw_total','#9c9ba3'],['Representation only','weights_only_total','#294766'],['Fully adjusted','adjusted_total','#4D8B69']].map(([label,key,color])=>({label,data:selected.map(r=>finite(r[key])?r[key]/1e9:null),borderColor:color,backgroundColor:color,borderWidth:2,pointRadius:3,tension:0,spanGaps:false}));}
      else{datasets=[['Representation weighting','representation_relative_raw','#294766',[]],['Reporting / component rescaling','reporting_relative_raw','#b94a75',[]],['Total correction','total_relative_raw','#888d96',[5,4]]].map(([label,key,color,dash])=>({label,data:selected.map(r=>r[key]),borderColor:color,backgroundColor:color,borderDash:dash,borderWidth:key==='total_relative_raw'?1.4:2,pointRadius:3,tension:0,spanGaps:false}));}
      const unit=selected[0].unit||'survey currency';yearCharts.push(new Chart(canvas,{type:'line',data:{labels:selected.map(r=>String(r.year)),datasets},options:chartOptions(levels?'Aggregate (billions; '+unit+')':'Change / reported aggregate',levels,ctx=>ctx.dataset.label+': '+(levels?num(ctx.raw,2)+' billion '+unit:pct(ctx.raw)))}));
    });
    const housing=getHousingMethod()==='bp'?'constant 5.4% imputed-rent rate':'benchmark homeowner services',country=figureCountry?' · '+(countryLabels.get(figureCountry)||figureCountry):'';
    $('adjustment-figure-readout').textContent=surveyLabels[figureSurvey]+country+' · '+housing+' · '+(isFinite(minYear)?minYear+(maxYear!==minYear?'–'+maxYear:''):'no available years')+(figureSurvey==='SCF'?' · reporting adjustment only':'');
    $('adjustment-figure-csv').disabled=!used.length;$('adjustment-figure-csv')._rows=used;
  }
  const palette=['#1b6f86','#d08032','#4d8b69','#a44f71','#7569a5','#9a7b4f','#3d5f89','#b85f54','#718238','#69717e'];
  function renderDistribution(){
    const root=$('adjustment-distribution-results'),panel=root?.closest('[role="tabpanel"]');if(!root||$('panel-adjustments')?.hidden||panel?.hidden)return;
    distributionCharts.forEach(c=>c.destroy());distributionCharts=[];fillCountry('adjustment-distribution-country','adjustment-distribution-country-control',distributionSurvey,true);
    const currentProfiles=profiles.filter(r=>!r.housing_method||housingMatches(r)),availableDomains=new Set(currentProfiles.filter(r=>r.survey===distributionSurvey&&(!distributionCountry||r.country===distributionCountry)).map(r=>r.domain)),domainSelect=$('adjustment-distribution-domain');[...domainSelect.options].forEach(o=>{o.disabled=!availableDomains.has(o.value);});if(!availableDomains.has(distributionDomain)){distributionDomain=[...domainSelect.options].find(o=>!o.disabled)?.value||'consumption';domainSelect.value=distributionDomain;}
    const selected=currentProfiles.filter(r=>r.survey===distributionSurvey&&r.domain===distributionDomain&&(!distributionCountry||r.country===distributionCountry)),stages=['raw','reporting','full'],ids=['adjustment-distribution-raw','adjustment-distribution-reporting','adjustment-distribution-full'];
    stages.forEach((stage,i)=>{const canvas=$(ids[i]),stageRows=selected.filter(r=>r.stage===stage),card=canvas.closest('.adjustment-distribution-card');card.hidden=!stageRows.length;if(!stageRows.length)return;const categories=[...new Set(stageRows.map(r=>r.category))],quantiles=[...new Set(stageRows.map(r=>r.quantile))].sort((a,b)=>a-b),datasets=categories.map((category,j)=>{const map=new Map(stageRows.filter(r=>r.category===category).map(r=>[r.quantile,r.share]));return{label:category,data:quantiles.map(q=>map.get(q)),borderColor:palette[j%palette.length],backgroundColor:palette[j%palette.length],borderWidth:1.8,pointRadius:1.8,pointStyle:'circle',tension:.18,spanGaps:true};});distributionCharts.push(new Chart(canvas,{type:'line',data:{labels:quantiles.map(q=>Math.round(100*q)),datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{position:'top',labels:{font:{size:10},padding:10,usePointStyle:true,boxWidth:7}},tooltip:{callbacks:{title:items=>'P'+items[0].label,label:ctx=>ctx.dataset.label+': '+pct(ctx.raw)}}},scales:{x:{grid:{display:false},title:{display:true,text:'Percentile of '+distributionDomain},ticks:{callback:x=>'P'+quantiles[x]*100,maxTicksLimit:6,maxRotation:0}},y:{grid:{color:'#ececf0'},title:{display:i===0,text:'Share of '+distributionDomain},ticks:{callback:pct}}}}}));});
    $('adjustment-distribution-full-card').hidden=!selected.some(r=>r.stage==='full');
    const country=distributionCountry?' · '+(countryLabels.get(distributionCountry)||distributionCountry):'';$('adjustment-distribution-readout').textContent=surveyLabels[distributionSurvey]+country+' · '+distributionDomain+' · '+(getHousingMethod()==='bp'?'constant-rate':'benchmark')+' homeowner services · weighted percentile bins'+(distributionSurvey==='SCF'?' · reporting adjustment only':'');
    $('adjustment-distribution-csv').disabled=!selected.length;$('adjustment-distribution-csv')._rows=selected;
  }
  function download(rowsToSave,name){if(!rowsToSave?.length)return;const fields=[...new Set(rowsToSave.flatMap(Object.keys))],esc=x=>x===null||x===undefined?'':'"'+String(x).replace(/"/g,'""')+'"',csv=[fields.join(','),...rowsToSave.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  fillSurveySelectors();
  $('adjustment-figure-survey').addEventListener('change',e=>{figureSurvey=e.target.value;figureCountry='';renderYears();});$('adjustment-figure-country').addEventListener('change',e=>{figureCountry=e.target.value;renderYears();});$('adjustment-figure-mode').addEventListener('change',e=>{figureMode=e.target.value;renderYears();});
  ['consumption','income','wealth'].forEach(domain=>$('adjustment-figure-'+domain+'-variable').addEventListener('change',e=>{selections[domain]=e.target.value;renderYears();}));
  $('adjustment-distribution-survey').addEventListener('change',e=>{distributionSurvey=e.target.value;distributionCountry='';renderDistribution();});$('adjustment-distribution-country').addEventListener('change',e=>{distributionCountry=e.target.value;renderDistribution();});$('adjustment-distribution-domain').addEventListener('change',e=>{distributionDomain=e.target.value;renderDistribution();});
  $('adjustment-figure-csv').addEventListener('click',e=>download(e.currentTarget._rows,(surveyLabels[figureSurvey]||figureSurvey)+'_adjustments_over_years.csv'));$('adjustment-distribution-csv').addEventListener('click',e=>download(e.currentTarget._rows,(surveyLabels[distributionSurvey]||distributionSurvey)+'_'+distributionDomain+'_adjustment_along_distribution.csv'));
  return{render:()=>{renderYears();renderDistribution();},resize:()=>{yearCharts.forEach(c=>c.resize());distributionCharts.forEach(c=>c.resize());}};
}
