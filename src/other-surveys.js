function initOtherSurveys(other,usRows,context) {
  'use strict';
  usRows=usRows||[];context=context||{};
  const data=other||{},$=id=>document.getElementById(id),finite=x=>typeof x==='number'&&Number.isFinite(x);
  const unpack=t=>{if(Array.isArray(t))return t;if(t?.encoding==='array-pool-v1'){const rows=t.rows.map(values=>Object.fromEntries(t.columns.map((key,j)=>[key,values[j]])));t.array_refs.forEach(([i,j,id])=>rows[i][t.columns[j]]=t.vectors[id]);return rows;}const rows=t?.rows||[],columns=t?.columns||[];for(let i=0;i<rows.length;i++){const values=rows[i],row={};for(let j=0;j<columns.length;j++)row[columns[j]]=values[j];rows[i]=row;}return rows;};
  const outsideUS=row=>row.country!=='US'&&row.country_name!=='United States';
  let international=unpack(data.international),bins=unpack(data.bivariate).filter(outsideUS),curves=unpack(data.curves),long=unpack(data.long_results).filter(outsideUS);
  const allBinAvailability=bins;let relationshipAvailability=bins;
  const profileCurves=[...curves,...(context.usCurves||[]).map(curve=>({...curve,country:'US',country_name:'United States'}))];
  curves=curves.filter(outsideUS);
  const variables=[['consump_def1','Consumption'],['total_labor_income','Labor income'],['total_income','Total income'],['networth_val','Net worth'],['total_capital_income','Capital income']];
  const labels=Object.fromEntries(variables),adj={raw:'Raw data',adj:'Reporting adjusted',full:'Reporting + representation',reference:'Standalone reference'};
  // PSID/0_PSID_final_figures.R, series_cols (Consumption, Labor, Total income, Wealth, Capital).
  const variableColors={consump_def1:'#477EAD',total_labor_income:'#BF5555',total_income:'#A96F4B',networth_val:'#4D8B69',total_capital_income:'#C4A12A'};
  const styles={HFCS:{color:'#2c5c88',point:'circle'},SHIW:{color:'#b34470',point:'rectRot'},HILDA:{color:'#25877d',point:'triangle'},PSID:{color:'#b34470',point:'rect'},SCF:{color:'#2c5c88',point:'star'},CEX_BM_RECON:{color:'#7b8154',point:'triangle'}};
  const number=(x,d=3)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const percent=x=>finite(x)?number(100*x,1)+'%':'—',average=a=>{const x=a.filter(finite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;};
  const weightedAverage=(values,weights)=>{let total=0,weight=0;values.forEach((v,i)=>{const w=weights[i];if(finite(v)&&finite(w)&&w>0){total+=w*v;weight+=w;}});return weight>0?total/weight:null;};
  const range=a=>a.length?(a[0]===a[a.length-1]?String(a[0]):a[0]+'–'+a[a.length-1]):'';
  const getHousingMethod=context.getHousingMethod||(()=> 'benchmark'),housingMatches=context.housingMatches||(row=>(row.housing_method||'benchmark')==='benchmark'),rowMatches=row=>row.reference_only||housingMatches(row);
  const allInternational=international,allCurves=curves,allLong=long;let allBins=bins,relationshipBinsReady=!context.loadInternationalBins,relationshipBinsPromise;
  const key=r=>[r.survey,r.country,r.year,r.variant||r.specification,r.variable,r.housing_method||'benchmark'].join('|');
  const curveIndex=new Map(curves.map(r=>[key(r),r]));
  let waveRows=long.filter(r=>r.period_type!=='average'&&finite(r.year)&&labels[r.variable]);
  const annualIndex=new Map(waveRows.map(r=>[key(r),r.method].join('|')).map((k,i)=>[k,waveRows[i]]));
  const sourceNames=[...new Set(long.map(r=>r.survey))].sort(),summarySources=[...new Set([...international,...usRows].map(r=>r.survey))].sort();
  let summaryData=[...international,...usRows];
  function refreshHousing(){
    international=allInternational.filter(rowMatches);bins=allBins.filter(row=>housingMatches(row)&&(row.capital_income_definition||'benchmark')==='benchmark');relationshipAvailability=allBinAvailability.filter(row=>housingMatches(row)&&(row.capital_income_definition||'benchmark')==='benchmark');curves=allCurves.filter(rowMatches);long=allLong.filter(rowMatches);summaryData=[...international,...usRows.filter(housingMatches)];
    waveRows=long.filter(row=>row.period_type!=='average'&&finite(row.year)&&labels[row.variable]);
    curveIndex.clear();curves.forEach(row=>curveIndex.set(key(row),row));annualIndex.clear();waveRows.forEach(row=>annualIndex.set([key(row),row.method].join('|'),row));
  }
  const excluded=r=>r.benchmark_included===false||r.benchmark_included===0;
  const summary={dataset:'all',country:'all',period:'average',specification:'full',method:'MLE',variables:new Set(variables.map(([key])=>key))};
  const results={survey:'all',country:'all',variable:'all',adjustment:'full',method:'MLE',threshold:'ks',q:.95,period:'both',page:0};
  const relationships={survey:bins.some(r=>r.survey==='HILDA')?'HILDA':bins[0]?.survey||'HFCS',country:'',pair:'wealth_consumption',adjustment:'full',stat:'mean',minN:5,scale:'loglog',fit:'ols',selectedByCountry:new Map(),waves:new Map()};
  const pairs={wealth_consumption:{x:'networth_val',y:'consump_def1'},income_consumption:{x:'total_income',y:'consump_def1'},labor_consumption:{x:'total_labor_income',y:'consump_def1'},capital_consumption:{x:'total_capital_income',y:'consump_def1'},wealth_capital:{x:'networth_val',y:'total_capital_income'}};
  let view='summary',summaryCharts=[],relationshipChart,thresholdController,eyeController,tableRows=[],plottedRows=[],tableSignature='';
  const panel=$('panel-other');
  panel.innerHTML=[
    '<nav class="secondary-nav cc-subnav" id="cc-secondary-nav" aria-label="Cross-country views"><div class="secondary-nav-inner" role="tablist">',
    '<button class="secondary-tab active" role="tab" aria-selected="true" data-country-view="summary" id="cc-tab-summary" aria-controls="cc-summary">Summary figure</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="quantiles" id="cc-tab-quantiles" aria-controls="cc-quantiles">Estimates by quantile</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="results" id="cc-tab-results" aria-controls="cc-results">Table of results</button>',
    '<button class="secondary-tab" role="tab" aria-selected="false" data-country-view="loglog" id="cc-tab-loglog" aria-controls="cc-loglog">Log–log relationships</button><button class="secondary-tab" role="tab" aria-selected="false" data-country-view="eyeballing" id="cc-tab-eyeballing" aria-controls="cc-eyeballing">Eyeballing</button></div></nav>',
    '<section id="cc-summary" role="tabpanel" aria-labelledby="cc-tab-summary"><div class="other-card">',
    '<header class="other-card-heading"><h2>Cross-country comparison</h2><button class="text-button" id="cc-summary-csv">Results CSV</button></header>',
    '<div class="other-controls"><div class="control"><label for="cc-survey">Survey</label><select id="cc-survey"></select></div>',
    '<div class="control"><label for="cc-country">Country</label><select id="cc-country"></select></div>',
    '<div class="control"><label for="cc-period">Period</label><select id="cc-period"><option value="average">Across-wave average</option><option value="wave">By wave</option></select></div>',
    '<div class="control"><label for="cc-adjustment">Adjustment</label><select id="cc-adjustment"><option value="full">Reporting + representation</option><option value="adj">Reporting only</option><option value="raw">Raw data</option></select></div>',
    '<div class="control"><label for="cc-method">Estimator</label><select id="cc-method"><option>MLE</option><option>OLS</option></select></div></div>',
    '<div class="other-table-meta"><span>KS-selected Pareto coefficients</span><span id="cc-summary-count"></span></div>',
    '<div class="cc-comparison-legends"><fieldset id="cc-variable-legend" class="cc-variable-legend" aria-label="Variables to display"></fieldset><div id="cc-survey-legend" class="cc-survey-legend" aria-label="Survey symbols"></div></div>',
    '<div class="cc-comparison-chart" id="cc-chart-grid"></div>',
    '<p id="cc-summary-empty" class="results-empty" hidden>No estimates are available for these filters.</p><p class="results-note" id="cc-summary-note"></p></div></section>',
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
  const eyeHost=document.createElement('section');eyeHost.id='cc-eyeballing';eyeHost.hidden=true;eyeHost.setAttribute('role','tabpanel');eyeHost.setAttribute('aria-labelledby','cc-tab-eyeballing');panel.append(eyeHost);eyeController=context.createEyeballing?.(eyeHost);
  function options(id,items,value){const el=$(id);el.replaceChildren();items.forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;el.append(o);});if(items.some(i=>i[0]===value))el.value=value;return el.value;}
  const sourceLabel=value=>context.metadata?.surveys?.[value]?.label||value;
  const surveyDescriptions={
    HFCS:'Household Finance and Consumption Survey: harmonized household surveys coordinated by the ECB, covering assets, debts, income and consumption across European countries.',
    HILDA:'Household, Income and Labour Dynamics in Australia: a longitudinal survey following Australian households, with information on income, spending and wealth.',
    SHIW:'Survey on Household Income and Wealth: Banca d’Italia’s survey of Italian households, covering income, saving and wealth.',
    PSID:'Panel Study of Income Dynamics: longitudinal U.S. household panel covering consumption, income and wealth.'
  };
  function surveyHelp(survey){const help=document.createElement('span');help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=surveyDescriptions[survey]||sourceLabel(survey);help.setAttribute('aria-label','About '+sourceLabel(survey));return help;}
  options('cc-survey',[['all','All surveys'],...summarySources.map(v=>[v,sourceLabel(v)])],summary.dataset);
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
  function changeView(value){view=value;panel.querySelectorAll('[data-country-view]').forEach(b=>{const on=b.dataset.countryView===value;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;b.classList.toggle('active',on);});['summary','quantiles','results','loglog','eyeballing'].forEach(v=>$('cc-'+v).hidden=v!==value);render();}
  panel.querySelectorAll('[data-country-view]').forEach(button=>{
    button.tabIndex=button.dataset.countryView===view?0:-1;button.addEventListener('click',()=>changeView(button.dataset.countryView));
    button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...panel.querySelectorAll('[data-country-view]')];let index=buttons.indexOf(button);index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[index].focus();changeView(buttons[index].dataset.countryView);});
  });
  function summaryRows(){return summaryData.filter(r=>(summary.dataset==='all'||r.survey===summary.dataset)&&(summary.country==='all'||r.country===summary.country)&&r.period_type===summary.period&&(r.specification||r.variant)===summary.specification&&r.method===summary.method&&(!r.threshold||r.threshold==='KS'));}
  function renderSummary(){
    const rows=summaryRows(),activeVariables=variables.filter(([key])=>summary.variables.has(key));summaryCharts.forEach(c=>c.destroy());summaryCharts=[];
    const grid=$('cc-chart-grid');grid.replaceChildren();
    const displayed=rows.filter(r=>activeVariables.some(([variable])=>finite(r[variable])));
    const names=[...new Map(displayed.map(r=>[r.country,r])).values()].sort((a,b)=>a.country_name.localeCompare(b.country_name));
    const indexes=new Map(names.map((r,i)=>[r.country,i])),countryLabels=names.map(r=>r.country_name);
    const surveys=summarySources.filter(survey=>displayed.some(r=>r.survey===survey));
    const unit='country–survey'+(summary.period==='wave'?'–wave estimates':' averages');
    $('cc-summary-empty').hidden=!!displayed.length;$('cc-summary-count').textContent=displayed.length+' '+unit;$('cc-summary-csv').disabled=!displayed.length;
    const variableLegend=$('cc-variable-legend'),surveyLegend=$('cc-survey-legend');
    variableLegend.replaceChildren();surveyLegend.replaceChildren();
    const icon=(point,color)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');const shapes={circle:'<circle cx="8" cy="8" r="4.5"/>',rectRot:'<path d="M8 2 14 8 8 14 2 8Z"/>',triangle:'<path d="M8 2 14 13H2Z"/>',rect:'<path d="M3 3H13V13H3Z"/>',star:'<path d="m8 1.5 1.8 4.4 4.7.4-3.6 3.1 1.1 4.6-4-2.5-4 2.5 1.1-4.6-3.6-3.1 4.7-.4Z"/>'};svg.innerHTML=shapes[point]||shapes.rect;svg.setAttribute('fill',color);return svg;};
    variables.forEach(([variable,title])=>{const item=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('span');item.className='series-choice';item.style.setProperty('--series',variableColors[variable]);input.type='checkbox';input.value=variable;input.checked=summary.variables.has(variable);input.disabled=!rows.some(row=>finite(row[variable]));input.setAttribute('aria-label',title);swatch.className='series-swatch';swatch.style.backgroundColor=variableColors[variable];input.addEventListener('change',()=>{input.checked?summary.variables.add(variable):summary.variables.delete(variable);renderSummary();});item.append(input,swatch,document.createTextNode(title));variableLegend.append(item);});
    surveys.forEach(survey=>{const item=document.createElement('span');item.append(icon(styles[survey]?.point||'rect','#5f6875'),document.createTextNode(sourceLabel(survey)),surveyHelp(survey));surveyLegend.append(item);});
    if(!displayed.length){$('cc-summary-note').textContent=activeVariables.length?'No estimates are available for these filters.':'Select at least one variable to display.';return;}
    const wrap=document.createElement('div');wrap.className='cc-comparison-wrap';wrap.style.height=Math.max(450,names.length*40+170)+'px';
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Pareto tail coefficients of consumption, labor income, total income, wealth and capital income across countries. Color identifies the variable and shape identifies the survey.');wrap.append(canvas);grid.append(wrap);
    const datasets=[],referenceMarks=[];
    activeVariables.forEach(([variable,title],vi)=>{
      const color=variableColors[variable];
      surveys.forEach(survey=>{
        const style=styles[survey]||{point:'rect'},subset=displayed.filter(r=>r.survey===survey&&finite(r[variable]));if(!subset.length)return;
        const points=subset.map(r=>{
          const group=subset.filter(a=>a.country===r.country).sort((a,b)=>(a.year||0)-(b.year||0)),j=group.indexOf(r);
          const countrySurveys=surveys.filter(value=>displayed.some(a=>a.country===r.country&&a.survey===value));
          const surveyOffset=(countrySurveys.indexOf(survey)-(countrySurveys.length-1)/2)*.045;
          const waveOffset=group.length>1?(j-(group.length-1)/2)*Math.min(.012,.045/(group.length-1)):0;
          return{x:r[variable],y:indexes.get(r.country)+(vi-(activeVariables.length-1)/2)*.105+surveyOffset+waveOffset,country_name:r.country_name,survey,variable,period_label:r.period_label,n_waves:r['n_waves_'+({consump_def1:'c',networth_val:'wealth',total_income:'income',total_labor_income:'labor',total_capital_income:'capital'})[variable]]??r.n_waves};
        });
        datasets.push({label:title+' · '+survey,pointStyle:style.point,borderColor:color,backgroundColor:color,pointBorderColor:'#fffefa',pointBorderWidth:.7,pointRadius:survey==='HILDA'?7.5:5,pointHoverRadius:survey==='HILDA'?10:7,data:points});
      });
      const byCountry=new Map();displayed.filter(r=>finite(r[variable])).forEach(r=>{if(!byCountry.has(r.country))byCountry.set(r.country,[]);byCountry.get(r.country).push(r[variable]);});
      const values=[...byCountry.values()].map(average).sort((a,b)=>a-b);if(!values.length)return;
      const mid=Math.floor(values.length/2),references={mean:average(values),median:values.length%2?values[mid]:(values[mid-1]+values[mid])/2};
      ['mean','median'].forEach(kind=>{
        const value=references[kind];datasets.push({type:'line',label:title+' '+kind+' '+number(value),data:[{x:value,y:-.5},{x:value,y:names.length-.5}],borderColor:color+'b3',borderDash:kind==='mean'?[8,5]:[3,4],borderWidth:1.4,pointRadius:0,order:2,isReference:true});
        referenceMarks.push({variable,title,kind,value,color});
      });
    });
    canvas.dataset.variables=JSON.stringify(activeVariables.map(([variable])=>variable));
    const axisMaximum=Math.ceil(10*Math.max(1,...displayed.flatMap(row=>activeVariables.map(([variable])=>row[variable]).filter(finite)),...referenceMarks.map(mark=>mark.value))*1.04)/10;
    const axisTitle=kind=>{const dash=kind==='mean'?'long':'short',term=kind==='mean'?'mean':'median';return window.innerWidth<760?['Pareto tail coefficient','('+dash+'-dashed lines:',term+' across countries)']:window.innerWidth<1100?['Pareto tail coefficient','('+dash+'-dashed lines: '+term+' across countries)']:'Pareto tail coefficient ('+dash+'-dashed lines: '+term+' across countries)';};
    const axisReferencePlugin={id:'ccAxisReferences',afterDraw(chart){const ctx=chart.ctx,area=chart.chartArea,lanes={mean:[],median:[]};[...referenceMarks].sort((a,b)=>a.value-b.value).forEach(mark=>{const scale=mark.kind==='mean'?chart.scales.xTop:chart.scales.x,x=scale.getPixelForValue(mark.value),y=mark.kind==='mean'?area.top:area.bottom;ctx.save();ctx.fillStyle=mark.color;ctx.strokeStyle='#fffefa';ctx.lineWidth=2;if(mark.kind==='mean'){ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-4.5,-4.5,9,9);ctx.strokeRect(-4.5,-4.5,9,9);ctx.rotate(-Math.PI/4);ctx.translate(-x,-y);}ctx.font='600 13px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline=mark.kind==='mean'?'bottom':'top';const label=number(mark.value),half=ctx.measureText(label).width/2;let lane=0;while(lane<2&&lanes[mark.kind][lane]!==undefined&&x-half<lanes[mark.kind][lane]+6)lane++;lanes[mark.kind][lane]=x+half;const offset=7+lane*17,labelY=mark.kind==='mean'?y-offset:y+offset;ctx.lineWidth=3;ctx.strokeText(label,x,labelY);ctx.fillText(label,x,labelY);ctx.restore();});}};
    summaryCharts.push(new Chart(canvas,{type:'scatter',data:{datasets},plugins:[axisReferencePlugin],options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:5,right:22,bottom:3}},plugins:{legend:{display:false},tooltip:{filter:item=>!item.dataset.isReference,callbacks:{title:items=>items.length?items[0].raw.country_name+' · '+items[0].raw.survey:'',label:ctx=>labels[ctx.raw.variable]+': '+number(ctx.raw.x),afterLabel:ctx=>[ctx.raw.period_label,ctx.raw.n_waves+' available wave(s)',summary.method+' · '+adj[summary.specification]]}}},scales:{xTop:{type:'linear',position:'top',min:0,max:axisMaximum,title:{display:true,text:axisTitle('mean'),font:{size:13}},grid:{drawOnChartArea:false},border:{color:'#cfd3da'},ticks:{font:{size:13},padding:38,maxRotation:0}},x:{type:'linear',position:'bottom',min:0,max:axisMaximum,title:{display:true,text:axisTitle('median'),font:{size:13}},grid:{color:'#eeece7'},border:{color:'#cfd3da'},ticks:{font:{size:13},padding:38,maxRotation:0}},y:{type:'linear',reverse:true,min:-.5,max:names.length-.5,afterBuildTicks:axis=>axis.ticks=countryLabels.map((label,value)=>({value})),grid:{color:'#eeece7',drawTicks:false},border:{display:false},ticks:{autoSkip:false,padding:12,font:{size:13},callback:v=>Number.isInteger(v)?countryLabels[v]||'':''}}}}}));
    $('cc-summary-note').textContent='Each country receives equal weight: surveys and available waves are averaged within country, so Italy counts once. US estimates use PSID. Coverage varies by variable; HILDA wealth is available in five waves. See Definitions for survey methods and adjustments.';
  }
  function tail(row,method,rule,q){
    const base=annualIndex.get([key(row),method].join('|')),curve=curveIndex.get(key(row)),m=method.toLowerCase();
    if(rule==='ks'){
      const fit=curve?.['ks_'+m];
      if(fit!==undefined)return{estimate:fit?.estimate??null,q:fit?.q??null,maxks:fit?.maxks??null,n_tail:fit?.n_tail??null};
      return{estimate:finite(base?.estimate)?base.estimate:null,q:finite(base?.q_ks)?base.q_ks:base?.q??null,maxks:base?.maxks??base?.ks??null,n_tail:base?.n_tail??null};
    }
    const cutoff=rule==='custom'?q:Number(rule.slice(1))/100;const index=curve?.qs?.findIndex(v=>Math.abs(v-cutoff)<1e-7)??-1;
    return{estimate:index>=0?curve[m]?.[index]??null:null,q:cutoff,maxks:index>=0?curve['maxks_'+m]?.[index]??null:null,n_tail:index>=0?curve.n_tail?.[index]??null:null};
  }
  function resultData(filter=results){
    const records=waveRows.filter(r=>r.method===filter.method&&(filter.survey==='all'||r.survey===filter.survey)&&(filter.country==='all'||r.country===filter.country)&&(filter.variable==='all'||r.variable===filter.variable)&&(r.variant||r.specification)===filter.adjustment);
    const years=records.map(r=>{const fit=tail(r,filter.method,filter.threshold,filter.q),wealth={...r,variable:'networth_val'},w=tail(wealth,filter.method,filter.threshold,filter.q),population=curveIndex.get(key(r))?.population_weight??r.population_weight??null;return{country:r.country,country_name:r.country_name,survey:r.survey,housing_method:r.housing_method||'benchmark',period_type:'wave',period_label:String(r.year),year:r.year,variant:r.variant||r.specification,variable:r.variable,method:filter.method,threshold:filter.threshold,threshold_quantile:fit.q,estimate:fit.estimate,maxks:fit.maxks,n_tail:fit.n_tail,n_obs:r.n_obs??null,population_weight:population,estimator_aggregation:'Wave estimate',n_waves:finite(fit.estimate)?1:0,n_waves_available:1,ratio_to_wealth:finite(fit.estimate)&&finite(w.estimate)&&w.estimate>0?fit.estimate/w.estimate:null,n_waves_ratio:finite(fit.estimate)&&finite(w.estimate)&&w.estimate>0?1:0,gini:r.gini??null,share_top20:r.share_top20??null,share_top10:r.share_top10??null,share_top5:r.share_top5??null,share_top1:r.share_top1??null};});
    const groups=new Map();years.forEach(r=>{const k=[r.survey,r.country,r.housing_method||'benchmark',r.variant,r.variable].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    const averages=[...groups.values()].map(group=>{
      const ordered=group.slice().sort((a,b)=>a.year-b.year),populationWeighted=ordered[0].survey==='HFCS',validWeight=r=>!populationWeighted||(finite(r.population_weight)&&r.population_weight>0),weights=ordered.map(r=>r.population_weight),aggregate=k=>populationWeighted?weightedAverage(ordered.map(r=>r[k]),weights):average(ordered.map(r=>r[k])),paired=ordered.map(r=>({r,w:tail({...r,variable:'networth_val'},filter.method,filter.threshold,filter.q)})).filter(({r,w})=>finite(r.estimate)&&finite(w.estimate)&&w.estimate>0&&validWeight(r)),a={...ordered[0],period_type:'average',year:null,period_label:range(ordered.map(r=>r.year))+' average',population_weight:null,aggregation_weight_sum:populationWeighted?weights.filter(w=>finite(w)&&w>0).reduce((s,w)=>s+w,0):ordered.length,estimator_aggregation:populationWeighted?'Original population-weighted mean of wave estimates':'Arithmetic mean of wave estimates',n_waves:ordered.filter(r=>finite(r.estimate)&&validWeight(r)).length,n_waves_available:ordered.length,n_waves_ratio:paired.length,paired_years:paired.map(p=>p.r.year).join(',')};
      ['estimate','threshold_quantile','maxks','gini','share_top20','share_top10','share_top5','share_top1'].forEach(k=>a[k]=aggregate(k));['n_tail','n_obs'].forEach(k=>a[k]=average(ordered.map(r=>r[k])));
      const pairMean=values=>populationWeighted?weightedAverage(values,paired.map(p=>p.r.population_weight)):average(values);a.ratio_to_wealth=paired.length?pairMean(paired.map(p=>p.r.estimate))/pairMean(paired.map(p=>p.w.estimate)):null;return a;
    });
    const order=(a,b)=>a.country_name.localeCompare(b.country_name)||a.survey.localeCompare(b.survey)||(a.year||0)-(b.year||0)||labels[a.variable].localeCompare(labels[b.variable]);
    return[...(filter.period!=='wave'?averages.sort(order):[]),...(filter.period!=='average'?years.sort(order):[])];
  }
  function renderResults(){
    const signature=(context.getSpecificationSignature||getHousingMethod)()+'|'+JSON.stringify(results,(k,v)=>k==='page'?undefined:v);if(signature!==tableSignature){results.page=0;tableSignature=signature;}
    tableRows=resultData();const pages=Math.max(1,Math.ceil(tableRows.length/50));results.page=Math.max(0,Math.min(results.page,pages-1));
    $('cc-r-count').textContent=tableRows.length?'Rows '+(results.page*50+1)+'–'+Math.min((results.page+1)*50,tableRows.length)+' of '+tableRows.length:'No results for these filters.';$('cc-r-page').textContent='Page '+(results.page+1)+' of '+pages;$('cc-r-prev').disabled=results.page===0;$('cc-r-next').disabled=results.page>=pages-1;$('cc-results-csv').disabled=!tableRows.length;
    const table=$('cc-results-table');table.replaceChildren();const head=document.createElement('thead'),tr=document.createElement('tr');
    ['Country','Survey','Wave / source period','Measure','Method','Cutoff','Tail','KS','Tail / wealth','Waves','Paired waves','Gini','Top 20%','Top 10%','Top 5%','Top 1%'].forEach(t=>{const th=document.createElement('th');th.textContent=t;tr.append(th);});head.append(tr);table.append(head);const body=document.createElement('tbody');
    tableRows.slice(results.page*50,(results.page+1)*50).forEach(r=>{const row=document.createElement('tr');if(r.period_type==='average')row.className='average-row';[r.country_name,r.survey,r.period_label,labels[r.variable],r.method,(r.period_type==='average'&&results.threshold==='ks'?'Mean q ':'')+percent(r.threshold_quantile),number(r.estimate),number(r.maxks,4),number(r.ratio_to_wealth),r.n_waves+'/'+r.n_waves_available,r.n_waves_ratio,number(r.gini),percent(r.share_top20),percent(r.share_top10),percent(r.share_top5),percent(r.share_top1)].forEach(t=>{const td=document.createElement('td');td.textContent=t;row.append(td);});body.append(row);});table.append(body);
    $('cc-r-custom-control').hidden=results.threshold!=='custom';
    $('cc-r-note').textContent='See the Online Appendix for details.';
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
    help.dataset.tooltip+=' Base intervals, in percentile points: '+intervals+'.'+(relationships.minN===0?' Original cells are used without merging or a minimum observation count; empty cells are omitted. Across-wave averages use each cell’s available waves. SCF and HFCS cells must be nonempty in all five imputations.':' Adjacent intervals are merged to retain at least '+relationships.minN+' observations in every relevant wave/adjustment/imputation cell.')+' Each variable is normalized by its wave-specific weighted mean; across-wave points average wave-specific bin statistics. OLS weights displayed bins equally; NLS minimizes squared residuals in levels. Survey definitions differ; see Definitions.';
    if(!plottedRows.length)return;
    relationshipChart=new Chart($('cc-b-chart'),{type:'scatter',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:series.length>1,labels:{filter:item=>!datasets[item.datasetIndex].isFit,usePointStyle:true}},tooltip:{filter:item=>item.dataset.type==='scatter',callbacks:{title:items=>items[0]?.dataset.label||'',label:ctx=>[labels[pair.x]+' / mean: '+number(ctx.raw.x),labels[pair.y]+' / mean: '+number(ctx.raw.y)],afterLabel:ctx=>percent(ctx.raw.q_lo)+'–'+percent(ctx.raw.q_hi)+' · '+ctx.raw.n_obs+' minimum households'}}},scales:{x:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},title:{display:true,text:labels[pair.x]+' / sample mean',font:{size:13}},ticks:{font:{size:13}}},y:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},title:{display:true,text:labels[pair.y]+' / sample mean',font:{size:13}},ticks:{font:{size:13}}}}}});
  }
  async function allResultsCSV(){
    $('cc-results-all').disabled=true;$('cc-r-status').textContent='Preparing international aggregate results…';
    try{
      const fields=['country','country_name','survey','housing_method','source_housing_method','period_type','period_label','year','variant','variable','method','threshold','threshold_quantile','estimate','maxks','ratio_to_wealth','n_waves','n_waves_available','n_waves_ratio','paired_years','population_weight','aggregation_weight_sum','estimator_aggregation','n_tail','n_obs','gini','share_top20','share_top10','share_top5','share_top1'],esc=v=>v===undefined||v===null?'':'"'+String(v).replace(/"/g,'""')+'"',parts=[fields.join(',')+'\r\n'];let n=0;
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
        for(let i=0;i<selected.length;i++){const c=selected[i],source=annualIndex.get([key(c),method].join('|'))||c,m=method.toLowerCase();const rows=c.qs.map((q,j)=>({q,j})).map(({q,j})=>{const w=tail({...c,variable:'networth_val'},method,'custom',q);return{...source,period_type:'wave',period_label:String(c.year),method,threshold:'custom',threshold_quantile:q,estimate:c[m]?.[j]??null,maxks:c['maxks_'+m]?.[j]??null,n_tail:c.n_tail?.[j]??null,ratio_to_wealth:finite(c[m]?.[j])&&finite(w.estimate)&&w.estimate>0?c[m][j]/w.estimate:null,n_waves:finite(c[m]?.[j])?1:0,n_waves_available:1,n_waves_ratio:finite(c[m]?.[j])&&finite(w.estimate)?1:0};});append(rows);if(i%20===0){$('cc-r-status').textContent=number(n,0)+' aggregate rows prepared…';await new Promise(resolve=>setTimeout(resolve,0));}}
      }
      const url=URL.createObjectURL(new Blob(parts,{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='international_inequality_results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('cc-r-status').textContent=number(n,0)+' aggregate rows prepared. Averages precede annual results.';
    }catch(error){$('cc-r-status').textContent='The results download could not be prepared.';console.error(error);}finally{$('cc-results-all').disabled=false;}
  }
  function ensureRelationshipBins(){
    if(!relationshipBinsPromise)relationshipBinsPromise=context.loadInternationalBins().then(rows=>{
      allBins=rows.filter(outsideUS);relationshipBinsReady=true;refreshHousing();updateRelationshipOptions();
    });return relationshipBinsPromise;
  }
  function render(){
    if(!active())return;refreshHousing();
    if(view==='eyeballing')eyeController?.render();else if(view==='summary')renderSummary();else if(view==='quantiles')thresholdController?.render();else if(view==='results')renderResults();else if(relationshipBinsReady){updateRelationshipOptions();$('cc-b-chart').parentElement.removeAttribute('aria-busy');renderRelationships();}else{
      $('cc-b-empty').hidden=false;$('cc-b-empty').textContent='Loading relationship results…';$('cc-b-chart').parentElement.setAttribute('aria-busy','true');$('cc-b-csv').disabled=true;
      ensureRelationshipBins().then(()=>{if(active()&&view==='loglog'){$('cc-b-csv').disabled=false;render();}}).catch(error=>{$('cc-b-empty').textContent='Relationship results could not be loaded. Please reload the page.';console.error(error);});
    }
  }
  [['cc-survey','dataset'],['cc-country','country'],['cc-period','period'],['cc-adjustment','specification'],['cc-method','method']].forEach(([id,k])=>$(id).addEventListener('change',e=>{summary[k]=e.target.value;if(k==='dataset'){summary.country=countries('cc-country',summary.dataset,summary.country,summaryData);}render();}));
  [['cc-r-survey','survey'],['cc-r-country','country'],['cc-r-variable','variable'],['cc-r-adjustment','adjustment'],['cc-r-method','method'],['cc-r-threshold','threshold'],['cc-r-period','period']].forEach(([id,k])=>$(id).addEventListener('change',e=>{results[k]=e.target.value;if(k==='survey'){results.country=countries('cc-r-country',results.survey,results.country,waveRows);}render();}));
  $('cc-r-custom').addEventListener('change',e=>{const q=Number(e.target.value);if(!Number.isInteger(q)||q<70||q>99){$('cc-r-custom-note').textContent='Choose a whole percentile from 70 to 99; unavailable stored cutoffs remain blank.';return;}results.q=q/100;$('cc-r-custom-note').textContent='';render();});
  [['cc-b-country','country'],['cc-b-pair','pair'],['cc-b-adjustment','adjustment'],['cc-b-stat','stat'],['cc-b-bin-min','minN'],['cc-b-scale','scale'],['cc-b-fit','fit']].forEach(([id,k])=>$(id).addEventListener('change',e=>{relationships[k]=k==='minN'?Number(e.target.value):e.target.value;render();}));
  $('cc-r-prev').addEventListener('click',()=>{results.page--;renderResults();});$('cc-r-next').addEventListener('click',()=>{results.page++;renderResults();});
  $('cc-summary-csv').addEventListener('click',()=>download(summaryRows(),'cross_country_summary.csv'));$('cc-results-csv').addEventListener('click',()=>download(tableRows,'international_selected_results.csv'));$('cc-results-all').addEventListener('click',allResultsCSV);$('cc-b-csv').addEventListener('click',()=>download(plottedRows,'international_relationship.csv'));
  updateRelationshipOptions();
  if(typeof ThresholdProfiles!=='undefined'){
    thresholdController=ThresholdProfiles.create({host:$('cc-quantile-profiles'),curves:profileCurves,surveys:['HFCS','SHIW','HILDA','PSID','CEX_BM_RECON'],international:true,metadata:context.metadata||{},getHousingMethod,getSpecificationSignature:context.getSpecificationSignature||getHousingMethod,housingMatches});
  }
  return{render,resize:()=>{if(!active())return;if(view==='eyeballing')eyeController?.resize();else if(view==='summary')renderSummary();else if(view==='quantiles')thresholdController?.resize();else if(view==='loglog')relationshipChart?.resize();}};
}
