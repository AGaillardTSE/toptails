function initOtherSurveys(other,context) {
  'use strict';
  const data=other||{},$=id=>document.getElementById(id),finite=x=>typeof x==='number'&&Number.isFinite(x);
  const unpack=t=>{if(Array.isArray(t))return t;if(t?.encoding==='array-pool-v1'){const rows=t.rows.map(values=>Object.fromEntries(t.columns.map((key,j)=>[key,values[j]])));t.array_refs.forEach(([i,j,id])=>rows[i][t.columns[j]]=t.vectors[id]);return rows;}const rows=t?.rows||[],columns=t?.columns||[];for(let i=0;i<rows.length;i++){const values=rows[i],row={};for(let j=0;j<columns.length;j++)row[columns[j]]=values[j];rows[i]=row;}return rows;};
  const outsideUS=row=>row.country!=='US'&&row.country_name!=='United States';
  let international=unpack(data.international).filter(outsideUS),bins=unpack(data.bivariate).filter(outsideUS),curves=unpack(data.curves).filter(outsideUS),long=unpack(data.long_results).filter(outsideUS);
  const allBinAvailability=bins;let relationshipAvailability=bins;
  const variables=[['consump_def1','Consumption'],['total_labor_income','Labor income'],['total_income','Total income'],['networth_val','Net worth'],['total_capital_income','Capital income']];
  const headlineVariables=variables.slice();
  const hbsAlternative={key:'hbs_consumption_excl_inkind',label:'Consumption excluding in-kind benefits'};
  if(long.some(row=>row.survey==='HBS'&&row.variable===hbsAlternative.key))variables.push([hbsAlternative.key,hbsAlternative.label]);
  const labels=Object.fromEntries(variables),adj={raw:'Raw data',adj:'Reporting adjusted',full:'Reporting + representation',reference:'Standalone reference'};
  // PSID/0_PSID_final_figures.R, series_cols (Consumption, Labor, Total income, Wealth, Capital).
  const variableColors={consump_def1:'#477EAD',total_labor_income:'#BF5555',total_income:'#A96F4B',networth_val:'#4D8B69',total_capital_income:'#C4A12A',hbs_consumption_excl_inkind:'#77569b'};
  const styles={HBS:{color:'#77569b',point:'crossRot'},HFCS:{color:'#2c5c88',point:'circle'},SHIW:{color:'#b34470',point:'rectRot'},HILDA:{color:'#25877d',point:'triangle'},PSID:{point:'rect'},SCF:{point:'star'},CEX_BM_RECON:{point:'triangle'},YODLEE:{point:'cross'},NIELSEN:{point:'crossRot'},FORBES:{point:'rectRounded'},SAEZ_ZUCMAN:{point:'rectRot'}};
  const strokeOnlyMarkers=new Set(['cross','crossRot','star']);
  const hbsLabels={consump_def1:'Consumption including in-kind benefits',total_income:'Net monetary household income'};
  const variableLabel=(variable,survey)=>survey==='HBS'?(hbsLabels[variable]||labels[variable]):labels[variable];
  const number=(x,d=3)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const percent=x=>finite(x)?number(100*x,1)+'%':'—',average=a=>{const x=a.filter(finite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;};
  const indicatorChoices=[['pareto','Pareto coefficient'],['ratio','Relative to that of wealth'],['gini','Gini'],['share_top20','Top share · P80'],['share_top10','Top share · P90'],['share_top5','Top share · P95'],['share_top1','Top share · P99']];
  const thresholdChoices=[['ks','KS selected'],['p80','P80'],['p90','P90'],['p95','P95'],['p98','P98'],['p99','P99'],['custom','Custom percentile']];
  const selectOptions=choices=>choices.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
  const isTailIndicator=indicator=>indicator==='pareto'||indicator==='ratio';
  const indicatorField=indicator=>({pareto:'estimate',ratio:'ratio_to_wealth'})[indicator]||indicator;
  const weightedAverage=(values,weights)=>{let total=0,weight=0;values.forEach((v,i)=>{const w=weights[i];if(finite(v)&&finite(w)&&w>0){total+=w*v;weight+=w;}});return weight>0?total/weight:null;};
  const range=a=>a.length?(a[0]===a[a.length-1]?String(a[0]):a[0]+'–'+a[a.length-1]):'';
  const getHousingMethod=context.getHousingMethod||(()=> 'benchmark'),housingMatches=context.housingMatches||(row=>(row.housing_method||'benchmark')==='benchmark'),rowMatches=row=>row.reference_only||housingMatches(row);
  const allInternational=international,allCurves=curves,allLong=long;let allBins=bins,relationshipBinsReady=!context.loadInternationalBins,relationshipBinsPromise;
  const key=r=>[r.survey,r.country,r.year,r.variant||r.specification,r.variable,r.housing_method||'benchmark'].join('|');
  const curveIndex=new Map(curves.map(r=>[key(r),r]));
  let waveRows=long.filter(r=>r.period_type!=='average'&&finite(r.year)&&labels[r.variable]);
  const annualIndex=new Map(waveRows.map(r=>[key(r),r.method].join('|')).map((k,i)=>[k,waveRows[i]]));
  const sourceNames=[...new Set(long.map(r=>r.survey))].sort(),summarySources=[...new Set([...international.map(row=>row.survey),...(context.usSurveys||[])])].sort();
  const summaryMeasures=[['auto','Survey benchmarks'],...(context.spendingOptions||[]).filter(option=>option.key!=='consump_def1').map(option=>[option.key,option.label])];
  const measureLabel=key=>key===hbsAlternative.key?hbsAlternative.label:key==='retail_expenditure'?'Retail purchases':summaryMeasures.find(([id])=>id===key)?.[1];
  let summaryData=[...international,...(context.getUSSummary?.('auto')||[])];
  function refreshHousing(){
    international=allInternational.filter(rowMatches);bins=allBins.filter(row=>housingMatches(row)&&(row.capital_income_definition||'benchmark')==='benchmark');relationshipAvailability=allBinAvailability.filter(row=>housingMatches(row)&&(row.capital_income_definition||'benchmark')==='benchmark');curves=allCurves.filter(rowMatches);long=allLong.filter(rowMatches);
    waveRows=long.filter(row=>row.period_type!=='average'&&finite(row.year)&&labels[row.variable]);
    curveIndex.clear();curves.forEach(row=>curveIndex.set(key(row),row));annualIndex.clear();waveRows.forEach(row=>annualIndex.set([key(row),row.method].join('|'),row));
  }
  const excluded=r=>r.benchmark_included===false||r.benchmark_included===0;
  const summary={dataset:'all',country:'all',period:'average',specification:'full',method:'MLE',measure:'auto',indicator:'pareto',threshold:'ks',q:.95,variables:new Set(headlineVariables.map(([key])=>key))};
  const hiddenSummaryCountries = new Map();
  let summaryUSLoad,summaryUSReady=false,summaryUSFailed=false;
  const time={survey:'all',country:'AU',adjustment:'full',method:'MLE',threshold:'ks',q:.95,indicator:'pareto',variables:new Set(headlineVariables.map(([key])=>key))};
  const results={survey:'all',country:'all',variable:'all',adjustment:'full',method:'MLE',threshold:'ks',q:.95,period:'both',page:0};
  const relationships={survey:bins.some(r=>r.survey==='HILDA')?'HILDA':bins[0]?.survey||'HFCS',country:'',pair:'wealth_consumption',adjustment:'full',stat:'mean',minN:5,scale:'loglog',fit:'ols',selectedByCountry:new Map(),waves:new Map()};
  const pairs={wealth_consumption:{x:'networth_val',y:'consump_def1'},income_consumption:{x:'total_income',y:'consump_def1'},labor_consumption:{x:'total_labor_income',y:'consump_def1'},capital_consumption:{x:'total_capital_income',y:'consump_def1'},wealth_capital:{x:'networth_val',y:'total_capital_income'}};
  let view='summary',summaryCharts=[],timeChart,timeRows=[],relationshipChart,thresholdController,thresholdLoad,eyeController,tableRows=[],plottedRows=[],tableSignature='';
  const panel=$('panel-other');
  panel.innerHTML=[
    '<nav class="secondary-nav cc-subnav" id="cc-secondary-nav" aria-label="Cross-country views"><div class="secondary-nav-inner" role="tablist">',
    '<button class="secondary-tab active" role="tab" aria-selected="true" data-country-view="summary" id="cc-tab-summary" aria-controls="cc-summary">Summary figure</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="time" id="cc-tab-time" aria-controls="cc-time">Tails over time</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="quantiles" id="cc-tab-quantiles" aria-controls="cc-quantiles">Tails by quantile</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="results" id="cc-tab-results" aria-controls="cc-results">Table of results</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="loglog" id="cc-tab-loglog" aria-controls="cc-loglog">Log–log relationships</button><button class="secondary-tab" role="tab" aria-selected="false" data-country-view="eyeballing" id="cc-tab-eyeballing" aria-controls="cc-eyeballing">Eyeballing Pareto Tails</button></div></nav>',
    '<section id="cc-summary" role="tabpanel" aria-labelledby="cc-tab-summary"><div class="other-card">',
    '<header class="other-card-heading"><h2>Cross-country comparison</h2><button class="text-button" id="cc-summary-csv">Results CSV</button></header>',
    '<div class="other-controls"><div class="control"><label for="cc-survey">Survey</label><select id="cc-survey"></select></div>',
    '<div class="control"><label for="cc-country">Country</label><select id="cc-country"></select></div>',
    '<div class="control"><label for="cc-period">Period</label><select id="cc-period"><option value="average">Across-wave average</option><option value="wave">By wave</option></select></div>',
    '<div class="control"><label for="cc-adjustment">Adjustment</label><select id="cc-adjustment"><option value="full">Reporting + representation</option><option value="adj">Reporting only</option><option value="raw">Raw data</option></select></div>',
    '<div class="control"><label for="cc-indicator">Indicator</label><select id="cc-indicator">'+selectOptions(indicatorChoices)+'</select></div>',
    '<div class="control"><label for="cc-method">Estimator</label><select id="cc-method"><option>MLE</option><option>OLS</option></select></div>',
    '<div class="control"><label for="cc-threshold">Tail threshold</label><select id="cc-threshold">'+selectOptions(thresholdChoices)+'</select></div>',
    '<div class="control" id="cc-custom-control" hidden><label for="cc-custom">Percentile</label><input id="cc-custom" type="number" min="70" max="99" step="1" value="95"></div>',
    '<div class="control"><label for="cc-measure">Variable for consumption</label><select id="cc-measure"></select></div></div>',
    '<div class="other-table-meta"><span id="cc-summary-indicator"></span><span id="cc-summary-count"></span></div>',
    '<div class="plot-series-controls"><span class="control-label series-label">Variables:</span><fieldset id="cc-variable-legend" class="series-bar" aria-label="Variables to display"></fieldset></div>',
    '<div id="cc-survey-legend" class="cc-survey-legend" role="group" aria-label="Survey symbols"></div>',
    '<div class="cc-country-actions" id="cc-country-actions" hidden><div class="cc-hidden-countries" id="cc-hidden-countries" hidden></div></div>',
    '<div class="cc-comparison-chart" id="cc-chart-grid"></div>',
    '<p id="cc-summary-empty" class="results-empty" hidden>No estimates are available for these filters.</p><p class="results-note" id="cc-summary-note"></p></div></section>',
    '<section id="cc-time" role="tabpanel" aria-labelledby="cc-tab-time" hidden><div class="other-card"><header class="other-card-heading"><div><h2 id="cc-t-title">Tails over time</h2></div><div class="chart-actions"><button class="text-button" id="cc-t-csv">Results CSV</button><button class="text-button" id="cc-t-png">Figure PNG</button></div></header>',
    '<div class="other-controls cc-time-controls"><div class="control"><label for="cc-t-country">Country</label><select id="cc-t-country"></select></div><div class="control"><label for="cc-t-survey">Survey</label><select id="cc-t-survey"></select></div><div class="control"><label for="cc-t-adjustment">Adjustment</label><select id="cc-t-adjustment"><option value="full">Reporting + representation</option><option value="adj">Reporting only</option><option value="raw">Raw data</option></select></div>',
    '<div class="control"><label for="cc-t-indicator">Indicator</label><select id="cc-t-indicator">'+selectOptions(indicatorChoices)+'</select></div><div class="control"><label for="cc-t-method">Pareto estimator</label><select id="cc-t-method"><option>MLE</option><option>OLS</option></select></div>',
    '<div class="control"><label for="cc-t-threshold">Tail threshold</label><select id="cc-t-threshold">'+selectOptions(thresholdChoices)+'</select></div><div class="control" id="cc-t-custom-control" hidden><label for="cc-t-custom">Percentile</label><input id="cc-t-custom" type="number" min="70" max="99" step="1" value="95"></div></div>',
    '<p class="plot-subtitle" id="cc-t-subtitle"></p>',
    '<div class="plot-series-controls"><span class="control-label series-label">Variables:</span><fieldset id="cc-t-variables" class="series-bar" aria-label="Variables to display"></fieldset></div>',
    '<div id="cc-t-survey-key" class="cc-survey-legend" role="group" aria-label="Survey symbols"></div><div class="chart-wrap cc-time-chart"><canvas id="cc-t-chart" role="img" aria-label="Upper-tail inequality over time"></canvas><p id="cc-t-empty" class="plot-fallback" hidden>No estimates are available for these filters.</p></div><p id="cc-t-note" class="results-note"></p></div></section>',
    '<section id="cc-quantiles" role="tabpanel" aria-labelledby="cc-tab-quantiles" hidden><div id="cc-quantile-profiles" class="quantile-profile-card"></div></section>',
    '<section id="cc-results" role="tabpanel" aria-labelledby="cc-tab-results" hidden><div class="results-card">',
    '<header class="results-heading"><div><h2>International results</h2></div><div class="results-actions"><button class="text-button" id="cc-results-csv">Selected results CSV</button><button class="text-button" id="cc-results-all">All international results CSV</button></div></header>',
    '<div class="results-controls"><div class="control"><label for="cc-r-survey">Survey</label><select id="cc-r-survey"></select></div><div class="control"><label for="cc-r-country">Country</label><select id="cc-r-country"></select></div>',
    '<div class="control"><label for="cc-r-variable">Variable</label><select id="cc-r-variable"></select></div><div class="control"><label for="cc-r-adjustment">Adjustment</label><select id="cc-r-adjustment"><option value="full">Reporting + representation</option><option value="adj">Reporting only</option><option value="raw">Raw data</option></select></div>',
    '<div class="control"><label for="cc-r-method">Estimator</label><select id="cc-r-method"><option>MLE</option><option>OLS</option></select></div>',
    '<div class="control"><label for="cc-r-threshold">Threshold</label><select id="cc-r-threshold"><option value="ks">KS selected</option><option value="p80">P80 · top 20%</option><option value="p90">P90 · top 10%</option><option value="p95">P95 · top 5%</option><option value="p98">P98 · top 2%</option><option value="custom">Custom percentile</option></select></div>',
    '<div class="control custom-threshold-control" id="cc-r-custom-control" hidden><label for="cc-r-custom">Percentile</label><input id="cc-r-custom" type="number" min="70" max="99" step="1" value="95"><span id="cc-r-custom-note" class="custom-threshold-note"></span></div>',
    '<div class="control"><label for="cc-r-period">Rows</label><select id="cc-r-period"><option value="both">Average, then all years</option><option value="average">Averages only</option><option value="wave">All years</option></select></div></div>',
    '<div class="results-count-row"><span id="cc-r-count"></span><div class="results-pagination"><button class="text-button" id="cc-r-prev">Previous</button><span id="cc-r-page"></span><button class="text-button" id="cc-r-next">Next</button></div></div>',
    '<div class="results-table-scroll" role="region" aria-label="International numerical results"><table id="cc-results-table"></table></div><p id="cc-r-status" class="results-status"></p><p id="cc-r-note" class="results-note"></p></div></section>',
    '<section id="cc-loglog" role="tabpanel" aria-labelledby="cc-tab-loglog" hidden><div class="explorer-grid">',
    '<aside class="sidebar" aria-label="International relationship controls">',
    '<div class="control"><label for="cc-b-country">Country</label><select id="cc-b-country"></select></div><div class="control"><span class="control-label">Datasets</span><fieldset id="cc-b-datasets" class="overlay-controls" aria-label="Datasets"></fieldset></div>',
    '<div class="control"><label for="cc-b-pair">Relationship</label><select id="cc-b-pair"><option value="wealth_consumption">Wealth → consumption</option><option value="income_consumption">Total income → consumption</option><option value="labor_consumption">Labor income → consumption</option><option value="capital_consumption">Capital income → consumption</option><option value="wealth_capital">Wealth → capital income</option></select></div>',
    '<div class="control"><label for="cc-b-adjustment">Adjustment</label><select id="cc-b-adjustment"><option value="full">Reporting + representation</option><option value="adj">Reporting only</option><option value="raw">Raw data</option></select></div>',
    '<div class="control bivariate-wave-selection"><span class="control-label">Wave selection</span><div class="bivariate-wave-rows" id="cc-b-waves"></div></div>',
    '<div class="control"><label for="cc-b-bin-min">Minimum observations per bin</label><select id="cc-b-bin-min"><option value="0">No minimum</option><option value="5" selected>5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option></select></div>',
    '<div class="relationship-settings"><div class="control"><label for="cc-b-stat">Bin statistic</label><select id="cc-b-stat"><option value="mean">Mean</option><option value="median">Median</option></select></div><div class="control"><label for="cc-b-scale">Axes</label><select id="cc-b-scale"><option value="loglog">Log–log</option><option value="levels">Levels</option></select></div></div>',
    '<div class="control"><label for="cc-b-fit">Fit</label><select id="cc-b-fit"><option value="ols">OLS</option><option value="nls">NLS</option><option value="none">No fit</option></select></div></aside>',
    '<div class="plot-surface"><div class="plot-top"><div><h2 id="cc-b-title"></h2><p class="plot-subtitle" id="cc-b-subtitle"></p></div><button class="text-button" id="cc-b-csv">Results CSV</button></div>',
    '<p class="slope-readout cc-b-readout" id="cc-b-readout"></p><p class="biv-tail-ratio" id="cc-b-tail-ratio"></p><div class="chart-wrap bivariate-chart"><canvas id="cc-b-chart" role="img"></canvas><p id="cc-b-empty" class="plot-fallback" hidden>No bivariate results are available for these filters.</p></div>',
    '<div id="cc-b-fits" class="fit-results"></div><p id="cc-b-note" class="results-note"></p></div></div></section>'
  ].join('');
  const timeWindow = createTimeWindow($('cc-t-chart'), renderTime);
  const eyeHost=document.createElement('section');eyeHost.id='cc-eyeballing';eyeHost.hidden=true;eyeHost.setAttribute('role','tabpanel');eyeHost.setAttribute('aria-labelledby','cc-tab-eyeballing');panel.append(eyeHost);eyeController=context.createEyeballing?.(eyeHost);
  function options(id,items,value){const el=$(id);el.replaceChildren();items.forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;el.append(o);});if(items.some(i=>i[0]===value))el.value=value;return el.value;}
  const sourceLabel=value=>(context.usSurveys||[]).includes(value)?(context.surveyName?.(value)||value):context.metadata?.surveys?.[value]?.label||value;
  const surveyDescriptions={
    HBS:context.metadata?.surveys?.HBS?.description||'Eurostat Household Budget Survey. Benchmark consumption includes in-kind benefits. HBS total income is net monetary household income. Coverage varies by country, wave and adjustment.',
    HFCS:'Household Finance and Consumption Survey: harmonized household surveys coordinated by the ECB, covering assets, debts, income and consumption across European countries.',
    HILDA:'Household, Income and Labour Dynamics in Australia: a longitudinal survey following Australian households, with information on income, spending and wealth.',
    SHIW:'Survey on Household Income and Wealth: Banca d’Italia’s survey of Italian households, covering income, saving and wealth.',
    PSID:'Panel Study of Income Dynamics: longitudinal U.S. household panel covering consumption, income and wealth.'
  };
  function surveyHelp(survey){const help=document.createElement('span');help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=surveyDescriptions[survey]||context.surveyTooltip?.(survey)||sourceLabel(survey);help.setAttribute('aria-label','About '+sourceLabel(survey));return help;}
  options('cc-survey',[['all','All surveys'],...summarySources.map(v=>[v,sourceLabel(v)])],summary.dataset);
  options('cc-measure',summaryMeasures,summary.measure);
  options('cc-r-survey',[['all','All surveys'],...sourceNames.map(v=>[v,sourceLabel(v)])],results.survey);
  options('cc-r-variable',[['all','All variables'],...variables],results.variable);
  function countries(id,survey,value,rows,allowAll=true){
    const map=new Map();rows.filter(r=>survey==='all'||r.survey===survey).forEach(r=>map.set(r.country,r.country_name||r.country));
    return options(id,[...(allowAll?[['all','All countries']]:[]),...[...map.entries()].sort((a,b)=>a[1].localeCompare(b[1]))],value);
  }
  summary.country=countries('cc-country',summary.dataset,summary.country,summaryData);
  results.country=countries('cc-r-country',results.survey,results.country,waveRows);
  relationships.country=countries('cc-b-country',relationships.survey,relationships.country,bins,false);
  function download(rows,name){
    if(!rows.length)return;rows=rows.map(row=>({...row,source_housing_method:row.housing_method||'benchmark',housing_method:getHousingMethod()}));const fields=[...new Set(rows.flatMap(Object.keys))],escape=v=>v===null||v===undefined?'':'"'+String(v).replace(/"/g,'""')+'"';
    const text=[fields.join(','),...rows.map(r=>fields.map(k=>escape(r[k])).join(','))].join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function active(){return !panel.hidden;}
  function changeView(value){view=value;panel.querySelectorAll('[data-country-view]').forEach(b=>{const on=b.dataset.countryView===value;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;b.classList.toggle('active',on);});['summary','time','quantiles','results','loglog','eyeballing'].forEach(v=>$('cc-'+v).hidden=v!==value);render();}
  panel.querySelectorAll('[data-country-view]').forEach(button=>{
    button.tabIndex=button.dataset.countryView===view?0:-1;button.addEventListener('click',()=>changeView(button.dataset.countryView));
    button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...panel.querySelectorAll('[data-country-view]')];let index=buttons.indexOf(button);index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[index].focus();changeView(buttons[index].dataset.countryView);});
  });
  function syncHBSStage(id, rows, selected, active) {
    const available=new Set(rows.map(row=>row.variant||row.specification));
    for(const option of $(id).options)option.disabled=active&&available.size>0&&!available.has(option.value);
    const result=active&&available.size>0&&!available.has(selected)
      ? ['full','adj','raw'].find(value=>available.has(value))||selected
      : selected;
    $(id).value=result;
    return result;
  }
  const availableHBSRows=(country,rows)=>rows.filter(row=>row.survey==='HBS'&&(country==='all'||row.country===country));
  const selectedHBSOnly=rows=>rows.length>0&&rows.every(row=>row.survey==='HBS');
  const lowerReliability=value=>value==='low_support';
  const reliabilityText=value=>lowerReliability(value)?'Low statistical reliability under Eurostat HBS guidance':'';
  function summaryRows(includeHidden=false){return summaryData.filter(r=>{
    const stage=r.specification||r.variant;
    return (includeHidden||!hiddenSummaryCountries.has(r.country))&&
      (summary.dataset==='all'||r.survey===summary.dataset)&&(summary.country==='all'||r.country===summary.country)&&r.period_type===summary.period&&
      (stage==='reference'||stage===(r.survey==='SCF'&&summary.specification==='full'?'adj':summary.specification))&&r.method===(isTailIndicator(summary.indicator)?summary.method:'MLE');
  });}
  function syncSummaryIndicators(hasUS) {
    const scoped=waveRows.filter(row=>(summary.dataset==='all'||row.survey===summary.dataset)&&
      (summary.country==='all'||row.country===summary.country)&&(row.variant||row.specification)===summary.specification);
    const usSurveys=hasUS?(context.usSurveys||[]).filter(survey=>summary.dataset==='all'||summary.dataset===survey):[];
    const householdUS=new Set(['PSID','SCF','CEX_BM_RECON']);
    const supports=(survey,indicator)=>householdUS.has(survey)||
      context.metadata?.surveys?.[survey]?.available_metrics?.includes(indicator==='ratio'?'pareto_wealth_ratio':indicator);
    const indicatorSelect=$('cc-indicator');
    for(const option of indicatorSelect.options){
      const indicator=option.value;
      option.disabled=indicator!=='pareto'&&!usSurveys.some(survey=>supports(survey,indicator))&&
        !(indicator==='ratio'?scoped.some(row=>row.variable==='networth_val'):scoped.some(row=>finite(row[indicator])));
    }
    if(indicatorSelect.querySelector('option[value="'+summary.indicator+'"]').disabled)summary.indicator='pareto';
    indicatorSelect.value=summary.indicator;
    const tailIndicator=isTailIndicator(summary.indicator),thresholdSelect=$('cc-threshold');
    const maxQ=!hasUS?98:summary.dataset==='FORBES'?90:99;
    for(const option of thresholdSelect.options)option.disabled=option.value.startsWith('p')&&Number(option.value.slice(1))>maxQ;
    if(thresholdSelect.querySelector('option[value="'+summary.threshold+'"]').disabled)summary.threshold='p'+maxQ;
    summary.q=Math.min(summary.q,maxQ/100);
    $('cc-custom').max=String(maxQ);
    $('cc-custom').value=String(Math.round(summary.q*100));
    $('cc-custom-control').hidden=!tailIndicator||summary.threshold!=='custom';
    thresholdSelect.disabled=$('cc-method').disabled=!tailIndicator;
    thresholdSelect.value=summary.threshold;
    $('cc-method').value=tailIndicator?summary.method:'MLE';
  }
  function summaryInternationalRows() {
    if(summary.indicator==='pareto'&&summary.threshold==='ks')return international;
    const tailIndicator=isTailIndicator(summary.indicator),field=indicatorField(summary.indicator);
    const records=resultData({survey:summary.dataset,country:summary.country,variable:'all',
      adjustment:summary.specification,period:summary.period,method:tailIndicator?summary.method:'MLE',
      threshold:tailIndicator?summary.threshold:'ks',q:summary.q,coverageField:field});
    const groups=new Map();
    for(const record of records){
      if(!finite(record[field]))continue;
      const id=[record.country,record.survey,record.variant,record.year].join('|');
      if(!groups.has(id)){
        const {country,country_name,survey,housing_method,period_type,period_label,year,variant,method}=record;
        groups.set(id,{country,country_name,survey,housing_method,period_type,period_label,year,specification:variant,method});
      }
      const group=groups.get(id),variable=record.variable;
      group[variable]=record[field];
      group[variable+'_waves']=record.metric_years||String(record.year);
      group[variable+'_n_waves']=group[variable+'_waves'].split(',').length;
      group[variable+'_reliability']=tailIndicator?record.reliability:null;
    }
    return [...groups.values()];
  }
  function prepareSummaryUS() {
    if(summaryUSReady||summaryUSFailed||!context.prepareUSSummaryThresholds)return;
    if(!summaryUSLoad){
      summaryUSLoad=context.prepareUSSummaryThresholds()
        .then(()=>{summaryUSReady=true;})
        .catch(error=>{summaryUSFailed=true;console.error(error);})
        .finally(()=>{summaryUSLoad=null;if(active()&&view==='summary')renderSummary();});
    }
    return summaryUSLoad;
  }
  function syncTimeControls(){
    time.country=countries('cc-t-country','all',time.country,waveRows,false);
    const surveys=[...new Set(waveRows.filter(row=>row.country===time.country).map(row=>row.survey))].sort();
    time.survey=options('cc-t-survey',[['all','All surveys'],...surveys.map(survey=>[survey,sourceLabel(survey)])],time.survey);
    const scoped=waveRows.filter(row=>row.country===time.country&&(time.survey==='all'||row.survey===time.survey));
    const hbsOnly=selectedHBSOnly(scoped);
    time.adjustment=syncHBSStage('cc-t-adjustment',scoped,time.adjustment,hbsOnly);
    for(const option of $('cc-t-indicator').options)option.disabled=hbsOnly&&option.value!=='pareto';
    if(hbsOnly&&time.indicator!=='pareto')time.indicator='pareto';
    $('cc-t-indicator').value=time.indicator;
    const p99=$('cc-t-threshold').querySelector('option[value="p99"]');
    if(p99)p99.disabled=hbsOnly;
    if(hbsOnly&&time.threshold==='p99')time.threshold='p98';
    $('cc-t-threshold').value=time.threshold;
    $('cc-t-custom').max=hbsOnly?'98':'99';
    if(hbsOnly&&time.q>.98){time.q=.98;$('cc-t-custom').value='98';}
  }
  function renderTime(){
    syncTimeControls();timeChart?.destroy();timeChart=null;
    const pareto=['pareto','ratio'].includes(time.indicator),field=time.indicator==='pareto'?'estimate':time.indicator==='ratio'?'ratio_to_wealth':time.indicator,scale=time.indicator.startsWith('share_')?100:1;
    const rows=resultData({...time,variable:'all',period:'wave',method:pareto?time.method:'MLE'}),available=rows.filter(row=>finite(row[field])),activeVariables=variables.filter(([variable])=>time.variables.has(variable));
    timeRows=available.filter(row=>time.variables.has(row.variable)).map(row=>{const date=SeriesYears.period(row);return{...row,observation_year:date.year,observation_period:date.label,year_basis:date.basis,indicator:time.indicator,value:row[field]};});
    const visibleYears = timeWindow.update(timeRows.map(row => row.observation_year));
    if (visibleYears) timeRows = timeRows.filter(row => row.observation_year >= visibleYears.from && row.observation_year <= visibleYears.to);
    const country=rows[0]?.country_name||$('cc-t-country').selectedOptions[0]?.textContent||'',indicatorTitle=time.indicator==='pareto'?'Pareto tail coefficients':time.indicator==='ratio'?'Pareto coefficients relative to wealth':time.indicator==='gini'?'Gini':$('cc-t-indicator').selectedOptions[0].textContent;
    const yTitle=time.indicator==='pareto'?'Pareto tail coefficient (ζ)':time.indicator==='ratio'?'Relative to wealth (ζₓ / ζₐ)':indicatorTitle+(scale===100?' (%)':'');
    $('cc-t-title').textContent=indicatorTitle+' over time';$('cc-t-subtitle').textContent=[country,adj[time.adjustment],pareto?time.method+' · '+(time.threshold==='ks'?'KS-selected thresholds':time.threshold==='custom'?'P'+Math.round(time.q*100):time.threshold.toUpperCase()):''].filter(Boolean).join(' · ');
    $('cc-t-method').disabled=!pareto;$('cc-t-threshold').disabled=!pareto;$('cc-t-custom-control').hidden=!pareto||time.threshold!=='custom';
    const legend=$('cc-t-variables');legend.replaceChildren();variables.filter(([key])=>rows.some(row=>row.variable===key)||key!==hbsAlternative.key&&time.survey!=='HBS'&&!selectedHBSOnly(rows)).forEach(([variable,title])=>{const item=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('span');item.className='series-choice';item.style.setProperty('--series',variableColors[variable]);input.type='checkbox';input.checked=time.variables.has(variable);input.disabled=!available.some(row=>row.variable===variable);const label=selectedHBSOnly(rows)?variableLabel(variable,'HBS'):title;input.setAttribute('aria-label',label);input.addEventListener('change',()=>{input.checked?time.variables.add(variable):time.variables.delete(variable);renderTime();});swatch.className='series-swatch';item.append(input,swatch,document.createTextNode(label));legend.append(item);});
    const surveys=[...new Set(timeRows.map(row=>row.survey))].sort(),surveyKey=$('cc-t-survey-key');surveyKey.replaceChildren();surveys.forEach(survey=>{const item=document.createElement('span'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 28 18');svg.setAttribute('aria-hidden','true');const dash=survey==='HILDA'?'4 3':survey==='SHIW'?'8 4':survey==='HBS'?'3 3':'',shape=survey==='HILDA'?'<path d="M14 3 20 14H8Z"/>':survey==='SHIW'?'<path d="M14 3 20 9 14 15 8 9Z"/>':survey==='HBS'?'<path d="M10 5l8 8m0-8-8 8" fill="none"/>':'<circle cx="14" cy="9" r="4.5"/>';svg.innerHTML='<path d="M1 9H27" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="'+dash+'"/>'+shape;svg.setAttribute('fill','#fffefa');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');item.append(svg,document.createTextNode(sourceLabel(survey)),surveyHelp(survey));surveyKey.append(item);});
    $('cc-t-empty').hidden=!!timeRows.length;$('cc-t-empty').textContent=visibleYears?'No estimates in the selected time window.':time.variables.size?'No estimates are available for these filters.':'Select at least one variable to display.';$('cc-t-csv').disabled=$('cc-t-png').disabled=!timeRows.length;
    const notes=[];if(pareto&&time.threshold==='ks')notes.push('Each coefficient uses its own KS-selected threshold.');if(pareto&&time.threshold!=='ks')notes.push('Only available estimates at the selected percentile are shown.');notes.push('Dates follow each series’ reference period; survey waves appear in tooltips.');if(surveys.includes('HFCS'))notes.push('HFCS is shown by survey wave because reference periods differ across countries and variables.');if(surveys.includes('HILDA'))notes.push('HILDA income refers to the financial year ending in the displayed year.');if(timeRows.some(row=>lowerReliability(row.reliability)))notes.push('Larger symbols mark HBS estimates with low statistical reliability.');$('cc-t-note').textContent=notes.join(' ');
    const canvas=$('cc-t-chart');canvas.dataset.observationYears=JSON.stringify(timeRows.map(row=>({survey:row.survey,variable:row.variable,year:row.observation_year,wave:row.year,value:row.value})));if(!timeRows.length)return;
    const datasets=[];activeVariables.forEach(([variable,title])=>surveys.forEach(survey=>{const points=timeRows.filter(row=>row.variable===variable&&row.survey===survey).sort((a,b)=>a.observation_year-b.observation_year).map(row=>({x:row.observation_year,y:scale*row.value,row}));if(!points.length)return;const color=variableColors[variable];datasets.push({label:title+' · '+sourceLabel(survey),survey,variable,data:points,borderColor:color,backgroundColor:color,pointBackgroundColor:'#fffefa',pointBorderColor:color,pointStyle:styles[survey]?.point||'circle',pointRadius:point=>lowerReliability(point.raw?.row?.reliability)?7:survey==='HILDA'?5:4,pointHoverRadius:7,borderWidth:1.6,borderDash:survey==='HILDA'?[4,3]:survey==='SHIW'?[8,4]:survey==='HBS'?[3,3]:[],tension:0,showLine:true});}));
    canvas.setAttribute('aria-label',yTitle+' over time in '+country);
    timeChart=new Chart(canvas,{type:'scatter',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items.length?country+' · '+sourceLabel(items[0].raw.row.survey):'',label:item=>variableLabel(item.raw.row.variable,item.raw.row.survey)+': '+number(item.raw.y)+(scale===100?'%':''),afterLabel:item=>[SeriesYears.period(item.raw.row).detail||('Survey wave '+item.raw.row.year),reliabilityText(item.raw.row.reliability)].filter(Boolean)}}},scales:{x:{type:'linear',min:visibleYears.from-.6,max:visibleYears.to+.6,title:{display:true,text:surveys.includes('HFCS')?'Reference year / HFCS wave':'Reference year',font:{size:13}},ticks:{precision:0,maxTicksLimit:10,includeBounds:false,callback:value=>Number.isInteger(value)?String(value):'',font:{size:13}},grid:{color:'#eeece7'}},y:{type:'linear',min:0,title:{display:true,text:yTitle,font:{size:13}},ticks:{font:{size:13}},grid:{color:'#eeece7'}}}}});
  }
  function focusSummaryCountry(country) {
    const labels = [...$('cc-chart-grid').querySelectorAll('.cc-country-label')];
    const visible = labels.find(button => button.dataset.country === country);
    const restore = [...$('cc-hidden-countries').querySelectorAll('button')]
      .find(button => button.dataset.country === country);
    (visible || restore || labels[0] || $('cc-country')).focus({preventScroll:true});
  }
  function renderHiddenSummaryCountries() {
    const controls = $('cc-hidden-countries');
    controls.replaceChildren();
    controls.hidden = hiddenSummaryCountries.size === 0;
    $('cc-country-actions').hidden = controls.hidden;
    if (controls.hidden) return;
    const label = document.createElement('span');
    label.textContent = 'Hidden countries';
    controls.append(label);
    for (const [code, country] of [...hiddenSummaryCountries].sort((a,b) => a[1].localeCompare(b[1]))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-button';
      button.dataset.country = code;
      button.textContent = country + ' +';
      button.setAttribute('aria-label', 'Restore ' + country);
      button.addEventListener('click', () => {
        hiddenSummaryCountries.delete(code);
        renderSummary();
        focusSummaryCountry(code);
      });
      controls.append(button);
    }
    if (hiddenSummaryCountries.size > 1) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'text-button';
      reset.textContent = 'Restore all';
      reset.addEventListener('click', () => {
        hiddenSummaryCountries.clear();
        renderSummary();
        focusSummaryCountry();
      });
      controls.append(reset);
    }
  }
  function arrangeSummaryPoints(countryRows, xMin, xMax, plotWidth, laneSpacing) {
    // Separate nearby points within each country while preserving the estimate on the horizontal axis.
    const pixelsPerUnit=plotWidth/(xMax-xMin);
    let nextRow=0;
    for(const row of countryRows.values()){
      const laneEnds=[];
      const placements=row.points.sort((a,b)=>a.x-b.x).map(point=>{
        const x=(point.x-xMin)*pixelsPerUnit, clearance=point.radius+2;
        let lane=laneEnds.findIndex(end=>end<=x-clearance);
        if(lane===-1)lane=laneEnds.length;
        laneEnds[lane]=x+clearance;
        return {point,lane};
      });
      const rowHeight=Math.max(40,laneEnds.length*laneSpacing+8);
      row.center=nextRow+rowHeight/2;
      for(const {point,lane} of placements)point.y=row.center+(lane-(laneEnds.length-1)/2)*laneSpacing;
      nextRow+=rowHeight;
    }
    return nextRow;
  }
  function renderSummary(){
    const selectableUS=(context.usSurveys||[]).map(survey=>({survey,country:'US',country_name:'United States'}));
    summary.country=countries('cc-country',summary.dataset,summary.country,[...international,...selectableUS]);
    const hasUS=(summary.country==='all'||summary.country==='US')&&(summary.dataset==='all'||(context.usSurveys||[]).includes(summary.dataset));
    const hbsSelected=summary.dataset==='HBS';
    const hasHBSAlternative=hbsSelected&&availableHBSRows(summary.country,international).some(row=>finite(row[hbsAlternative.key]));
    if(hbsSelected?summary.measure!==hbsAlternative.key||!hasHBSAlternative:!hasUS||summary.measure===hbsAlternative.key)summary.measure='auto';
    summary.specification=syncHBSStage('cc-adjustment',hbsSelected?availableHBSRows(summary.country,international):[],summary.specification,hbsSelected);
    syncSummaryIndicators(hasUS);
    const tailIndicator=isTailIndicator(summary.indicator);
    const needsUSCurves=hasUS&&tailIndicator&&summary.threshold!=='ks';
    const pendingUS=needsUSCurves&&!!prepareSummaryUS();
    const usRows=hasUS&&!pendingUS&&!(needsUSCurves&&summaryUSFailed)?context.getUSSummary?.(summary.measure,summary)||[]:[];
    const intlEstimates=summaryInternationalRows();
    const internationalRows=summary.measure==='auto'?intlEstimates:intlEstimates.map(row=>{
      if(hbsSelected&&row.survey==='HBS')return {...row,consump_def1:row[hbsAlternative.key],consump_def1_n_waves:row[hbsAlternative.key+'_n_waves'],consump_def1_waves:row[hbsAlternative.key+'_waves'],consump_def1_reliability:row[hbsAlternative.key+'_reliability'],consumption_measure:hbsAlternative.key};
      return {...row,consump_def1:null,n_waves_c:0};
    });
    summaryData=[...internationalRows,...usRows];
    const hbsMeasures=[['auto','Consumption including in-kind benefits'],...(hasHBSAlternative?[[hbsAlternative.key,hbsAlternative.label]]:[])];
    summary.measure=options('cc-measure',hbsSelected?hbsMeasures:summaryMeasures,summary.measure);
    $('cc-measure').disabled=(!hasUS&&!hasHBSAlternative)||!summary.variables.has('consump_def1')||summary.dataset==='NIELSEN';
    $('cc-adjustment').disabled=['FORBES','NIELSEN','YODLEE','SAEZ_ZUCMAN'].includes(summary.dataset);
    const rows=summaryRows(),activeVariables=variables.filter(([key])=>summary.variables.has(key));summaryCharts.forEach(c=>c.destroy());summaryCharts=[];
    const grid=$('cc-chart-grid');grid.replaceChildren();
    const hasSelectedEstimates = row => activeVariables.some(([variable])=>finite(row[variable]));
    const displayed = pendingUS?[]:rows.filter(hasSelectedEstimates);
    const empty = $('cc-summary-empty');
    empty.textContent = pendingUS?'Loading U.S. estimates…':needsUSCurves&&summaryUSFailed&&!displayed.length?'U.S. estimates could not be loaded.':
      hiddenSummaryCountries.size&&!displayed.length&&summaryRows(true).some(hasSelectedEstimates)?'No countries are shown.':'No estimates are available for these filters.';
    renderHiddenSummaryCountries();
    const names=[...new Map(displayed.map(r=>[r.country,r])).values()].sort((a,b)=>a.country_name.localeCompare(b.country_name));
    const countryRows=new Map(names.map(row=>[row.country,{points:[],label:row.country_name}]));
    const surveys=summarySources.filter(survey=>displayed.some(r=>r.survey===survey));
    const byWave=summary.period==='wave';
    const markerRadius=byWave?{standard:3.5,hilda:4.5,lowSupport:5.5}:{standard:5,hilda:7.5,lowSupport:8};
    const unit='country–survey'+(byWave?'–wave estimates':' averages');
    const indicatorLabel=indicatorChoices.find(([key])=>key===summary.indicator)[1];
    const thresholdLabel=summary.threshold==='ks'?'KS selected':summary.threshold==='custom'?'P'+Math.round(100*summary.q):summary.threshold.toUpperCase();
    $('cc-summary-indicator').textContent=[indicatorLabel,...(tailIndicator?[summary.method,thresholdLabel]:[])].join(' · ');
    const share=summary.indicator.startsWith('share_');
    const axisLabel=summary.indicator==='pareto'?'Pareto tail coefficient (ζ)':summary.indicator==='ratio'?'Relative to wealth (ζₓ / ζₐ)':
      summary.indicator==='gini'?'Gini coefficient':indicatorLabel+' (%)';
    const formatEstimate=(value,digits)=>share?percent(value):number(value,digits);
    empty.hidden=!!displayed.length;$('cc-summary-count').textContent=displayed.length+' '+unit;$('cc-summary-csv').disabled=!displayed.length;
    const variableLegend=$('cc-variable-legend'),surveyLegend=$('cc-survey-legend');
    variableLegend.replaceChildren();surveyLegend.replaceChildren();
    const icon=(point,color)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');const cross='<path d="M7 2H9V7H14V9H9V14H7V9H2V7H7Z"/>',shapes={circle:'<circle cx="8" cy="8" r="4.5"/>',rectRot:'<path d="M8 2 14 8 8 14 2 8Z"/>',triangle:'<path d="M8 2 14 13H2Z"/>',rect:'<path d="M3 3H13V13H3Z"/>',rectRounded:'<rect x="3" y="3" width="10" height="10" rx="3"/>',cross,crossRot:'<g transform="rotate(45 8 8)">'+cross+'</g>',star:'<path d="M2 8H14M8 2V14M3.8 3.8l8.4 8.4m0-8.4-8.4 8.4" stroke="currentColor" stroke-width="1.8"/>'};svg.innerHTML=shapes[point]||shapes.rect;svg.setAttribute('fill',color);svg.style.color=color;return svg;};
    headlineVariables.forEach(([variable,title])=>{const item=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('span');item.className='series-choice';item.style.setProperty('--series',variableColors[variable]);input.type='checkbox';input.value=variable;input.checked=summary.variables.has(variable);input.disabled=!rows.some(row=>finite(row[variable]));const displayTitle=variable==='consump_def1'&&summary.measure!=='auto'?(measureLabel(summary.measure)||title):title;input.setAttribute('aria-label',displayTitle);swatch.className='series-swatch';swatch.style.backgroundColor=variableColors[variable];input.addEventListener('change',()=>{input.checked?summary.variables.add(variable):summary.variables.delete(variable);renderSummary();});item.append(input,swatch,document.createTextNode(displayTitle));variableLegend.append(item);});
    surveys.forEach(survey=>{const item=document.createElement('span');item.append(icon(styles[survey]?.point||'rect','#5f6875'),document.createTextNode(sourceLabel(survey)),surveyHelp(survey));surveyLegend.append(item);});
    if(!displayed.length){$('cc-summary-note').textContent=activeVariables.length?'':'Select at least one variable to display.';return;}
    const wrap=document.createElement('div');wrap.className='cc-comparison-wrap';
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',axisLabel+' across countries. Color identifies the variable and shape identifies the survey. Long dashes show means across countries and short dashes show medians across countries.');wrap.append(canvas);grid.append(wrap);
    const countryAxis = document.createElement('div');
    countryAxis.className = 'cc-country-axis';
    countryAxis.setAttribute('role', 'group');
    countryAxis.setAttribute('aria-label', 'Countries in the plot');
    const countryHint=document.createElement('p');
    countryHint.id='cc-country-hide-hint';
    countryHint.textContent='Select a country name to hide it.';
    countryAxis.append(countryHint);
    wrap.append(countryAxis);
    const countryButtons = names.map(({country,country_name}, index) => {
      const button = document.createElement('button');
      button.className = 'cc-country-label';
      button.type = 'button';
      button.dataset.country = country;
      button.setAttribute('aria-label', 'Hide ' + country_name);
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '×';
      button.append(country_name, mark);
      button.addEventListener('click', () => {
        hiddenSummaryCountries.set(country,country_name);
        renderSummary();
        focusSummaryCountry(names[index + 1]?.country || names[index - 1]?.country || country);
      });
      countryAxis.append(button);
      return button;
    });
    const countryAxisPlugin = {
      id:'ccCountryButtons',
      afterLayout(chart) {
        countryAxis.style.width = Math.max(0, chart.chartArea.left - 13) + 'px';
        for (const button of countryButtons) {
          button.style.top = chart.scales.y.getPixelForValue(countryRows.get(button.dataset.country).center) + 'px';
        }
      }
    };
    const datasets=[],referenceMarks=[];
    activeVariables.forEach(([variable,title])=>{
      const color=variableColors[variable];
      surveys.forEach(survey=>{
        const style=styles[survey]||{point:'rect'},subset=displayed.filter(r=>r.survey===survey&&finite(r[variable]));if(!subset.length)return;
        const points=subset.map(r=>{
          const reliability=r[variable+'_reliability'];
          const point={x:r[variable],radius:lowerReliability(reliability)?markerRadius.lowSupport:survey==='HILDA'?markerRadius.hilda:markerRadius.standard,country_name:r.country_name,survey,variable,period_label:r.period_label,stage:r.specification||r.variant,reliability,contributing_waves:r[variable+'_waves'],consumption_measure:r.consumption_measure,n_waves:r[variable+'_n_waves']??r['n_waves_'+({consump_def1:'c',networth_val:'wealth',total_income:'income',total_labor_income:'labor',total_capital_income:'capital'})[variable]]??r.n_waves};
          countryRows.get(r.country).points.push(point);
          return point;
        });
        const strokeOnly=strokeOnlyMarkers.has(style.point);
        datasets.push({label:title+' · '+survey,pointStyle:style.point,borderColor:color,backgroundColor:color,pointBorderColor:strokeOnly?color:'#fffefa',pointBorderWidth:strokeOnly?1.8:.7,pointRadius:context=>context.raw?.radius??5,pointHoverRadius:context=>(context.raw?.radius??5)+2,clip:{left:10,right:0,top:0,bottom:0},data:points});
      });
      const byCountry=new Map();displayed.filter(r=>finite(r[variable])).forEach(r=>{if(!byCountry.has(r.country))byCountry.set(r.country,[]);byCountry.get(r.country).push(r[variable]);});
      const values=[...byCountry.values()].map(average).sort((a,b)=>a-b);if(!values.length)return;
      const mid=Math.floor(values.length/2),references={mean:average(values),median:values.length%2?values[mid]:(values[mid-1]+values[mid])/2};
      ['mean','median'].forEach(kind=>{
        const value=references[kind];datasets.push({type:'line',label:title+' '+kind+' '+formatEstimate(value),data:[{x:value,y:0},{x:value,y:0}],borderColor:color+'b3',borderDash:kind==='mean'?[8,5]:[3,4],borderWidth:1.4,pointRadius:0,order:2,isReference:true});
        referenceMarks.push({variable,title,kind,value,color});
      });
    });
    canvas.dataset.variables=JSON.stringify(activeVariables.map(([variable])=>variable));
    const estimates=[...countryRows.values()].flatMap(row=>row.points.map(point=>point.x));
    const axisMinimum=Math.min(summary.indicator==='pareto'?.75:0,...estimates);
    const ticksPerUnit=share?20:10;
    const axisMaximum=Math.ceil(ticksPerUnit*Math.max(tailIndicator?1:.1,...estimates)*1.04)/ticksPerUnit;
    const compact=canvas.parentElement.clientWidth<550,referenceFontSize=compact?11:13;
    const rightPadding=compact?14:22,wrapAxes=compact||window.innerWidth<1100;
    wrap.style.setProperty('--cc-axis-font',referenceFontSize+'px');
    const referenceGap=referenceFontSize+4;
    // Reserve enough room for country buttons and the full circle or stroke at the left bound.
    const labelContext=canvas.getContext('2d');
    labelContext.save();
    labelContext.font=referenceFontSize+'px Arial, sans-serif';
    const countryLabelWidth=Math.ceil(Math.max(...names.map(row=>labelContext.measureText(row.country_name).width)))+38;
    const chartWidth=wrap.clientWidth,innerWidth=Math.max(1,chartWidth-countryLabelWidth-rightPadding);
    const plotHeight=arrangeSummaryPoints(countryRows,axisMinimum,axisMaximum,Math.max(1,innerWidth-8),byWave?14:20);
    const countryLabels=new Map([...countryRows.values()].map(row=>[row.center,row.label]));
    datasets.filter(dataset=>dataset.isReference).forEach(dataset=>{dataset.data[1].y=plotHeight;});
    const tickFormat=new Intl.NumberFormat('en-US',share?{style:'percent',maximumFractionDigits:1}:{maximumFractionDigits:3});
    const horizontalTicks={display:false,maxTicksLimit:compact?5:8,callback:value=>tickFormat.format(value)};
    const fitHorizontalAxis=scale=>{scale.height+=axisHeaders[scale.id==='xTop'?'mean':'median'].height;};
    const axisHeaders={};
    const centerLabel=(x,half,width)=>Math.max(half+3,Math.min(width-half-3,x));
    labelContext.font='600 '+referenceFontSize+'px Arial, sans-serif';
    for(const kind of ['mean','median']){
      const top=kind==='mean',caption=document.createElement('p');
      const note=(top?'Long dashes show means':'Short dashes show medians')+(compact?'':' across countries');
      caption.className='cc-axis-caption';
      caption.append(axisLabel,wrapAxes?document.createElement('br'):' ',wrapAxes?note:'('+note+')');
      wrap.append(caption);
      const edges=[];
      const marks=referenceMarks.filter(mark=>mark.kind===kind).sort((a,b)=>a.value-b.value).map(mark=>{
        const label=(top?'Mean: ':'Median: ')+formatEstimate(mark.value,2),half=labelContext.measureText(label).width/2;
        const plotX=countryLabelWidth+innerWidth*(mark.value-axisMinimum)/(axisMaximum-axisMinimum);
        const x=centerLabel(plotX,half,chartWidth);
        let lane=edges.findIndex(edge=>edge+5<=x-half);
        if(lane===-1)lane=edges.length;
        edges[lane]=x+half;
        return {...mark,label,half,lane};
      });
      const tickGap=9+edges.length*referenceGap;
      axisHeaders[kind]={caption,marks,tickGap,height:tickGap+referenceFontSize+7+(wrapAxes?2:1)*referenceGap+3};
    }
    labelContext.restore();
    wrap.style.height=Math.max(450,plotHeight+axisHeaders.mean.height+axisHeaders.median.height+24)+'px';
    const axisReferencePlugin={
      id:'ccAxisReferences',
      afterDraw(chart){
        const {ctx,chartArea:area}=chart;
        for(const mark of [...axisHeaders.mean.marks,...axisHeaders.median.marks]){
          const isMean=mark.kind==='mean',scale=isMean?chart.scales.xTop:chart.scales.x;
          const x=scale.getPixelForValue(mark.value),y=isMean?area.top:area.bottom;
          ctx.save();
          ctx.fillStyle=mark.color;
          ctx.strokeStyle='#fffefa';
          ctx.lineWidth=2;
          if(isMean){
            ctx.beginPath();
            ctx.arc(x,y,5,0,Math.PI*2);
            ctx.fill();
            ctx.stroke();
          }else{
            ctx.save();
            ctx.translate(x,y);
            ctx.rotate(Math.PI/4);
            ctx.fillRect(-4.5,-4.5,9,9);
            ctx.strokeRect(-4.5,-4.5,9,9);
            ctx.restore();
          }
          ctx.font='600 '+referenceFontSize+'px Arial, sans-serif';
          ctx.textAlign='center';
          ctx.textBaseline=isMean?'bottom':'top';
          const labelX=centerLabel(x,mark.half,chart.width);
          const offset=7+mark.lane*referenceGap,labelY=isMean?y-offset:y+offset;
          ctx.lineWidth=3;
          ctx.strokeText(mark.label,labelX,labelY);
          ctx.fillText(mark.label,labelX,labelY);
          ctx.restore();
        }
        ctx.save();
        ctx.fillStyle='#66717e';
        ctx.font=referenceFontSize+'px Arial, sans-serif';
        ctx.textAlign='center';
        for(const [kind,scale] of [['mean',chart.scales.xTop],['median',chart.scales.x]]){
          const {caption,tickGap}=axisHeaders[kind],top=kind==='mean';
          const y=top?area.top-tickGap:area.bottom+tickGap;
          ctx.textBaseline=top?'bottom':'top';
          const ticks=scale.ticks.map(tick=>{
            const text=String(tick.label),half=ctx.measureText(text).width/2;
            return {text,half,x:centerLabel(scale.getPixelForValue(tick.value),half,chart.width)};
          });
          let previousEdge=-Infinity;
          ticks.forEach(({text,half,x},index)=>{
            const last=ticks.at(-1);
            if(index>0&&index<ticks.length-1&&(x-half<previousEdge+5||x+half>last.x-last.half-5))return;
            ctx.fillText(text,x,y);
            previousEdge=x+half;
          });
          caption.style.left=area.left+'px';
          caption.style.width=area.width+'px';
          const captionTop=top?y-referenceFontSize-7-caption.offsetHeight:y+referenceFontSize+7;
          caption.style.top=captionTop+'px';
          if(top)countryHint.style.top=captionTop+'px';
        }
        ctx.restore();
      }
    };
    summaryCharts.push(new Chart(canvas,{type:'scatter',data:{datasets},plugins:[axisReferencePlugin,countryAxisPlugin],options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:5,right:rightPadding,bottom:3}},plugins:{legend:{display:false},tooltip:{filter:item=>!item.dataset.isReference,callbacks:{title:items=>items.length?items[0].raw.country_name+' · '+sourceLabel(items[0].raw.survey):'',label:ctx=>((ctx.raw.variable==='consump_def1'&&measureLabel(ctx.raw.consumption_measure))||labels[ctx.raw.variable])+': '+formatEstimate(ctx.raw.x),afterLabel:ctx=>[ctx.raw.period_label,ctx.raw.contributing_waves?'Waves: '+ctx.raw.contributing_waves.split(/[,;]\s*/).join(', '):ctx.raw.n_waves+' available wave(s)',(tailIndicator?summary.method+' · '+thresholdLabel+' · ':'')+adj[ctx.raw.stage],reliabilityText(ctx.raw.reliability)].filter(Boolean)}}},scales:{xTop:{type:'linear',position:'top',min:axisMinimum,max:axisMaximum,grid:{drawOnChartArea:false},border:{color:'#cfd3da'},afterFit:fitHorizontalAxis,ticks:horizontalTicks},x:{type:'linear',position:'bottom',min:axisMinimum,max:axisMaximum,grid:{color:'#eeece7'},border:{color:'#cfd3da'},afterFit:fitHorizontalAxis,ticks:horizontalTicks},y:{type:'linear',reverse:true,min:0,max:plotHeight,afterFit:axis=>{axis.width=countryLabelWidth;},afterBuildTicks:axis=>axis.ticks=[...countryLabels.keys()].reverse().map(value=>({value})),grid:{color:'#eeece7',drawTicks:false},border:{display:false},ticks:{autoSkip:false,color:'transparent',padding:compact?7:12,font:{size:referenceFontSize},callback:v=>countryLabels.get(v)||''}}}}}));
    $('cc-summary-note').textContent=(names.length>1?'Each country receives equal weight. Surveys and available waves are averaged within country. ':'')+'Coverage varies by variable.'
      +(surveys.includes('HILDA')?' HILDA wealth is available in five waves.':'')
      +(summary.measure==='auto'&&surveys.includes('SCF')?' SCF contributes total expenditure including imputed rent in 2025.':'')
      +(summary.measure!== 'auto'&&!hbsSelected?' The selected consumption measure is shown for U.S. datasets.':'')
      +(surveys.includes('HBS')?' HBS total income is net monetary household income.':'')
      +(summary.indicator==='ratio'?' Wealth-relative estimates use waves with both coefficients.':'')
      +(needsUSCurves&&summaryUSFailed?' U.S. estimates could not be loaded.':'')
      +(datasets.some(dataset=>dataset.data.some(point=>lowerReliability(point.reliability)))?' Larger symbols mark HBS estimates with low statistical reliability.':'')
      +' See Variable Construction & Sample for survey methods and adjustments.';
  }
  function tail(row,method,rule,q){
    const base=annualIndex.get([key(row),method].join('|')),curve=curveIndex.get(key(row)),m=method.toLowerCase();
    if(rule==='ks'){
      const fit=curve?.['ks_'+m];
      if(fit!==undefined)return{estimate:fit?.estimate??null,q:fit?.q??null,maxks:fit?.maxks??null,n_tail:fit?.n_tail??null,reliability:fit?.reliability??base?.reliability??null};
      return{estimate:finite(base?.estimate)?base.estimate:null,q:finite(base?.q_ks)?base.q_ks:base?.q??null,maxks:base?.maxks??base?.ks??null,n_tail:base?.n_tail??null,reliability:base?.reliability??null};
    }
    const cutoff=rule==='custom'?q:Number(rule.slice(1))/100;const index=curve?.qs?.findIndex(v=>Math.abs(v-cutoff)<1e-7)??-1;
    return{estimate:index>=0?curve[m]?.[index]??null:null,q:cutoff,maxks:index>=0?curve['maxks_'+m]?.[index]??null:null,n_tail:index>=0?curve.n_tail?.[index]??null:null,reliability:index>=0?curve.reliability_by_threshold?.[index]??null:null};
  }
  function resultData(filter=results){
    const records=waveRows.filter(r=>r.method===filter.method&&(filter.survey==='all'||r.survey===filter.survey)&&(filter.country==='all'||r.country===filter.country)&&(filter.variable==='all'||r.variable===filter.variable)&&(r.variant||r.specification)===filter.adjustment);
    const years=records.map(r=>{const fit=tail(r,filter.method,filter.threshold,filter.q),wealth={...r,variable:'networth_val'},w=tail(wealth,filter.method,filter.threshold,filter.q),population=curveIndex.get(key(r))?.population_weight??r.population_weight??null;return{country:r.country,country_name:r.country_name,survey:r.survey,housing_method:r.housing_method||'benchmark',period_type:'wave',period_label:String(r.year),year:r.year,variant:r.variant||r.specification,variable:r.variable,method:filter.method,threshold:filter.threshold,threshold_quantile:fit.q,estimate:fit.estimate,maxks:fit.maxks,n_tail:fit.n_tail,reliability:fit.reliability,n_obs:r.n_obs??null,population_weight:population,estimator_aggregation:'Wave estimate',n_waves:finite(fit.estimate)?1:0,n_waves_available:1,ratio_to_wealth:finite(fit.estimate)&&finite(w.estimate)&&w.estimate>0?fit.estimate/w.estimate:null,n_waves_ratio:finite(fit.estimate)&&finite(w.estimate)&&w.estimate>0?1:0,gini:r.gini??null,share_top20:r.share_top20??null,share_top10:r.share_top10??null,share_top5:r.share_top5??null,share_top1:r.share_top1??null};});
    const groups=new Map();years.forEach(r=>{const k=[r.survey,r.country,r.housing_method||'benchmark',r.variant,r.variable].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const averages=[...groups.values()].map(group=>{
      const ordered=group.slice().sort((a,b)=>a.year-b.year),populationWeighted=ordered[0].survey==='HFCS',validWeight=r=>!populationWeighted||(finite(r.population_weight)&&r.population_weight>0),weights=ordered.map(r=>r.population_weight),aggregate=k=>populationWeighted?weightedAverage(ordered.map(r=>r[k]),weights):average(ordered.map(r=>r[k])),paired=ordered.map(r=>({r,w:tail({...r,variable:'networth_val'},filter.method,filter.threshold,filter.q)})).filter(({r,w})=>finite(r.estimate)&&finite(w.estimate)&&w.estimate>0&&validWeight(r)),a={...ordered[0],period_type:'average',year:null,period_label:range(ordered.map(r=>r.year))+' average',population_weight:null,aggregation_weight_sum:populationWeighted?weights.filter(w=>finite(w)&&w>0).reduce((s,w)=>s+w,0):ordered.length,estimator_aggregation:populationWeighted?'Original population-weighted mean of wave estimates':'Arithmetic mean of wave estimates',n_waves:ordered.filter(r=>finite(r.estimate)&&validWeight(r)).length,n_waves_available:ordered.length,n_waves_ratio:paired.length,paired_years:paired.map(p=>p.r.year).join(',')};
      a.reliability=ordered.some(row=>finite(row.estimate)&&lowerReliability(row.reliability))?'low_support':null;
      if(filter.coverageField)a.metric_years=filter.coverageField==='ratio_to_wealth'?a.paired_years:
        ordered.filter(row=>finite(row[filter.coverageField])&&validWeight(row)).map(row=>row.year).join(',');
      ['estimate','threshold_quantile','maxks','gini','share_top20','share_top10','share_top5','share_top1'].forEach(k=>a[k]=aggregate(k));['n_tail','n_obs'].forEach(k=>a[k]=average(ordered.map(r=>r[k])));
      const pairMean=values=>populationWeighted?weightedAverage(values,paired.map(p=>p.r.population_weight)):average(values);a.ratio_to_wealth=paired.length?pairMean(paired.map(p=>p.r.estimate))/pairMean(paired.map(p=>p.w.estimate)):null;return a;
    });
    const order=(a,b)=>a.country_name.localeCompare(b.country_name)||a.survey.localeCompare(b.survey)||(a.year||0)-(b.year||0)||labels[a.variable].localeCompare(labels[b.variable]);
    return[...(filter.period!=='wave'?averages.sort(order):[]),...(filter.period!=='average'?years.sort(order):[])];
  }
  function renderResults(){
    const visible=waveRows.filter(row=>(results.survey==='all'||row.survey===results.survey)&&(results.country==='all'||row.country===results.country));
    const hbsOnly=selectedHBSOnly(visible);
    results.variable=options('cc-r-variable',[['all','All variables'],...variables.filter(([key])=>visible.some(row=>row.variable===key)||key!==hbsAlternative.key&&!hbsOnly).map(([key,label])=>[key,hbsOnly?variableLabel(key,'HBS'):label])],results.variable);
    results.adjustment=syncHBSStage('cc-r-adjustment',visible,results.adjustment,hbsOnly);
    const p99=$('cc-r-threshold').querySelector('option[value="p99"]');
    if(p99)p99.disabled=hbsOnly;
    if(hbsOnly&&results.threshold==='p99')results.threshold='p98';
    $('cc-r-threshold').value=results.threshold;
    $('cc-r-custom').max=hbsOnly?'98':'99';
    if(hbsOnly&&results.q>.98){results.q=.98;$('cc-r-custom').value='98';}
    const signature=(context.getSpecificationSignature||getHousingMethod)()+'|'+JSON.stringify(results,(k,v)=>k==='page'?undefined:v);if(signature!==tableSignature){results.page=0;tableSignature=signature;}
    tableRows=resultData();const pages=Math.max(1,Math.ceil(tableRows.length/50));results.page=Math.max(0,Math.min(results.page,pages-1));
    $('cc-r-count').textContent=tableRows.length?'Rows '+(results.page*50+1)+'–'+Math.min((results.page+1)*50,tableRows.length)+' of '+tableRows.length:'No results for these filters.';$('cc-r-page').textContent='Page '+(results.page+1)+' of '+pages;$('cc-r-prev').disabled=results.page===0;$('cc-r-next').disabled=results.page>=pages-1;$('cc-results-csv').disabled=!tableRows.length;
    const table=$('cc-results-table');table.replaceChildren();const head=document.createElement('thead'),tr=document.createElement('tr');
    ['Country','Survey','Wave / source period','Measure','Method','Cutoff','Tail','KS','Tail / wealth','Waves','Paired waves','Gini','Top 20%','Top 10%','Top 5%','Top 1%'].forEach(t=>{const th=document.createElement('th');th.textContent=t;tr.append(th);});head.append(tr);table.append(head);const body=document.createElement('tbody');
    tableRows.slice(results.page*50,(results.page+1)*50).forEach(r=>{const row=document.createElement('tr');if(r.period_type==='average')row.className='average-row';[r.country_name,r.survey,r.period_label,variableLabel(r.variable,r.survey),r.method,(r.period_type==='average'&&results.threshold==='ks'?'Mean q ':'')+percent(r.threshold_quantile),number(r.estimate)+(finite(r.estimate)&&lowerReliability(r.reliability)?' †':''),number(r.maxks,4),number(r.ratio_to_wealth),r.n_waves+'/'+r.n_waves_available,r.n_waves_ratio,number(r.gini),percent(r.share_top20),percent(r.share_top10),percent(r.share_top5),percent(r.share_top1)].forEach(t=>{const td=document.createElement('td');td.textContent=t;row.append(td);});body.append(row);});table.append(body);
    $('cc-r-custom-control').hidden=results.threshold!=='custom';
    $('cc-r-note').textContent=(tableRows.some(row=>finite(row.estimate)&&lowerReliability(row.reliability))?'† Low statistical reliability under Eurostat HBS publication guidance. ':'')+(hbsOnly?'HBS total income is net monetary household income. ':'')+'See the Online Appendix for details.';
  }
  function updateRelationshipOptions(){
    relationships.country=countries('cc-b-country','all',relationships.country,relationshipAvailability,false);
    const available=[...new Set(relationshipAvailability.filter(r=>r.country===relationships.country).map(r=>r.survey))].sort(),baseline=['HILDA','HFCS','SHIW'].find(survey=>available.includes(survey))||available[0],pair=pairs[relationships.pair];
    let selected=relationships.selectedByCountry.get(relationships.country);if(!selected){selected=new Set([baseline].filter(Boolean));relationships.selectedByCountry.set(relationships.country,selected);}if(baseline)selected.add(baseline);
    [...$('cc-b-bin-min').options].forEach(option=>{option.disabled=!relationshipAvailability.some(r=>r.country===relationships.country&&selected.has(r.survey)&&r.variant===relationships.adjustment&&r.xvar===pair.x&&r.yvar===pair.y&&Number(r.bin_min_n??10)===Number(option.value));});
    const minimumOption=$('cc-b-bin-min').querySelector('option[value="'+relationships.minN+'"]');if(minimumOption?.disabled)relationships.minN=Number([...$('cc-b-bin-min').options].find(option=>option.value==='5'&&!option.disabled)?.value??[...$('cc-b-bin-min').options].find(option=>!option.disabled)?.value??relationships.minN);$('cc-b-bin-min').value=String(relationships.minN);
    $('cc-b-datasets').replaceChildren();$('cc-b-waves').replaceChildren();
    available.forEach(survey=>{
      const label=document.createElement('label'),input=document.createElement('input');label.className='overlay-choice small-check';input.type='checkbox';input.value=survey;input.checked=selected.has(survey);input.setAttribute('aria-label',sourceLabel(survey));const supported=relationshipAvailability.some(r=>r.country===relationships.country&&r.survey===survey&&r.variant===relationships.adjustment&&r.xvar===pair.x&&r.yvar===pair.y&&Number(r.bin_min_n??10)===relationships.minN);input.disabled=survey===baseline||!supported;label.classList.toggle('unavailable-option',!supported);input.title=!supported?'This relationship is unavailable for this dataset.':survey===baseline?'Reference dataset for this country':'';label.append(input,document.createTextNode(sourceLabel(survey)),surveyHelp(survey));$('cc-b-datasets').append(label);
      input.addEventListener('change',()=>{if(input.checked)selected.add(survey);else selected.delete(survey);render();});
      if(!selected.has(survey))return;
      const years=[...new Set(relationshipAvailability.filter(r=>r.period_type!=='average'&&finite(r.year)&&Number(r.bin_min_n??10)===relationships.minN&&r.survey===survey&&r.country===relationships.country&&r.variant===relationships.adjustment&&r.xvar===pair.x&&r.yvar===pair.y).map(r=>r.year))].sort((a,b)=>a-b),key=relationships.country+'|'+survey,control=document.createElement('div'),waveLabel=document.createElement('label'),select=document.createElement('select');
      control.className='control biv-wave-control';select.id='cc-b-wave-'+survey.toLowerCase();waveLabel.htmlFor=select.id;waveLabel.textContent=survey+':';control.append(waveLabel,select);$('cc-b-waves').append(control);
      [['average','Across-wave average'],...years.map(year=>[String(year),String(year)])].forEach(([value,text])=>select.add(new Option(text,value)));const chosen=relationships.waves.get(key)||'average';select.value=[...select.options].some(option=>option.value===chosen)?chosen:'average';relationships.waves.set(key,select.value);select.disabled=!years.length;
      select.addEventListener('change',()=>{relationships.waves.set(key,select.value);render();});
    });
    return available.filter(survey=>selected.has(survey));
  }
  const relationshipBinKey=r=>Math.round(r.q_lo*1e8)+'|'+Math.round(r.q_hi*1e8);
  function selectRelationshipPeriods(rows,wave){
    const waves=rows.filter(r=>r.period_type!=='average'&&finite(r.year));
    if(wave!=='average')return waves.filter(r=>r.year===Number(wave));
    const averages=rows.filter(r=>r.period_type==='average'||r.year===null);
    if(!averages.length)return waves;
    return averages.map(r=>({...r,n_waves:finite(r.n_waves)?r.n_waves:new Set(waves.filter(w=>relationshipBinKey(w)===relationshipBinKey(r)).map(w=>w.year)).size}));
  }
  function ols(points,useLog){
    if(points.length<2)return null;const xs=points.map(p=>useLog?Math.log(p.x):p.x),ys=points.map(p=>useLog?Math.log(p.y):p.y),mx=average(xs),my=average(ys),den=xs.reduce((s,v)=>s+(v-mx)**2,0);if(!(den>0))return null;
    const slope=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0)/den,intercept=my-slope*mx,sse=xs.reduce((s,v,i)=>s+(ys[i]-intercept-slope*v)**2,0),sst=ys.reduce((s,v)=>s+(v-my)**2,0);
    return{method:'OLS',intercept,slope,r2:sst>0?1-sse/sst:null,space:useLog?'logs':'levels',predict:x=>useLog?Math.exp(intercept+slope*Math.log(x)):intercept+slope*x};
  }
  function nls(points){
    const sample=points.filter(p=>p.x>0);if(sample.length<2)return null;const lx=sample.map(p=>Math.log(p.x)),lo=Math.min(...lx),hi=Math.max(...lx);if(!(hi>lo))return null;
    const profile=b=>{const pivot=b>=0?hi:lo,z=lx.map(v=>Math.exp(b*(v-pivot))),a=z.reduce((s,v,i)=>s+v*sample[i].y,0)/z.reduce((s,v)=>s+v*v,0);return{sse:z.reduce((s,v,i)=>s+(sample[i].y-a*v)**2,0),a,pivot};};
    let span=8,grid,best;for(let pass=0;pass<3;pass++){grid=Array.from({length:161},(_,i)=>{const b=-span+2*span*i/160;return{b,...profile(b)};});best=grid.reduce((j,v,i)=>v.sse<grid[j].sse?i:j,0);if(best>0&&best<160)break;if(pass===2)return null;span*=2;}
    let l=grid[best-1].b,h=grid[best+1].b;const phi=(Math.sqrt(5)-1)/2;let a=h-phi*(h-l),b=l+phi*(h-l),fa=profile(a).sse,fb=profile(b).sse;for(let i=0;i<70;i++){if(fa<fb){h=b;b=a;fb=fa;a=h-phi*(h-l);fa=profile(a).sse;}else{l=a;a=b;fa=fb;b=l+phi*(h-l);fb=profile(b).sse;}}
    const slope=(l+h)/2,p=profile(slope),intercept=p.a*Math.exp(-slope*p.pivot),my=average(sample.map(r=>r.y)),sst=sample.reduce((s,r)=>s+(r.y-my)**2,0);if(!finite(intercept))return null;return{method:'NLS',intercept,slope,r2:sst>0?1-p.sse/sst:null,space:'levels',predict:x=>p.a*Math.exp(slope*(Math.log(x)-p.pivot))};
  }
  function renderRelationships(){
    if(relationshipChart)relationshipChart.destroy();relationshipChart=null;const selected=updateRelationshipOptions(),pair=pairs[relationships.pair],useLog=relationships.scale==='loglog';
    const country=bins.find(row=>row.country===relationships.country)?.country_name||relationships.country,datasets=[],series=[],fits=[],symbols={consump_def1:'c',networth_val:'a',total_income:'y',total_labor_income:'y_L',total_capital_income:'y_K'};plottedRows=[];
    selected.forEach(survey=>{
      const wave=relationships.waves.get(relationships.country+'|'+survey)||'average',rows=selectRelationshipPeriods(bins.filter(r=>Number(r.bin_min_n??10)===relationships.minN&&r.survey===survey&&r.country===relationships.country&&r.variant===relationships.adjustment&&r.xvar===pair.x&&r.yvar===pair.y),wave),groups=new Map();
      rows.forEach(r=>{const k=relationshipBinKey(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
      const allPoints=[...groups.values()].map(g=>({x:average(g.map(r=>r[relationships.stat+'_x'])),y:average(g.map(r=>r[relationships.stat+'_y'])),q_lo:g[0].q_lo,q_hi:g[0].q_hi,n_obs:Math.min(...g.map(r=>r.n_obs)),n_imputations:g[0].n_imputations??null,years_used:g[0].years_used||[...new Set(g.map(r=>r.year).filter(finite))].sort((a,b)=>a-b).join(';'),n_waves:g.some(r=>r.period_type==='average'||r.year===null)?g[0].n_waves:new Set(g.map(r=>r.year).filter(finite)).size})).filter(p=>finite(p.x)&&finite(p.y)).sort((a,b)=>a.q_lo-b.q_lo),points=allPoints.filter(p=>!useLog||(p.x>0&&p.y>0)),style=styles[survey]||styles.HFCS,olsFit=ols(points,useLog),nlsFit=nls(points),fit=relationships.fit==='ols'?olsFit:relationships.fit==='nls'?nlsFit:null;
      series.push({survey,wave,points,allPoints,fit});[olsFit,nlsFit].filter(Boolean).forEach(fit=>fits.push({survey,...fit,bins:points.length}));
      plottedRows.push(...points.map(p=>({survey,housing_method:getHousingMethod(),country:relationships.country,country_name:country,wave,variant:relationships.adjustment,xvar:pair.x,yvar:pair.y,statistic:relationships.stat,axis_scale:relationships.scale,bin_min_n:relationships.minN,...p,ols_intercept:olsFit?.intercept,ols_slope:olsFit?.slope,ols_r_squared:olsFit?.r2,nls_scale:nlsFit?.intercept,nls_exponent:nlsFit?.slope,nls_r_squared:nlsFit?.r2})));
      if(points.length)datasets.push({type:'scatter',label:survey,data:points,borderColor:style.color,backgroundColor:style.color,pointStyle:style.point,pointRadius:4.5});
      if(fit){const eligible=points.filter(p=>relationships.fit!=='nls'||p.x>0),lo=Math.min(...eligible.map(p=>p.x)),hi=Math.max(...eligible.map(p=>p.x)),line=Array.from({length:81},(_,i)=>{const x=useLog||fit.method==='NLS'?Math.exp(Math.log(lo)+i/80*(Math.log(hi)-Math.log(lo))):lo+i/80*(hi-lo);return{x,y:fit.predict(x)};}).filter(p=>finite(p.y)&&(!useLog||p.y>0));datasets.push({type:'line',label:survey+' '+fit.method,data:line,borderColor:style.color,borderDash:[6,5],borderWidth:1.5,pointRadius:0,isFit:true});}
    });
    $('cc-b-title').textContent=labels[pair.y]+' and '+labels[pair.x].toLowerCase();$('cc-b-subtitle').textContent=country+' · normalized weighted '+relationships.stat+'s';
    $('cc-b-readout').textContent=series.map(({survey,wave,fit})=>sourceLabel(survey)+' '+(wave==='average'?'across-wave average':wave)+(fit?' · '+fit.method+' '+(fit.method==='NLS'?'exponent':useLog?'elasticity':'slope')+' '+number(fit.slope):'')).join('  ·  ');
    $('cc-b-chart').dataset.fitValues=JSON.stringify(fits.map(({survey,method,slope,bins})=>({survey,method,slope,bins})));$('cc-b-chart').dataset.binMin=String(relationships.minN);$('cc-b-chart').dataset.country=relationships.country;$('cc-b-chart').dataset.pair=relationships.pair;
    $('cc-b-empty').textContent='No bivariate results are available for these filters.';$('cc-b-empty').hidden=!!plottedRows.length;$('cc-b-csv').disabled=!plottedRows.length;$('cc-b-chart').setAttribute('aria-label',labels[pair.y]+' versus '+labels[pair.x]+' in '+country);
    const interpretation=$('cc-b-tail-ratio');interpretation.replaceChildren();
    series.forEach(({survey,fit,points},index)=>{
      if(index)interpretation.append(' · ');const span=document.createElement('strong');span.style.color=styles[survey]?.color||styles.HFCS.color;
      if(fit&&(useLog||fit.method==='NLS')&&finite(fit.slope)&&fit.slope>0&&finite(1/fit.slope)){
        const numerator=document.createElement('sub'),denominator=document.createElement('sub');numerator.textContent=symbols[pair.y];denominator.textContent=symbols[pair.x];span.append(survey+' implied Pareto-tail ratio: ζ',numerator,'/ζ',denominator,' ≈ '+number(1/fit.slope,2));
      }else{const reason=relationships.fit==='none'?'select a fit':fit?.method==='OLS'&&!useLog?'select log–log axes or NLS':points.length<2?'too few usable bins':!fit?'no valid fit':'a positive finite exponent is required';span.textContent=survey+' implied Pareto-tail ratio unavailable: '+reason+'.';}
      interpretation.append(span);
    });
    const help=document.createElement('button');help.type='button';help.className='help-marker detail-help hover-help';help.textContent='?';help.dataset.helpToggle='true';help.setAttribute('aria-label','About implied Pareto-tail ratios');help.setAttribute('aria-expanded','false');help.dataset.tooltip='Joint '+labels[pair.y].toLowerCase()+'–'+labels[pair.x].toLowerCase()+' relationship: a straight log–log line has constant elasticity. Its reciprocal gives an implied Pareto-tail ratio under a power law, rather than a ratio of separately estimated marginal tails. The variables’ level ratio is constant only at slope one. Binning reduces idiosyncratic noise but requires enough observations, so estimates start at P80 (top 20%).';interpretation.append(help);
    const table=$('cc-b-fits');table.replaceChildren();if(fits.length){const t=document.createElement('table');t.innerHTML='<thead><tr><th>Dataset</th><th>Fit</th><th>a / A</th><th>b</th><th>R²</th><th>Bins</th></tr></thead>';const body=document.createElement('tbody');fits.forEach(f=>{const tr=document.createElement('tr');[f.survey,f.method+' · '+f.space,number(f.intercept),number(f.slope),number(f.r2),f.bins].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);});t.append(body);table.append(t);}
    const counts=series.map(({survey,points,allPoints})=>survey+': '+points.length+' bins'+(allPoints.length>points.length?' ('+(allPoints.length-points.length)+' omitted on logarithmic axes)':'')).join(' · ');
    $('cc-b-note').textContent=counts+'.';
    const intervals=series.map(({survey})=>survey+' '+number(100*.001,1)).join('; ');
    help.dataset.tooltip+=' Base intervals, in percentile points: '+intervals+'.'+(relationships.minN===0?' Original cells are used without merging or a minimum observation count; empty cells are omitted. Across-wave averages use each cell’s available waves. SCF and HFCS cells must be nonempty in all five imputations.':' Adjacent intervals are merged to retain at least '+relationships.minN+' observations in every relevant wave/adjustment/imputation cell.')+' Each variable is normalized by its wave-specific weighted mean; across-wave points average wave-specific bin statistics. OLS weights displayed bins equally; NLS minimizes squared residuals in levels. Survey definitions differ; see Variable Construction & Sample.';
    if(!plottedRows.length)return;
    relationshipChart=new Chart($('cc-b-chart'),{type:'scatter',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{onlineYAxisTitles:false,legend:{display:series.length>1,labels:{filter:item=>!datasets[item.datasetIndex].isFit,usePointStyle:true}},tooltip:{filter:item=>item.dataset.type==='scatter',callbacks:{title:items=>items[0]?.dataset.label||'',label:ctx=>[labels[pair.x]+' / mean: '+number(ctx.raw.x),labels[pair.y]+' / mean: '+number(ctx.raw.y)],afterLabel:ctx=>percent(ctx.raw.q_lo)+'–'+percent(ctx.raw.q_hi)+' · '+ctx.raw.n_obs+' minimum households'}}},scales:{x:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},title:{display:true,text:labels[pair.x]+' / sample mean',font:{size:13}},ticks:{font:{size:13}}},y:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},title:{display:true,text:labels[pair.y]+' / sample mean',font:{size:13}},ticks:{font:{size:13}}}}}});
  }
  async function allResultsCSV(){
    $('cc-results-all').disabled=true;$('cc-r-status').textContent='Preparing international aggregate results…';
    try{
      const fields=['country','country_name','survey','housing_method','source_housing_method','period_type','period_label','year','variant','variable','method','threshold','threshold_quantile','estimate','maxks','ratio_to_wealth','n_waves','n_waves_available','n_waves_ratio','paired_years','population_weight','aggregation_weight_sum','estimator_aggregation','n_tail','n_obs','reliability','gini','share_top20','share_top10','share_top5','share_top1'],esc=v=>v===undefined||v===null?'':'"'+String(v).replace(/"/g,'""')+'"',parts=[fields.join(',')+'\r\n'];let n=0;
      const append=rows=>{rows=rows.map(row=>({...row,source_housing_method:row.housing_method||'benchmark',housing_method:getHousingMethod()}));parts.push(rows.map(r=>fields.map(k=>esc(r[k])).join(',')).join('\r\n')+'\r\n');n+=rows.length;};
      for(const method of ['MLE','OLS'])for(const adjustment of ['raw','adj','full','reference']){
        const base={...results,survey:'all',country:'all',variable:'all',method,adjustment,period:'average'};
        append(resultData({...base,threshold:'ks'}));
        const qs=[...new Set(curves.filter(r=>r.variant===adjustment).flatMap(r=>r.qs))].sort((a,b)=>a-b);
        for(let j=0;j<qs.length;j++){append(resultData({...base,threshold:'custom',q:qs[j]}).filter(r=>finite(r.estimate)));if(j%10===0){$('cc-r-status').textContent=number(n,0)+' average rows prepared…';await new Promise(resolve=>setTimeout(resolve,0));}}
      }
      for(const method of ['MLE','OLS'])for(const adjustment of ['raw','adj','full','reference']){
        append(resultData({...results,survey:'all',country:'all',variable:'all',method,adjustment,period:'wave',threshold:'ks'}));
        const selected=curves.filter(r=>r.variant===adjustment);
        for(let i=0;i<selected.length;i++){const c=selected[i],source=annualIndex.get([key(c),method].join('|'))||c,m=method.toLowerCase();const rows=c.qs.map((q,j)=>({q,j})).map(({q,j})=>{const w=tail({...c,variable:'networth_val'},method,'custom',q);return{...source,period_type:'wave',period_label:String(c.year),method,threshold:'custom',threshold_quantile:q,estimate:c[m]?.[j]??null,maxks:c['maxks_'+m]?.[j]??null,n_tail:c.n_tail?.[j]??null,reliability:c.reliability_by_threshold?.[j]??null,ratio_to_wealth:finite(c[m]?.[j])&&finite(w.estimate)&&w.estimate>0?c[m][j]/w.estimate:null,n_waves:finite(c[m]?.[j])?1:0,n_waves_available:1,n_waves_ratio:finite(c[m]?.[j])&&finite(w.estimate)?1:0};});append(rows);if(i%20===0){$('cc-r-status').textContent=number(n,0)+' aggregate rows prepared…';await new Promise(resolve=>setTimeout(resolve,0));}}
      }
      const url=URL.createObjectURL(new Blob(parts,{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='international_inequality_results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('cc-r-status').textContent=number(n,0)+' aggregate rows prepared. Averages precede annual results.';
    }catch(error){$('cc-r-status').textContent='The results download could not be prepared.';console.error(error);}finally{$('cc-results-all').disabled=false;}
  }
  function ensureRelationshipBins(){
    if(!relationshipBinsPromise)relationshipBinsPromise=context.loadInternationalBins().then(rows=>{
      allBins=rows.filter(outsideUS);relationshipBinsReady=true;refreshHousing();updateRelationshipOptions();
    });return relationshipBinsPromise;
  }
  const labelUSCurve=row=>({...row,country:'US',country_name:'United States'});
  let optionalProfilesLoaded=false;
  function renderQuantiles(){
    if(thresholdController){
      const optional=context.getCEXIncome?.()&&!optionalProfilesLoaded?(context.getLoadedCEXCurves?.()||[]):[];
      if(optional.length){thresholdController.addCurves(optional.map(labelUSCurve));optionalProfilesLoaded=true;}
      thresholdController.render();return;
    }
    if(thresholdLoad||typeof ThresholdProfiles==='undefined')return;
    const host=$('cc-quantile-profiles');
    host.setAttribute('aria-busy','true');
    host.textContent='Loading quantile estimates…';
    thresholdLoad=(async()=>{
      const usCurves=(await context.loadUSCurves?.()||[]).map(labelUSCurve);
      const loadCEXIncome=context.loadCEXIncome?async()=>{
        const rows=await context.loadCEXIncome();
        optionalProfilesLoaded=rows.length>0;
        return rows.map(labelUSCurve);
      }:null;
      const optional=context.getCEXIncome?.()&&loadCEXIncome?await loadCEXIncome():[];
      host.replaceChildren();
      thresholdController=ThresholdProfiles.create({
        host,curves:[...allCurves,...usCurves,...optional],surveys:[...new Set(['HFCS','SHIW','HILDA',...allCurves.map(row=>row.survey),...(context.usSurveys||[])])],international:true,
        metadata:context.metadata||{},spendingOptions:[...(context.spendingOptions||[]),hbsAlternative],getHousingMethod,
        getSpecificationSignature:context.getSpecificationSignature||getHousingMethod,housingMatches,
        getDinaCapitalDefinition:context.getDinaCapitalDefinition,onDinaCapitalDefinitionChange:context.onDinaCapitalDefinitionChange,
        getCEXIncome:context.getCEXIncome,onCEXIncomeChange:context.onCEXIncomeChange,loadCEXIncome,
      });
      if(active()&&view==='quantiles')thresholdController.render();
    })().catch(error=>{thresholdController=null;host.textContent='Quantile estimates could not be loaded. Switch tabs to try again.';console.error(error);})
      .finally(()=>{host.removeAttribute('aria-busy');thresholdLoad=null;});
  }
  function render(){
    if(!active())return;refreshHousing();
    if(view==='eyeballing')eyeController?.render();else if(view==='summary')renderSummary();else if(view==='time')renderTime();else if(view==='quantiles')renderQuantiles();else if(view==='results')renderResults();else if(relationshipBinsReady){updateRelationshipOptions();$('cc-b-chart').parentElement.removeAttribute('aria-busy');renderRelationships();}else{
      $('cc-b-empty').hidden=false;$('cc-b-empty').textContent='Loading relationship results…';$('cc-b-chart').parentElement.setAttribute('aria-busy','true');$('cc-b-csv').disabled=true;
      ensureRelationshipBins().then(()=>{if(active()&&view==='loglog'){$('cc-b-csv').disabled=false;render();}}).catch(error=>{$('cc-b-empty').textContent='Relationship results could not be loaded. Please reload the page.';console.error(error);});
    }
  }
  [['cc-t-country','country'],['cc-t-survey','survey'],['cc-t-adjustment','adjustment'],['cc-t-indicator','indicator'],['cc-t-method','method'],['cc-t-threshold','threshold']].forEach(([id,key])=>$(id).addEventListener('change',event=>{time[key]=event.target.value;if(key==='country')time.survey='all';render();}));
  $('cc-t-custom').addEventListener('input',event=>{const value=Number(event.target.value);if(Number.isInteger(value)&&value>=70&&value<=Number(event.target.max)){time.q=value/100;render();}});
  $('cc-t-custom').addEventListener('change',event=>{const value=Number(event.target.value);if(!Number.isInteger(value)||value<70||value>Number(event.target.max)){event.target.value=String(Math.round(time.q*100));return;}time.q=value/100;render();});
  $('cc-t-csv').addEventListener('click',()=>download(timeRows,'international_tails_over_time.csv'));
  $('cc-t-png').addEventListener('click',()=>{if(!timeChart)return;const link=document.createElement('a');link.href=withFigureYAxisTitles([timeChart],()=>timeChart.toBase64Image());link.download='international_tails_over_time.png';link.click();});
  [['cc-survey','dataset'],['cc-country','country'],['cc-period','period'],['cc-adjustment','specification'],['cc-method','method'],['cc-measure','measure'],['cc-indicator','indicator'],['cc-threshold','threshold']].forEach(([id,k])=>$(id).addEventListener('change',e=>{
    summary[k]=e.target.value;
    if(k==='country') hiddenSummaryCountries.delete(summary.country);
    if(k==='dataset'&&summary.dataset==='NIELSEN'){summary.measure='food_total';summary.country='US';}
    if(k==='threshold')summaryUSFailed=false;
    render();
  }));
  $('cc-custom').addEventListener('change',event=>{
    const value=Number(event.target.value);
    if(!Number.isInteger(value)||value<70||value>Number(event.target.max)){event.target.value=String(Math.round(summary.q*100));return;}
    summary.q=value/100;
    summaryUSFailed=false;
    renderSummary();
  });
  [['cc-r-survey','survey'],['cc-r-country','country'],['cc-r-variable','variable'],['cc-r-adjustment','adjustment'],['cc-r-method','method'],['cc-r-threshold','threshold'],['cc-r-period','period']].forEach(([id,k])=>$(id).addEventListener('change',e=>{results[k]=e.target.value;if(k==='survey'){results.country=countries('cc-r-country',results.survey,results.country,waveRows);}render();}));
  $('cc-r-custom').addEventListener('change',e=>{const q=Number(e.target.value);if(!Number.isInteger(q)||q<70||q>Number(e.target.max)){$('cc-r-custom-note').textContent='Choose a whole percentile from 70 to '+e.target.max+'.';return;}results.q=q/100;$('cc-r-custom-note').textContent='';render();});
  [['cc-b-country','country'],['cc-b-pair','pair'],['cc-b-adjustment','adjustment'],['cc-b-stat','stat'],['cc-b-bin-min','minN'],['cc-b-scale','scale'],['cc-b-fit','fit']].forEach(([id,k])=>$(id).addEventListener('change',e=>{relationships[k]=k==='minN'?Number(e.target.value):e.target.value;render();}));
  $('cc-r-prev').addEventListener('click',()=>{results.page--;renderResults();});$('cc-r-next').addEventListener('click',()=>{results.page++;renderResults();});
  $('cc-summary-csv').addEventListener('click',()=>download(summaryRows().map(row=>({
    ...row,indicator:summary.indicator,tail_threshold:isTailIndicator(summary.indicator)?summary.threshold==='custom'?'P'+Math.round(100*summary.q):summary.threshold.toUpperCase():null
  })),'cross_country_summary.csv'));$('cc-results-csv').addEventListener('click',()=>download(tableRows,'international_selected_results.csv'));$('cc-results-all').addEventListener('click',allResultsCSV);$('cc-b-csv').addEventListener('click',()=>download(plottedRows,'international_relationship.csv'));
  updateRelationshipOptions();
  return{render,resize:()=>{if(!active())return;if(view==='eyeballing')eyeController?.resize();else if(view==='summary')renderSummary();else if(view==='time')timeChart?.resize();else if(view==='quantiles')thresholdController?.resize();else if(view==='loglog')relationshipChart?.resize();}};
}
