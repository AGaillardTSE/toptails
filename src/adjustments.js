function initAdjustments(payload,context) {
  'use strict';
  context=context||{};
  const data=payload||{},rows=Array.isArray(data)?data:Array.isArray(data.rows)?data.rows:[],profiles=Array.isArray(data.distribution_profiles)?data.distribution_profiles:[];
  const compositionContracts=data.composition_contracts||[],distributionSources=[...compositionContracts,...profiles],compositionPayloads=new Map(),compositionRequests=new Map();
  const $=id=>document.getElementById(id),finite=x=>typeof x==='number'&&Number.isFinite(x),pct=x=>finite(x)?(100*x).toLocaleString('en-US',{maximumFractionDigits:1})+'%':'—',num=(x,d=1)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const housingMatches=context.housingMatches||(row=>(row.housing_method||'benchmark')==='benchmark'),getHousingMethod=context.getHousingMethod||(()=>'benchmark');
  const getWeightingMethod=context.getWeightingMethod||(()=>'scf_income');
  const surveyLabels={PSID:'PSID',CEX_BM_RECON:'CEX',HFCS:'HFCS',HILDA:'HILDA',SHIW:'SHIW',SCF:'SCF'};
  const countryLabels=new Map(rows.filter(r=>r.country).map(r=>[r.country,r.country_name||r.country]));
  let yearCharts=[],distributionCharts=[],figureSurvey='PSID',figureCountry='',figureMode='relative',distributionSurvey='PSID',distributionCountry='',distributionDomain='consumption';
  let compositionRequest=0,psidConsumptionView='consumption_reduced',distributionRange='all';
  const selections={consumption:'consump_def1',income:'total_income',wealth:'networth_val'};

  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
  function surveyOrder(a,b){return ['PSID','CEX_BM_RECON','SCF','HFCS','HILDA','SHIW'].indexOf(a)-['PSID','CEX_BM_RECON','SCF','HFCS','HILDA','SHIW'].indexOf(b);}
  function domainOf(row){const g=(row.group||'').toLowerCase(),v=(row.variable||'').toLowerCase();if(g.includes('wealth')||v.includes('networth')||v.includes('wealth'))return'wealth';if(g.includes('income')||v.includes('income'))return'income';return'consumption';}
  function currentRows(){return rows.filter(r=>housingMatches(r)&&(r.survey||'PSID')===figureSurvey&&(!figureCountry||r.country===figureCountry));}
  function fillSurveySelectors(){
    const annual=[...new Set(rows.map(r=>r.survey||'PSID'))].filter(s=>surveyLabels[s]).sort(surveyOrder),dist=[...new Set(distributionSources.map(r=>r.survey))].filter(s=>surveyLabels[s]).sort(surveyOrder);
    $('adjustment-figure-survey').replaceChildren();annual.forEach(s=>option($('adjustment-figure-survey'),s,surveyLabels[s]));if(!annual.includes(figureSurvey))figureSurvey=annual[0]||'';$('adjustment-figure-survey').value=figureSurvey;
    $('adjustment-distribution-survey').replaceChildren();dist.forEach(s=>option($('adjustment-distribution-survey'),s,surveyLabels[s]));if(!dist.includes(distributionSurvey))distributionSurvey=dist[0]||'';$('adjustment-distribution-survey').value=distributionSurvey;
  }
  function fillCountry(selectId,controlId,survey,isDistribution){
    const source=isDistribution?distributionSources:rows,countries=[...new Set(source.filter(r=>r.survey===survey&&r.country).map(r=>r.country))].sort((a,b)=>(countryLabels.get(a)||a).localeCompare(countryLabels.get(b)||b)),select=$(selectId),control=$(controlId);
    select.replaceChildren();countries.forEach(c=>option(select,c,countryLabels.get(c)||c));control.hidden=countries.length<2;
    let value=isDistribution?distributionCountry:figureCountry;if(!countries.includes(value))value=countries[0]||'';select.value=value;if(isDistribution)distributionCountry=value;else figureCountry=value;
  }
  function fillVariables(){
    const available=currentRows(),specs=[['consumption','adjustment-figure-consumption-variable'],['income','adjustment-figure-income-variable'],['wealth','adjustment-figure-wealth-variable']];
    specs.forEach(([domain,id])=>{const select=$(id),map=new Map();available.filter(r=>domainOf(r)===domain).forEach(r=>{if(!map.has(r.variable))map.set(r.variable,r.label||r.variable);});select.replaceChildren();[...map].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([v,l])=>option(select,v,l));if(!map.has(selections[domain]))selections[domain]=map.keys().next().value||'';select.value=selections[domain];select.disabled=!map.size;});
  }
  function chartOptions(yTitle,levels,tooltip){return{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12,usePointStyle:true,boxWidth:9}},tooltip:{callbacks:{label:tooltip}}},scales:{x:{title:{display:true,text:figureSurvey==='HFCS'?'Harmonized survey wave':'Reference year',font:{size:13}},grid:{display:false},ticks:{font:{size:11},maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{grid:{color:'#ececf0'},border:{display:false},title:{display:true,text:yTitle,font:{size:11}},ticks:{font:{size:11},callback:levels?x=>num(x,0):pct}}}};}
  function renderYears(){
    const root=$('adjustment-figure-results'),panel=root?.closest('[role="tabpanel"]');if(!root||$('panel-adjustments')?.hidden||panel?.hidden)return;
    yearCharts.forEach(c=>c.destroy());yearCharts=[];fillCountry('adjustment-figure-country','adjustment-figure-country-control',figureSurvey,false);fillVariables();
    const available=currentRows(),used=[];let minYear=Infinity,maxYear=-Infinity;
    [['consumption','adjustment-figure-consumption'],['income','adjustment-figure-income'],['wealth','adjustment-figure-wealth']].forEach(([domain,id])=>{
      const chosen=selections[domain],selected=available.filter(r=>r.variable===chosen&&finite(r.raw_total)).sort((a,b)=>SeriesYears.period(a).year-SeriesYears.period(b).year),canvas=$(id),card=canvas.closest('.adjustment-figure-card'),title=$('adjustment-figure-'+domain+'-title');
      card.hidden=figureSurvey==='CEX_BM_RECON'&&!selected.length;card.classList.toggle('adjustment-figure-empty',!selected.length);canvas.hidden=!selected.length;title.textContent=selected[0]?.label||domain[0].toUpperCase()+domain.slice(1);if(!selected.length)return;
      used.push(...selected);minYear=Math.min(minYear,SeriesYears.period(selected[0]).year);maxYear=Math.max(maxYear,SeriesYears.period(selected.at(-1)).year);
      let datasets,levels=figureMode==='levels';
      if(levels){datasets=[['Reported','raw_total','#9c9ba3'],['Representation only','weights_only_total','#294766'],['Fully adjusted','adjusted_total','#4D8B69']].map(([label,key,color])=>({label,data:selected.map(r=>finite(r[key])?r[key]/1e9:null),borderColor:color,backgroundColor:color,borderWidth:2,pointRadius:3,tension:0,spanGaps:false}));}
      else{datasets=[['Representation weighting','representation_relative_raw','#294766',[]],['Reporting / component rescaling','reporting_relative_raw','#b94a75',[]],['Total correction','total_relative_raw','#888d96',[5,4]]].map(([label,key,color,dash])=>({label,data:selected.map(r=>r[key]),borderColor:color,backgroundColor:color,borderDash:dash,borderWidth:key==='total_relative_raw'?1.4:2,pointRadius:3,tension:0,spanGaps:false}));}
      const unit=selected[0].unit||'survey currency';yearCharts.push(new Chart(canvas,{type:'line',data:{labels:selected.map(r=>SeriesYears.period(r).label),datasets},options:chartOptions(levels?'Aggregate (billions; '+unit+')':'Change / reported aggregate',levels,ctx=>SeriesYears.period(selected[ctx.dataIndex]).detail+' · '+ctx.dataset.label+': '+(levels?num(ctx.raw,2)+' billion '+unit:pct(ctx.raw)))}));
    });
    root.querySelector('.adjustment-figure-grid').classList.toggle('single-series',figureSurvey==='CEX_BM_RECON');
    const housing=getHousingMethod()==='bp'?'constant 5.4% imputed-rent rate':'benchmark homeowner services',country=figureCountry?' · '+(countryLabels.get(figureCountry)||figureCountry):'';
    $('adjustment-figure-readout').textContent=surveyLabels[figureSurvey]+country+' · '+housing+' · '+(isFinite(minYear)?minYear+(maxYear!==minYear?'–'+maxYear:''):'no available years')+(figureSurvey==='HFCS'?' (survey waves)':'')+(figureSurvey==='SCF'?' · reporting adjustment only':'');
    $('adjustment-figure-csv').disabled=!used.length;$('adjustment-figure-csv')._rows=used.map(row=>({...row,plotted_year:SeriesYears.period(row).year,year_basis:SeriesYears.period(row).basis}));
  }
  const palette=['#1b6f86','#d08032','#4d8b69','#a44f71','#7569a5','#9a7b4f','#3d5f89','#b85f54','#718238','#69717e'];
  function renderLegacyDistribution(){
    const root=$('adjustment-distribution-results'),panel=root?.closest('[role="tabpanel"]');if(!root||$('panel-adjustments')?.hidden||panel?.hidden)return;
    distributionCharts.forEach(c=>c.destroy());distributionCharts=[];fillCountry('adjustment-distribution-country','adjustment-distribution-country-control',distributionSurvey,true);
    const currentProfiles=profiles.filter(r=>!r.housing_method||housingMatches(r)),availableDomains=new Set(currentProfiles.filter(r=>r.survey===distributionSurvey&&(!distributionCountry||r.country===distributionCountry)).map(r=>r.domain)),domainSelect=$('adjustment-distribution-domain');[...domainSelect.options].forEach(o=>{o.disabled=!availableDomains.has(o.value);});if(!availableDomains.has(distributionDomain)){distributionDomain=[...domainSelect.options].find(o=>!o.disabled)?.value||'consumption';domainSelect.value=distributionDomain;}
    const selected=currentProfiles.filter(r=>r.survey===distributionSurvey&&r.domain===distributionDomain&&(!distributionCountry||r.country===distributionCountry)),stages=['raw','reporting','full'],ids=['adjustment-distribution-raw','adjustment-distribution-reporting','adjustment-distribution-full'];
    stages.forEach((stage,i)=>{const canvas=$(ids[i]),stageRows=selected.filter(r=>r.stage===stage),card=canvas.closest('.adjustment-distribution-card');card.hidden=!stageRows.length;if(!stageRows.length)return;const categories=[...new Set(stageRows.map(r=>r.category))],quantiles=[...new Set(stageRows.map(r=>r.quantile))].sort((a,b)=>a-b),datasets=categories.map((category,j)=>{const map=new Map(stageRows.filter(r=>r.category===category).map(r=>[r.quantile,r.share]));return{label:category,data:quantiles.map(q=>map.get(q)),borderColor:palette[j%palette.length],backgroundColor:palette[j%palette.length],borderWidth:1.8,pointRadius:1.8,pointStyle:'circle',tension:.18,spanGaps:true};});distributionCharts.push(new Chart(canvas,{type:'line',data:{labels:quantiles.map(q=>Math.round(100*q)),datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{position:'top',labels:{font:{size:10},padding:10,usePointStyle:true,boxWidth:7}},tooltip:{callbacks:{title:items=>'P'+items[0].label,label:ctx=>ctx.dataset.label+': '+pct(ctx.raw)}}},scales:{x:{grid:{display:false},title:{display:true,text:'Percentile of '+distributionDomain},ticks:{callback:x=>'P'+quantiles[x]*100,maxTicksLimit:6,maxRotation:0}},y:{grid:{color:'#ececf0'},title:{display:i===0,text:'Share of '+distributionDomain},ticks:{callback:pct}}}}}));});
    $('adjustment-distribution-full-card').hidden=!selected.some(r=>r.stage==='full');
    const country=distributionCountry?' · '+(countryLabels.get(distributionCountry)||distributionCountry):'';$('adjustment-distribution-readout').textContent=surveyLabels[distributionSurvey]+country+' · '+distributionDomain+' · '+(getHousingMethod()==='bp'?'constant-rate':'benchmark')+' homeowner services · weighted percentile bins'+(distributionSurvey==='SCF'?' · reporting adjustment only':'');
    $('adjustment-distribution-csv').disabled=!selected.length;$('adjustment-distribution-csv')._rows=selected;
  }
  const compositionMatches=row=>(['PSID','CEX_BM_RECON'].includes(row.survey)?housingMatches(row):(row.housing_method||'benchmark')==='benchmark')&&((row.weighting_method||(row.survey==='CEX_BM_RECON'?'scf_housing':'native'))===(row.survey==='PSID'?getWeightingMethod():row.survey==='CEX_BM_RECON'?'scf_housing':'native'));
  const alphaColor=color=>{const full=/^#[0-9a-f]{3}$/i.test(color)?'#'+[...color.slice(1)].map(value=>value+value).join(''):color;return /^#[0-9a-f]{6}$/i.test(full)?full+'80':full==='red'?'#ff000080':full;};
  function compositionGrid(contract){return{id:'paperCompositionFrame',beforeDatasetsDraw(chart){
    const {ctx,chartArea:a,scales}=chart;ctx.save();ctx.beginPath();ctx.rect(a.left,a.top,a.width,a.height);ctx.clip();ctx.setLineDash([4,4]);
    for(const [key,values] of [['x',contract.xbreaks],['y',contract.ybreaks]]){
      const breaks=(values||scales[key].ticks.map(t=>t.value)).filter(finite).slice().sort((a,b)=>a-b),step=breaks[1]-breaks[0];
      const expanded=breaks.length>1?[breaks[0]-step,...breaks,breaks.at(-1)+step]:breaks;
      const minor=expanded.slice(1).map((v,i)=>(v+expanded[i])/2);
      for(const [ticks,color] of [[minor,'#f1f1f1'],[breaks,'#e3e3e3']]){ctx.strokeStyle=color;ctx.lineWidth=1;for(const value of ticks){const pixel=scales[key].getPixelForValue(value);ctx.beginPath();if(key==='x'){ctx.moveTo(pixel,a.top);ctx.lineTo(pixel,a.bottom);}else{ctx.moveTo(a.left,pixel);ctx.lineTo(a.right,pixel);}ctx.stroke();}}
    }ctx.restore();
  },afterDraw(chart){const {ctx,chartArea:a}=chart;ctx.save();ctx.strokeStyle='#202020';ctx.lineWidth=1.25;ctx.strokeRect(a.left,a.top,a.width,a.height);ctx.restore();}};}
  function drawComposition(payload,contracts,view){
    const root=$('adjustment-distribution-results'),grid=root.querySelector('.adjustment-distribution-grid'),legend=$('composition-shared-legend');
    root.classList.add('paper-composition');root.removeAttribute('aria-busy');
    distributionCharts.forEach(chart=>chart.destroy());distributionCharts=[];
    const stages=['raw','reporting','full'].filter(stage=>contracts.some(c=>c.stage===stage));
    grid.classList.toggle('show-all-stages',stages.length===3);grid.classList.toggle('has-two-panels',stages.length===2);
    const selected=row=>row.survey===distributionSurvey&&row.domain===distributionDomain&&row.view===view&&(!distributionCountry||row.country===distributionCountry)&&compositionMatches(row);
    const points=payload.points.filter(selected),smooth=payload.smooth.filter(selected),primary=contracts.find(c=>c.stage==='raw')||contracts[0];
    legend.replaceChildren();primary.category_order.forEach((category,i)=>{const item=document.createElement('li'),key=document.createElement('i'),label=document.createElement('span');key.className='composition-legend-key';key.style.color=primary.colors[i];key.setAttribute('aria-hidden','true');label.textContent=primary.labels[i]||category;item.append(key,label);legend.append(item);});
    for(const stage of ['raw','reporting','full']){
      const canvas=$('adjustment-distribution-'+stage),card=canvas.closest('.adjustment-distribution-card'),contract=contracts.find(c=>c.stage===stage);card.hidden=!stages.includes(stage);if(card.hidden)continue;
      card.querySelector('h4').textContent=({raw:'Raw data',reporting:'Adjusted for reporting',full:'Adjusted for reporting and representation'})[stage];
      card.querySelector('.composition-year-note')?.remove();if(distributionSurvey==='CEX_BM_RECON'&&contract.years_used?.length){const years=contract.years_used,note=document.createElement('p');note.className='composition-year-note';note.textContent=years.length+' available waves ('+years[0]+'–'+years.at(-1)+')';note.title=years.join(', ');card.querySelector('h4').after(note);}
      const xRange=distributionRange==='top20'?[.8,1]:contract.x_display_range,xBreaks=distributionRange==='top20'?[.8,.85,.9,.95,1]:contract.xbreaks,nipaBasket=distributionSurvey==='PSID'&&contract.domain==='consumption';
      const datasets=[];let visiblePoints=0,lineCoordinates=0;
      contract.category_order.forEach((category,i)=>{
        const label=contract.labels[i]||category,color=contract.colors[i],line=smooth.filter(row=>row.stage===stage&&row.category===category).sort((a,b)=>a.quantile-b.quantile),raw=points.filter(row=>row.stage===stage&&row.category===category&&row.plot_visible!==false).sort((a,b)=>a.quantile-b.quantile);
        lineCoordinates+=line.length;visiblePoints+=raw.length;
        datasets.push({label,category,type:'line',data:line.map(row=>({x:row.quantile,y:row.share})),borderColor:color,backgroundColor:color,borderWidth:3,pointRadius:0,pointHoverRadius:0,tension:0,spanGaps:false,showLine:true,order:1,isSmooth:true});
        datasets.push({label,category,type:'scatter',data:raw.map(row=>({x:row.quantile,y:row.share})),borderColor:alphaColor(color),backgroundColor:'transparent',pointBackgroundColor:'transparent',pointBorderColor:alphaColor(color),pointBorderWidth:1.15,pointRadius:2.5,pointHoverRadius:5,pointStyle:'circle',showLine:false,order:0,isRaw:true});
      });
      canvas.setAttribute('aria-label',surveyLabels[distributionSurvey]+' '+contract.domain+' component shares: '+stage);
      canvas.dataset.distributionRange=distributionRange;
      canvas.dataset.paperContract=JSON.stringify({view,stage,x_type:'linear',tension:0,span_gaps:false,x_range:xRange,source_x_range:contract.x_display_range,y_range:contract.y_display_range,x_breaks:xBreaks,y_breaks:contract.ybreaks,visible_points:visiblePoints,smooth_coordinates:lineCoordinates,categories:contract.category_order});
      distributionCharts.push(new Chart(canvas,{type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:false},tooltip:{filter:item=>item.dataset.isRaw,callbacks:{title:items=>items.length?'P'+num(100*items[0].parsed.x,1):'',label:item=>item.dataset.label+': '+pct(item.parsed.y)}}},scales:{
        x:{type:'linear',min:xRange[0],max:xRange[1],afterBuildTicks:axis=>{axis.ticks=xBreaks.map(value=>({value}));},grid:{color:'#ececf0'},border:{color:'#d9dce2'},title:{display:true,text:nipaBasket?'Percentile of consumption':contract.x_label,font:{family:'Arial, sans-serif',size:13}},ticks:{font:{family:'Arial, sans-serif',size:12},maxRotation:0,autoSkip:false,callback:value=>distributionRange==='top20'?'P'+Math.round(100*value):contract.x_format==='percent'?pct(value):Number(value).toFixed(1)}},
        y:{type:'linear',min:contract.y_display_range[0],max:contract.y_display_range[1],afterBuildTicks:axis=>{if(contract.ybreaks)axis.ticks=contract.ybreaks.map(value=>({value}));},grid:{color:'#ececf0'},border:{display:false},title:{display:true,text:nipaBasket?'Share of consumption':contract.y_label,font:{family:'Arial, sans-serif',size:13}},ticks:{font:{family:'Arial, sans-serif',size:12},autoSkip:false,callback:pct}}
      }}}));
    }
    const country=distributionCountry?' · '+(countryLabels.get(distributionCountry)||distributionCountry):'',weight=distributionSurvey==='PSID'?' · '+({scf_income:'SCF income weights',irs_income:'IRS income weights',scf_wealth:'SCF wealth weights'})[getWeightingMethod()]:'';
    $('adjustment-distribution-readout').textContent=surveyLabels[distributionSurvey]+country+' · '+distributionDomain+weight+' · '+(getHousingMethod()==='bp'&&['PSID','CEX_BM_RECON'].includes(distributionSurvey)?'constant-rate':'benchmark')+' homeowner services'+(distributionRange==='top20'?' · P80–P100':'');
    $('adjustment-distribution-csv').disabled=!points.length;$('adjustment-distribution-csv')._rows=[...points.map(row=>({kind:'raw_point',...row})),...smooth.map(row=>({kind:'smoothed_line',...row}))];
  }
  function refreshDistributionDomainChoices(){const select=$('adjustment-distribution-domain'),value=select.value;select.replaceChildren();[['consumption','Consumption'],['income','Income'],['wealth','Wealth']].filter(([key])=>distributionSurvey!=='CEX_BM_RECON'||key!=='income').forEach(([key,label])=>select.add(new Option(label,key)));select.value=value;}
  function renderDistribution(){
    refreshDistributionDomainChoices();
    const root=$('adjustment-distribution-results'),panel=root?.closest('[role="tabpanel"]');if(!root||$('panel-adjustments')?.hidden||panel?.hidden)return;
    $('composition-consumption-note').hidden=distributionSurvey!=='PSID'||distributionDomain!=='consumption';
    if(!compositionContracts.some(row=>row.survey===distributionSurvey)){renderLegacyDistribution();return;}
    const request=++compositionRequest;fillCountry('adjustment-distribution-country','adjustment-distribution-country-control',distributionSurvey,true);
    const available=compositionContracts.filter(row=>row.survey===distributionSurvey&&(!distributionCountry||row.country===distributionCountry)&&compositionMatches(row)),domains=new Set(available.map(row=>row.domain)),select=$('adjustment-distribution-domain');
    [...select.options].forEach(option=>option.disabled=!domains.has(option.value));if(!domains.has(distributionDomain)){distributionDomain=[...select.options].find(option=>!option.disabled)?.value||'consumption';select.value=distributionDomain;}
    const showDetail=distributionSurvey==='PSID'&&distributionDomain==='consumption';$('composition-detail-control').hidden=!showDetail;
    const view=distributionDomain==='consumption'?(showDetail?psidConsumptionView:'consumption'):distributionDomain,contracts=available.filter(row=>row.domain===distributionDomain&&row.view===view);
    if(!contracts.length){$('adjustment-distribution-readout').textContent='No composition results are available for this selection.';distributionCharts.forEach(chart=>chart.destroy());distributionCharts=[];return;}
    if(compositionPayloads.has(distributionSurvey)){drawComposition(compositionPayloads.get(distributionSurvey),contracts,view);return;}
    distributionCharts.forEach(chart=>chart.destroy());distributionCharts=[];$('composition-shared-legend').replaceChildren();root.querySelectorAll('.adjustment-distribution-card').forEach(card=>card.hidden=true);root.setAttribute('aria-busy','true');$('adjustment-distribution-readout').textContent='Loading component shares…';$('adjustment-distribution-csv').disabled=true;
    const survey=distributionSurvey;if(!compositionRequests.has(survey))compositionRequests.set(survey,Promise.resolve(context.loadComposition(survey)).then(value=>{compositionPayloads.set(survey,value);return value;}).catch(error=>{compositionRequests.delete(survey);throw error;}));
    compositionRequests.get(survey).then(()=>{if(request===compositionRequest)renderDistribution();}).catch(error=>{if(request===compositionRequest){root.removeAttribute('aria-busy');$('adjustment-distribution-readout').textContent='Component shares could not be loaded. Please try again.';}console.error(error);});
  }
  function download(rowsToSave,name){if(!rowsToSave?.length)return;const fields=[...new Set(rowsToSave.flatMap(Object.keys))],esc=x=>x===null||x===undefined?'':'"'+String(x).replace(/"/g,'""')+'"',csv=[fields.join(','),...rowsToSave.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  fillSurveySelectors();
  if(compositionContracts.length){
    const root=$('adjustment-distribution-results'),controls=root.querySelector('.adjustment-distribution-controls'),detail=document.createElement('div');detail.className='control';detail.id='composition-detail-control';detail.innerHTML='<label for="composition-detail">Consumption detail</label><select id="composition-detail"><option value="consumption_reduced">Grouped categories</option><option value="consumption">Detailed categories</option></select>';controls.append(detail);
    const range=document.createElement('div');range.className='control';range.innerHTML='<label for="composition-range">Distribution range</label><select id="composition-range"><option value="all">Full distribution</option><option value="top20">Top 20% (P80–P100)</option></select>';controls.append(range);
    const legend=document.createElement('ul');legend.id='composition-shared-legend';legend.className='composition-shared-legend';legend.setAttribute('aria-label','Component legend');root.querySelector('.adjustment-distribution-grid').before(legend);
    $('composition-detail').addEventListener('change',event=>{psidConsumptionView=event.target.value;renderDistribution();});
    $('composition-range').addEventListener('change',event=>{distributionRange=event.target.value;renderDistribution();});
  }
  $('adjustment-figure-survey').addEventListener('change',e=>{figureSurvey=e.target.value;figureCountry='';renderYears();});$('adjustment-figure-country').addEventListener('change',e=>{figureCountry=e.target.value;renderYears();});$('adjustment-figure-mode').addEventListener('change',e=>{figureMode=e.target.value;renderYears();});
  ['consumption','income','wealth'].forEach(domain=>$('adjustment-figure-'+domain+'-variable').addEventListener('change',e=>{selections[domain]=e.target.value;renderYears();}));
  $('adjustment-distribution-survey').addEventListener('change',e=>{distributionSurvey=e.target.value;distributionCountry='';renderDistribution();});$('adjustment-distribution-country').addEventListener('change',e=>{distributionCountry=e.target.value;renderDistribution();});$('adjustment-distribution-domain').addEventListener('change',e=>{distributionDomain=e.target.value;renderDistribution();});
  $('adjustment-figure-csv').addEventListener('click',e=>download(e.currentTarget._rows,(surveyLabels[figureSurvey]||figureSurvey)+'_adjustments_over_years.csv'));$('adjustment-distribution-csv').addEventListener('click',e=>download(e.currentTarget._rows,(surveyLabels[distributionSurvey]||distributionSurvey)+'_'+distributionDomain+'_adjustment_along_distribution.csv'));
  return{render:()=>{renderYears();renderDistribution();},resize:()=>{yearCharts.forEach(c=>c.resize());distributionCharts.forEach(c=>c.resize());}};
}
