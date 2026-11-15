(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const loadingMain=document.querySelector('main'),loadingNav=$('primary-nav');
  if(loadingMain){loadingMain.inert=true;loadingMain.setAttribute('aria-busy','true');}if(loadingNav)loadingNav.inert=true;
  const startupStatus=document.createElement('div');startupStatus.id='aggregate-loading-status';startupStatus.setAttribute('role','status');startupStatus.setAttribute('aria-live','polite');startupStatus.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;background:#fffefa;color:#20354f;border:1px solid #d9d8d1;border-radius:9px;box-shadow:0 8px 28px #151b2a20;padding:14px 22px;font:15px/1.5 Arial,sans-serif';startupStatus.textContent='Loading aggregate results…';document.body.append(startupStatus);
  const embedded=$('explorer-results'),separateBlocks=embedded.dataset.encoding==='separate-gzip-blocks';
  async function readCompressed(part){
    let position=0;
    const compressed=new ReadableStream({pull(controller){
      if(position>=part.length){part='';controller.close();return;}
      const binary=atob(part.slice(position,position+65536));position+=65536;
      const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      controller.enqueue(bytes);
    }});
    return JSON.parse(await new Response(compressed.pipeThrough(new DecompressionStream('gzip'))).text());
  }
  const blockPromises=new Map(),blockTimings=[];
  function loadBlock(key){
    if(!blockPromises.has(key))blockPromises.set(key,(async()=>{
      const node=$('explorer-block-'+key);if(!node)return null;
      const started=performance.now(),encoded=node.textContent;node.textContent='';
      try{const value=await readCompressed(encoded);blockTimings.push({key,ms:Math.round(performance.now()-started)});loadingMain?.setAttribute('data-block-timings',JSON.stringify(blockTimings));return value;}catch(error){node.textContent=encoded;blockPromises.delete(key);throw error;}
    })());return blockPromises.get(key);
  }
  let DATA;
  if(separateBlocks){
    DATA={};
    const initialBlocks=[...document.querySelectorAll('[data-explorer-block][data-lazy="false"]')];
    for(let i=0;i<initialBlocks.length;i++){const node=initialBlocks[i];startupStatus.textContent='Loading aggregate results · '+Math.round(100*i/initialBlocks.length)+'%';DATA[node.dataset.explorerBlock]=await loadBlock(node.dataset.explorerBlock);}
    loadingMain?.setAttribute('data-aggregate-decode-ms',String(Math.round(performance.now())));
    embedded.textContent='';
  }else{
    let encoded=embedded.textContent;embedded.textContent='';
    if(embedded.dataset.encoding==='multipart-gzip-base64'){
      const parts=JSON.parse(encoded);encoded='';DATA={};
      for(const part of parts){const value=await readCompressed(part.data);part.data='';if(part.append){if(!DATA[part.key])DATA[part.key]={columns:value.columns,rows:[]};for(const row of value.rows)DATA[part.key].rows.push(row);}else DATA[part.key]=value;}
    }else DATA=embedded.dataset.encoding==='gzip-base64'?await readCompressed(encoded):JSON.parse(encoded);
  }
  const unpack = table => {
    if(Array.isArray(table))return table;
    if(table?.encoding==='grouped-columns-v1'){
      const rows=[];
      for(const [meta,ids] of table.groups){
        const vectors=ids.map(id=>table.vectors[id]),length=vectors[0]?.length||0;
        for(let i=0;i<length;i++){const row={};table.meta_columns.forEach((key,j)=>row[key]=meta[j]);table.columns.forEach((key,j)=>row[key]=vectors[j][i]);rows.push(row);}
      }return rows;
    }
    if(table?.encoding==='array-pool-v1'){
      const rows=table.rows.map(values=>Object.fromEntries(table.columns.map((key,j)=>[key,values[j]])));
      table.array_refs.forEach(([i,j,id])=>rows[i][table.columns[j]]=table.vectors[id]);return rows;
    }
    const rows=table?.rows||[],columns=table?.columns||[];
    for(let i=0;i<rows.length;i++){const values=rows[i],row={};for(let j=0;j<columns.length;j++)row[columns[j]]=values[j];rows[i]=row;}
    return rows;
  };
  const ALL_SUMMARY=unpack(DATA.summary);
  let ALL_CURVES=unpack(DATA.tail_curves);
  const BIN_AVAILABILITY=unpack(DATA.bivariate);
  let ALL_BINS=BIN_AVAILABILITY,SUMMARY=ALL_SUMMARY,BINS=ALL_BINS,CURVES=ALL_CURVES;
  const META = DATA.metadata || {};
  const loadedBinSurveys=new Set(separateBlocks?[]:ALL_BINS.map(row=>row.survey)),loadedBinBlocks=new Set(),binPromises=new Map();
  const housing={method:'benchmark'};
  const weighting={method:'scf_income'};
  const housingMethod=row=>row.housing_method||'benchmark';
  const weightingMethod=row=>row.weighting_method||'scf_income';
  const housingSource=(survey,method=housing.method)=>META.housing_method_aliases?.[survey]?.[method]||method;
  const housingMatches=row=>housingMethod(row)===housingSource(row.survey||'PSID');
  const weightingMatches=row=>['PSID','CEX'].includes(row.survey)&&row.variant==='full'?weightingMethod(row)===weighting.method:weightingMethod(row)==='scf_income';
  const specificationMatches=row=>housingMatches(row)&&weightingMatches(row);
  const detailedCurveSurveys=[...document.querySelectorAll('[data-explorer-block^="tail_curves_"]')].map(node=>node.dataset.explorerBlock.slice('tail_curves_'.length)),loadedCurveSurveys=new Set(detailedCurveSurveys.length?[]:ALL_CURVES.map(row=>row.survey)),curvePromises=new Map();
  async function ensureFullCurves(surveys=detailedCurveSurveys){
    await Promise.all(surveys.filter(survey=>detailedCurveSurveys.includes(survey)).map(survey=>{
      if(loadedCurveSurveys.has(survey))return;
      if(!curvePromises.has(survey))curvePromises.set(survey,(async()=>{
        const key='tail_curves_'+survey,rows=unpack(await loadBlock(key));blockPromises.delete(key);
        ALL_CURVES=ALL_CURVES.filter(row=>row.survey!==survey).concat(rows);rows.forEach(row=>curveIndex.set(curveKey(row),row));loadedCurveSurveys.add(survey);CURVES=ALL_CURVES.filter(specificationMatches);
      })().catch(error=>{curvePromises.delete(survey);throw error;}));return curvePromises.get(survey);
    }));
  }
  async function ensureDeferredBlock(key){if(!DATA[key])DATA[key]=await loadBlock(key);return DATA[key];}
  const binScopeMatches=(row,scope)=>row.survey===scope.survey&&housingMethod(row)===scope.housing_method&&weightingMethod(row)===scope.weighting_method&&(row.capital_income_definition||'benchmark')===scope.capital_income_definition&&(!FINITE(scope.bin_min_n)||Number(row.bin_min_n??10)===scope.bin_min_n);
  function selectedBinBlocks(survey,{all=false,minN=b.minN,adjustment=b.adjustment}={}){
    const scopes=(META.relationship_blocks||[]).filter(scope=>scope.survey===survey);
    if(!scopes.length)return null;
    const method=survey==='PSID'&&adjustment==='full'?weighting.method:'scf_income',definition=all?'benchmark':capitalIncomeDefinition();
    return scopes.filter(scope=>scope.housing_method===housingSource(survey)&&scope.weighting_method===method&&scope.capital_income_definition===definition&&(!FINITE(scope.bin_min_n)||scope.bin_min_n===minN));
  }
  const bivariateReady=survey=>{const scopes=selectedBinBlocks(survey);return scopes?scopes.every(scope=>loadedBinBlocks.has(scope.key)):loadedBinSurveys.has(survey);};
  async function ensureBivariate(surveys,selection={}){
    await Promise.all(surveys.map(survey=>{
      const scopes=selectedBinBlocks(survey,selection);
      if(scopes)return Promise.all(scopes.map(scope=>{
        if(loadedBinBlocks.has(scope.key))return;
        if(!binPromises.has(scope.key))binPromises.set(scope.key,(async()=>{
          const rows=unpack(await loadBlock(scope.key));blockPromises.delete(scope.key);ALL_BINS=ALL_BINS.filter(row=>!binScopeMatches(row,scope)).concat(rows);loadedBinBlocks.add(scope.key);BINS=ALL_BINS.filter(specificationMatches);
        })().catch(error=>{binPromises.delete(scope.key);throw error;}));return binPromises.get(scope.key);
      }));
      if(loadedBinSurveys.has(survey))return;
      if(!binPromises.has(survey))binPromises.set(survey,(async()=>{
        const [merged,unmerged]=await Promise.all([loadBlock('bins_'+survey),loadBlock('bins_unmerged_'+survey)]),rows=unpack(merged).concat(unpack(unmerged));blockPromises.delete('bins_'+survey);blockPromises.delete('bins_unmerged_'+survey);ALL_BINS=ALL_BINS.filter(row=>row.survey!==survey).concat(rows);loadedBinSurveys.add(survey);BINS=ALL_BINS.filter(specificationMatches);
      })());return binPromises.get(survey);
    }));
  }
  let internationalBinsPromise;
  function loadInternationalBins(){if(!internationalBinsPromise)internationalBinsPromise=(async()=>{let rows;if(separateBlocks){const [merged,unmerged]=await Promise.all([loadBlock('other_bins'),loadBlock('bins_unmerged_international')]);rows=unpack(merged).concat(unpack(unmerged));}else rows=unpack(DATA.other?.bivariate);blockPromises.delete('other_bins');blockPromises.delete('bins_unmerged_international');return rows;})();return internationalBinsPromise;}
  function renderBivariateWhenReady(){
    syncBivariateCapitalControls();
    const surveys=[...selectedSurveys(b)];
    if(surveys.every(bivariateReady)){$('biv-chart').parentElement.removeAttribute('aria-busy');renderBivariate();return;}
    const empty=$('biv-empty');empty.hidden=false;empty.textContent='Loading relationship results…';$('biv-chart').parentElement.setAttribute('aria-busy','true');$('download-biv-csv').disabled=true;$('download-biv-png').disabled=true;
    ensureBivariate(surveys).then(()=>{fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);if(bivVisible())schedule();}).catch(error=>{empty.textContent='Relationship results could not be loaded. Please reload the page.';console.error(error);});
  }
  const isCEX=survey=>['CEX','CEX_BM','CEX_BM_RECON'].includes(survey);
  const sourceDisplay=survey=>survey==='CEX_BM_RECON'?(META.cex_bm_recon_display||META.cex_bm_display||META.cex_display):survey==='CEX_BM'?(META.cex_bm_display||META.cex_display):META.cex_display;
  const cexRecordUnit=META.surveys?.CEX?.record_unit||'consumer-unit-interview';
  const cexAnnual=['household-year','consumer-unit-year'].includes(cexRecordUnit);
  const cexTailUnit=META.cex_display?.tail_unit||(cexRecordUnit==='household-year'?'household-years':cexRecordUnit==='consumer-unit-year'?'consumer-unit-years':'distinct consumer units');
  const cexRecordAggregation=META.cex_display?.record_aggregation||(cexRecordUnit==='household-year'?'one household/address-year, averaged available quarterly reports':cexRecordUnit==='consumer-unit-year'?'one consumer-unit-year, averaged available quarterly reports':'quarterly consumer-unit interview records');
  const cexCountsNote=META.cex_display?.counts||META.cex_display?.counts_note||(cexRecordUnit==='household-year'?'Each CEX record and tail unit is one verified single-CU household/address-year, averaging available quarterly reports; repeated interviews do not count as separate annual observations.':cexRecordUnit==='consumer-unit-year'?'Each CEX record and tail unit is one consumer-unit-year, averaging available quarterly reports; repeated interviews do not count as separate annual observations.':'CEX tail units count distinct consumer units, while records count quarterly interviews.');
  const tailUnit=survey=>isCEX(survey)?(META.surveys?.[survey]?.tail_unit||sourceDisplay(survey)?.tail_unit||cexTailUnit):'households';
  const FINITE = x => typeof x === 'number' && Number.isFinite(x);
  const avg = a => { const x = a.filter(FINITE); return x.length ? x.reduce((s,v)=>s+v,0)/x.length : null; };
  const num = (x,d=2) => FINITE(x) ? x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const pct = x => FINITE(x) ? num(100*x,1)+'%' : '—';
  // Author's series_cols in PSID/0_PSID_final_figures.R.
  const COLORS = {spending:'#477EAD',total_labor_income:'#BF5555',total_capital_income:'#C4A12A',total_income:'#A96F4B',networth_val:'#4D8B69'};
  const KEYS = ['spending','total_labor_income','total_capital_income','networth_val'];
  const LABELS = {total_labor_income:'Labor income',total_capital_income:'Capital income',total_income:'Total income',networth_val:'Net worth'};
  const ADJ = {raw:'Raw data',adj:'Rescaled',full:'Fully adjusted'};
  const adjustmentLabel=row=>isCEX(row.survey)&&row.variable==='networth_val'&&row.variant==='full'&&!ALL_SUMMARY.some(value=>value.survey===row.survey&&value.variable==='networth_val'&&value.variant==='adj'&&housingMethod(value)===housingMethod(row))?'Income reweighted':row.survey==='SCF'&&row.variant==='adj'?'Rescaled':row.variant==='original'?'Original B&M construction':ADJ[row.variant]||row.variant;
  const PAIRS = {
    wealth_consumption:{x:'networth_val',y:'spending'}, income_consumption:{x:'total_income',y:'spending'},
    labor_consumption:{x:'total_labor_income',y:'spending'},capital_consumption:{x:'total_capital_income',y:'spending'},
    wealth_capital:{x:'networth_val',y:'total_capital_income'}
  };
  const FALLBACK_SPENDING=[
    {value:'flow',key:'consump_def1',label:'Consumption'},
    {value:'expenditure',key:'expenditure',label:'Total expenditure, excluding imputed rent'},
    {value:'expenditure_incl_rent',key:'expenditure_incl_rent',label:'Total expenditure, including imputed rent'},
    {value:'food_housing_vacation',key:'food_housing_vacation',label:'Food + housing + vacation'},
    {value:'food_housing_vacation_donations_vehicle',key:'food_housing_vacation_donations_vehicle',label:'Food + housing + vacation + donations + vehicle services'},
    {value:'vacation',key:'vacation',label:'Vacation'},
    {value:'core',key:'core_consumption',label:'Core consumption (CEX)'}
  ];
  const hiddenSpending=new Set(['food_home','food_away','food_housing','food_housing_vehicle']);
  const spendingOptions=(Array.isArray(META.spending_options)?META.spending_options:FALLBACK_SPENDING).filter(option=>!hiddenSpending.has(option.key)&&(SUMMARY.some(r=>r.variable===option.key)||BINS.some(r=>r.yvar===option.key)));
  const s = {tab:'inequality',primary:'psid',primaryEnabled:true,overlays:new Set(['scf','yodlee','forbes']),metric:'pareto',paretoMetric:'pareto',shareMetric:'share_top20',adjustment:'full',method:'MLE',threshold:'ks',customQ:.95,measure:'flow',variables:new Set(KEYS)};
  const r = {survey:'psid',datasets:new Set(['PSID']),yodleeVariant:'all',variable:'all',adjustment:'full',method:'MLE',threshold:'ks',customQ:.95};
  const b = {primary:'psid',overlays:new Set(),adjustment:'full',measure:'flow',pair:'wealth_consumption',wave:'average',scfWave:'2025',cexWave:'latest',reconWave:'latest',bmWave:'latest',stat:'mean',minN:5,excludeNetRent:false,beforePersonalInterest:false,traces:false,scale:'loglog',fit:'ols'};
  let timeChart,bivChart,otherController,adjustmentController,thresholdController,referenceController,dataController,frame,timeRows=[],binRows=[],resultRows=[],resultPage=0,allResultsBusy=false,lastUSTab='inequality',profileSurvey='PSID';
  const VISIBLE_US_SURVEYS=new Set(['PSID','SCF','CEX_BM_RECON']);
  const BIVARIATE_SURVEYS=new Set([...BIN_AVAILABILITY.map(row=>row.survey),...(META.relationship_blocks||[]).map(scope=>scope.survey)]),hasCorrectedCEXBins=BIVARIATE_SURVEYS.has('CEX_BM_RECON');
  const surveyChoices=()=>['psid','scf',...(ALL_SUMMARY.some(row=>row.survey==='CEX_BM_RECON')?['cex_bm_recon']:[])];
  const bivariateSurveyChoices=()=>['psid','scf','cex_bm_recon'].filter(survey=>BIVARIATE_SURVEYS.has(survey.toUpperCase()));
  const mainOverlayChoices=()=>[...surveyChoices(),...(referenceController?.sources||[]).map(x=>x.toLowerCase())];
  const surveyName=survey=>survey.toUpperCase()==='YODLEE'?'Yodlee (bank data)':survey.toUpperCase()==='CEX_BM_RECON'?'CEX':survey.toUpperCase()==='CEX'&&hasCorrectedCEXBins?'CEX (previous construction)':META.surveys?.[survey.toUpperCase()]?.label||(survey.toUpperCase()==='CEX_BM'?'CEX B&M':referenceController?.labels[survey.toUpperCase()]||survey.toUpperCase());
  const SURVEY_TOOLTIPS={
    PSID:'Panel Study of Income Dynamics: longitudinal U.S. household panel covering consumption, income, and wealth.',
    SCF:'Survey of Consumer Finances: triennial U.S. household survey designed to measure household finances and oversample wealthy families.',
    CEX:'Consumer Expenditure Interview Survey: consumer-unit interviews covering spending, income, and partial wealth.',
    CEX_BM:'Authors’ supplied CEX B&M reference series, retained unchanged.',
    CEX_BM_RECON:'Public CEX construction based on Meyer–Sullivan with PSID extensions. '+(META.surveys?.CEX_BM_RECON?.profile_note||'B&M equivalence scale and person weights, with PSID-style housing and durable services.')+' '+(META.surveys?.CEX_BM_RECON?.coverage_note||''),
    YODLEE:'Bank–individual-account transaction data: each observation is one person’s account within the sampled banking system, not a complete household consumption unit. Spending outside the observed account—such as cash or activity at other institutions—is not captured. SCF income weights are always used to improve representativeness.',
    NIELSEN:'NielsenIQ household-panel reference based on annual retail purchases. It is available only when “Variable for consumption” is Food because it does not measure the broader consumption concepts used by the other choices.',
    FORBES:'World’s Billionaires + Forbes 400, 1982–2024: one weight per distinct listed person or family fortune, with overlaps removed. The lists use different dates within a year; early coverage relies on historical Forbes 400 records. Annual source counts are available in Data.'
  };
  const surveyTooltip=survey=>SURVEY_TOOLTIPS[survey.toUpperCase()]||surveyName(survey);
  const spendingKey = measure => spendingOptions.find(option=>option.value===measure)?.key || FALLBACK_SPENDING.find(option=>option.value===measure)?.key || measure;
  const spendingName = measure => spendingOptions.find(option=>option.value===measure)?.label || FALLBACK_SPENDING.find(option=>option.value===measure)?.label || measure;
  const label = (key,measure) => key==='spending' ? spendingName(measure) : LABELS[key] || key;
  const sourceKey = (key,measure) => key==='spending' ? spendingKey(measure) : key;
  const displayLabel = (key,measure,survey) => isCEX(survey)?(sourceDisplay(survey)?.labels?.[sourceKey(key,measure)]||({networth_val:'Partial net worth (CEX)',total_capital_income:'Observed capital income (CEX)'})[sourceKey(key,measure)]||label(key,measure)):label(key,measure);
  const variableDisplayLabel = (variable,survey) => (isCEX(survey)?sourceDisplay(survey)?.labels?.[variable]:null)||META.variables?.[variable]?.label||spendingOptions.find(option=>option.key===variable)?.label||LABELS[variable]||variable.replace(/_/g,' ');
  const wealthDenominatorLabel = survey => isCEX(survey)?(sourceDisplay(survey)?.labels?.networth_val||'Partial net worth (CEX)'):'Net worth';
  const bmOriginalOnly=!ALL_SUMMARY.some(row=>row.survey==='CEX_BM'&&['raw','adj','full'].includes(row.variant));
  const variantFor = (survey,adjustment=s.adjustment) => survey==='CEX_BM'&&bmOriginalOnly?'original':adjustment;
  const bivariateVariantFor=survey=>survey==='CEX_BM'?'raw':variantFor(survey,b.adjustment);
  const selectedSurveys = state => new Set([...(state.primaryEnabled===false?[]:[state.primary.toUpperCase()]),...[...state.overlays].map(value=>value.toUpperCase())]);
  const include = (selection,survey) => selection instanceof Set?selection.has(survey):(selection==='both'||selection===survey.toLowerCase());
  const isParetoMetric = metric => metric==='pareto'||metric==='pareto_wealth_ratio';
  const HOUSEHOLD_SURVEYS=new Set(['PSID','SCF','CEX','CEX_BM','CEX_BM_RECON']),ADJUSTABLE_SURVEYS=new Set(['PSID','SCF','CEX','CEX_BM_RECON']);
  const indicatorKind=metric=>isParetoMetric(metric)?'pareto':metric.startsWith('share_')?'shares':'gini';
  const metricLabel = () => ({pareto:'Pareto tail coefficients',pareto_wealth_ratio:'Pareto coefficients relative to wealth',gini:'Gini coefficients',share_top20:'Top 20% shares',share_top10:'Top 10% shares',share_top5:'Top 5% shares',share_top1:'Top 1% shares'})[s.metric];
  const format = value => s.metric.startsWith('share_') ? pct(value) : num(value,2);
  const years = [...new Set(SUMMARY.filter(r=>r.survey==='PSID').map(r=>r.year))].sort((a,c)=>a-c);
  const scfYears = [...new Set(SUMMARY.filter(r=>r.survey==='SCF').map(r=>r.year))].sort((a,c)=>a-c);
  const cexYears = [...new Set(SUMMARY.filter(r=>r.survey==='CEX').map(r=>r.year))].sort((a,c)=>a-c);
  const cexBivYears=[...new Set(BINS.filter(row=>row.survey==='CEX').map(row=>row.year).filter(FINITE))].sort((a,b)=>a-b);
  const bmYears=[...new Set(ALL_SUMMARY.filter(row=>row.survey==='CEX_BM').map(row=>row.year))].sort((a,b)=>a-b);
  const bmReconYears=[...new Set(ALL_SUMMARY.filter(row=>row.survey==='CEX_BM_RECON').map(row=>row.year))].sort((a,b)=>a-b);
  const surveyYears={PSID:years,SCF:scfYears,CEX:cexYears,CEX_BM:bmYears,CEX_BM_RECON:bmReconYears};
  const yearRange = values => values.length ? (values.length===1?String(values[0]):values[0]+'–'+values[values.length-1]) : '';
  const yearList = values => {const groups=[];values.forEach(year=>{const last=groups[groups.length-1];if(last&&year===last[last.length-1]+1)last.push(year);else groups.push([year]);});return groups.map(yearRange).join(', ');};
  const availableYears = (survey,variable,variant) => [...new Set(SUMMARY.filter(r=>r.survey===survey&&r.variable===variable&&(!variant||r.variant===variant)).map(r=>r.year))].sort((a,c)=>a-c);
  const mainVisible = () => !$('panel-inequality').hidden;
  const bivVisible = () => !$('panel-loglog').hidden;
  const otherVisible = () => !$('panel-other').hidden;
  const adjustmentsVisible = () => !$('panel-adjustments').hidden;
  const dataVisible = () => !$('panel-data').hidden;
  const resultsVisible = () => !$('panel-results').hidden;
  const quantilesVisible = () => !$('panel-quantiles').hidden;
  const curveKey = row => [row.survey,row.year,row.variant,row.variable,housingMethod(row),weightingMethod(row)].join('|');
  const curveIndex = new Map(ALL_CURVES.map(curve=>[curveKey(curve),curve]));
  const summaryIndex = new Map(ALL_SUMMARY.map(row=>[curveKey(row),row]));
  const thresholdQ = (rule=s.threshold,customQ=s.customQ) => {const q=rule==='ks'?null:rule==='custom'?customQ:Number(rule.slice(1))/100;return FINITE(q)?q:null;};
  const thresholdName = (state=s) => state.threshold==='ks'?'KS-selected thresholds':state.threshold==='custom'?'Percentile '+num(100*state.customQ,1)+' thresholds':({p80:'Top 20% · 80th-percentile thresholds',p90:'Top 10% · 90th-percentile thresholds',p95:'Top 5% · 95th-percentile thresholds',p98:'Top 2% · 98th-percentile thresholds',p99:'Top 1% · 99th-percentile thresholds'})[state.threshold];
  function tailResult(row,method=s.method,rule=s.threshold,customQ=s.customQ,preserve=true) {
    const curve=curveIndex.get(curveKey(row));if(!curve)return {estimate:null,q:thresholdQ(rule,customQ),maxks:null,n_tail:null};
    const key=method.toLowerCase();
    if(rule==='ks'){
      const fit=curve['ks_'+key],counts=(fit?.imputation_fits||[]).map(item=>item.n_tail).filter(FINITE),count=FINITE(fit?.n_tail)?fit.n_tail:counts.length?Math.min(...counts):null;
      if(!FINITE(fit?.estimate))return {estimate:null,q:fit?.q??null,maxks:fit?.maxks??null,n_tail:count};
      return {estimate:preserve&&method==='MLE'&&FINITE(row.pareto_ks)?row.pareto_ks:fit.estimate,q:preserve&&method==='MLE'&&FINITE(row.q_ks)?row.q_ks:fit.q,maxks:fit.maxks??null,n_tail:count};
    }
    const q=thresholdQ(rule,customQ);if(!curve.qs)return {estimate:null,q,maxks:null,n_tail:null};const index=Math.round((q-curve.qs[0])/.001);
    if(index<0||index>=curve.qs.length||Math.abs(curve.qs[index]-q)>1e-7||!FINITE(curve[key]?.[index]))return {estimate:null,q,maxks:null,n_tail:curve.n_tail?.[index]??null};
    const shortcut=rule!=='custom'&&method==='MLE'&&FINITE(row['pareto_'+rule]);
    return {estimate:preserve&&shortcut?row['pareto_'+rule]:curve[key][index],q,maxks:curve['maxks_'+key]?.[index]??null,n_tail:curve.n_tail?.[index]??null};
  }
  const metricValue = row => {const fit=tailResult(row);return s.metric==='pareto'?fit.estimate:s.metric==='pareto_wealth_ratio'?tailWealthRatio(row,fit):row[s.metric];};
  function wealthTail(row,method=s.method,rule=s.threshold,q=s.customQ) {
    const wealthRow=summaryIndex.get(curveKey({...row,variable:'networth_val'}))||{...row,variable:'networth_val'},wealth=tailResult(wealthRow,method,rule,q);
    return wealth;
  }
  function tailWealthRatio(row,fit,method=s.method,rule=s.threshold,q=s.customQ) {
    const wealth=wealthTail(row,method,rule,q);return FINITE(fit.estimate)&&FINITE(wealth.estimate)&&wealth.estimate>0?fit.estimate/wealth.estimate:null;
  }

  function announce(text) { $('live-announcement').textContent=text; }
  let viewRequest=0;
  async function prepareView(){
    if(mainVisible()&&s.threshold!=='ks')await ensureFullCurves([...selectedSurveys(s)]);
    if(resultsVisible()&&r.threshold!=='ks')await ensureFullCurves([...resultsSurveys()]);
    if(quantilesVisible()){await ensureFullCurves(['PSID','SCF','CEX_BM_RECON']);initializeThresholdController();}
    if(otherVisible()){await Promise.all([ensureDeferredBlock('other'),ensureFullCurves(['PSID','CEX_BM_RECON'])]);initializeOtherController();}
    if(adjustmentsVisible()){await ensureDeferredBlock('adjustments');initializeAdjustmentController();}
  }
  function schedule() {
    const request=++viewRequest;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(async()=>{try{
      $('page-error').hidden=true;
      const preparation=prepareView();
      const pending=quantilesVisible()&&!thresholdController||otherVisible()&&!otherController||adjustmentsVisible()&&!adjustmentController||(mainVisible()&&s.threshold!=='ks'?[...selectedSurveys(s)]:resultsVisible()&&r.threshold!=='ks'?[...resultsSurveys()]:[]).some(survey=>detailedCurveSurveys.includes(survey)&&!loadedCurveSurveys.has(survey));
      if(pending){startupStatus.textContent='Loading selected results…';document.body.append(startupStatus);loadingMain?.setAttribute('aria-busy','true');}
      await preparation;if(request!==viewRequest)return;
      if(mainVisible())renderTime();if(resultsVisible())renderResults();if(quantilesVisible())thresholdController?.render();if(bivVisible())renderBivariateWhenReady();if(otherVisible())otherController?.render();if(adjustmentsVisible()&&(!dataController||dataController.isProcedureVisible()))adjustmentController?.render();if(dataVisible()||adjustmentsVisible())dataController?.render();
      if(!loadingMain?.dataset.firstPlotMs)loadingMain?.setAttribute('data-first-plot-ms',String(Math.round(performance.now())));
      startupStatus.remove();loadingMain?.removeAttribute('aria-busy');
    }catch(error){if(request!==viewRequest)return;startupStatus.remove();loadingMain?.removeAttribute('aria-busy');$('page-error').hidden=false;$('page-error').textContent='The selected plot could not be drawn. Please change the selection or reload the page.';console.error(error);}});
  }
  function tab(name) {
    const us=['inequality','quantiles','results','loglog'].includes(name);if(us)lastUSTab=name;s.tab=name;
    $('us-secondary-nav').hidden=!us;$('live-announcement').hidden=name!=='inequality';if(name!=='inequality')$('live-announcement').textContent='';
    const housingControl=document.querySelector('.global-housing-control:not(.quantile-housing-control)'),housingNav=us?$('us-secondary-nav')?.querySelector('.secondary-nav-inner'):name==='other'?$('cc-secondary-nav')?.querySelector('.secondary-nav-inner'):name==='adjustments'?$('dc-adjustments-nav-inner'):null;
    if(housingControl){housingControl.hidden=!housingNav;if(housingNav)housingNav.append(housingControl);}
    document.querySelectorAll('#primary-nav [data-section]').forEach(button=>{const active=button.dataset.section===(us?'us':name);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);if(button.dataset.section==='us')button.setAttribute('aria-controls','panel-'+lastUSTab);});
    document.querySelectorAll('#us-secondary-nav [data-tab]').forEach(button=>{const active=button.dataset.tab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);});
    ['inequality','quantiles','results','loglog','other','adjustments','data','definitions','repository'].forEach(key=>{const panel=$('panel-'+key),active=key===name;panel.hidden=!active;panel.classList.toggle('active',active);});syncHousingAvailability();schedule();
  }
  document.querySelectorAll('#us-secondary-nav [data-tab]').forEach(button=>{
    button.addEventListener('click',()=>tab(button.dataset.tab));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const all=[...document.querySelectorAll('#us-secondary-nav [data-tab]')];let index=all.indexOf(button);if(event.key==='Home')index=0;else if(event.key==='End')index=all.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;all[index].focus();tab(all[index].dataset.tab);});
  });
  document.querySelectorAll('#primary-nav [data-section]').forEach(button=>{
    button.addEventListener('click',()=>tab(button.dataset.section==='us'?lastUSTab:button.dataset.section));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const all=[...document.querySelectorAll('#primary-nav [data-section]')];let index=all.indexOf(button);if(event.key==='Home')index=0;else if(event.key==='End')index=all.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;all[index].focus();tab(all[index].dataset.section==='us'?lastUSTab:all[index].dataset.section);});
  });

  function fillSeries() {
    $('series-controls').replaceChildren();
    KEYS.forEach(key=>{
      const item=document.createElement('label'); item.className='series-choice'; item.style.setProperty('--series',COLORS[key]);
      const input=document.createElement('input'); input.type='checkbox'; input.checked=s.variables.has(key); input.setAttribute('aria-label',displayLabel(key,s.measure,s.primary.toUpperCase()));
      const selected=selectedSurveys(s),surveyAvailable=SUMMARY.some(row=>selected.has(row.survey)&&row.variant===variantFor(row.survey,s.adjustment)&&row.variable===sourceKey(key,s.measure)),referenceAvailable=key==='spending'&&(selected.has('YODLEE')||selected.has('NIELSEN'))||key==='networth_val'&&selected.has('FORBES');input.disabled=!surveyAvailable&&!referenceAvailable;
      input.addEventListener('change',()=>{ input.checked?s.variables.add(key):s.variables.delete(key);if(key==='networth_val'&&!input.checked&&s.overlays.has('forbes')){s.overlays.delete('forbes');fillOverlays('overlay-controls',s,mainOverlayChoices());}schedule(); });
      const swatch=document.createElement('span'); swatch.className='series-swatch'; const text=document.createElement('span'); text.textContent=displayLabel(key,s.measure,s.primary.toUpperCase());
      item.append(input,swatch,text); $('series-controls').append(item);
    });
  }
  function fillSpendingSelect(id,selection,state,source) {
    const select=$(id);select.replaceChildren();
    const available=option=>source.some(r=>include(selection,r.survey)&&r.variant===(state===b?bivariateVariantFor(r.survey):variantFor(r.survey,state.adjustment))&&(r.variable===option.key||r.yvar===option.key))||(state===s&&selection instanceof Set&&((selection.has('YODLEE')&&['flow','expenditure','vacation','food_home','food_away','food_total'].includes(option.value))||(selection.has('NIELSEN')&&option.value==='food_total')));
    spendingOptions.filter(available).forEach(item=>{const option=document.createElement('option');option.value=item.value;option.textContent=isCEX(typeof selection==='string'?selection.toUpperCase():'')?(sourceDisplay(selection.toUpperCase())?.labels?.[item.key]||item.label):item.label;select.append(option);});
    const current=spendingOptions.find(option=>option.value===state.measure);
    if(!current||!available(current)) state.measure=['flow','expenditure','food_housing_vacation','food_housing_vacation_donations_vehicle','vacation','core'].find(value=>spendingOptions.some(option=>option.value===value&&available(option)))||spendingOptions.find(available)?.value||state.measure;
    select.value=state.measure;
    select.title=isCEX(typeof selection==='string'?selection.toUpperCase():'')?(sourceDisplay(selection.toUpperCase())?.labels?.[spendingKey(state.measure)]||spendingName(state.measure)):spendingName(state.measure);
  }
  function fillOverlays(id,state,choices) {
    const fieldset=$(id),unified=id==='overlay-controls'||id==='biv-overlay-controls';fieldset.replaceChildren();
    (unified?choices:choices.filter(survey=>survey!==state.primary)).forEach(survey=>{
      const item=document.createElement('label'),name=surveyName(survey),description=surveyTooltip(survey),labelText=document.createElement('span'),help=document.createElement('span');
      item.className='overlay-choice small-check overlay-choice-'+survey;
      labelText.textContent=name;help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=description;help.setAttribute('aria-label','About '+name);
      const input=document.createElement('input'),reference=!surveyChoices().includes(survey),ratioUnavailable=state===s&&s.metric==='pareto_wealth_ratio'&&reference,nielsenUnavailable=state===s&&survey==='nielsen'&&state.measure!=='food_total',locked=state===b&&survey==='psid';input.type='checkbox';input.checked=(survey===state.primary&&state.primaryEnabled!==false)||state.overlays.has(survey);input.disabled=ratioUnavailable||nielsenUnavailable||locked;input.title=locked?'PSID remains selected as the reference dataset.':ratioUnavailable?'This reference series has no matching wealth coefficient.':nielsenUnavailable?'Select Food under “Variable for consumption” to use NielsenIQ.':'';item.classList.toggle('unavailable-option',ratioUnavailable||nielsenUnavailable);input.setAttribute('aria-label',(unified?'Show ':'Compare with ')+name+'. '+description);input.addEventListener('change',()=>{
        if(unified){
          if(input.checked){if(survey===state.primary)state.primaryEnabled=true;else state.overlays.add(survey);}
          else if(selectedSurveys(state).size<=1){input.checked=true;announce('At least one dataset must remain selected.');return;}
          else if(survey===state.primary)state.primaryEnabled=false;
          else state.overlays.delete(survey);
        }else input.checked?state.overlays.add(survey):state.overlays.delete(survey);
        if(state===s&&survey==='forbes'&&input.checked)state.variables.add('networth_val');
        if(state===s){syncHousingAvailability();syncMainCapabilities();fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());}
        if(state===b){syncHousingAvailability();fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);}
        schedule();
      });item.append(input,labelText,help);fieldset.append(item);
    });
  }
  function destroy(canvas,chart) { const existing=Chart.getChart($(canvas)); if(existing) existing.destroy(); else if(chart) chart.destroy(); }
  function renderTime() {
    destroy('time-chart',timeChart);timeChart=null;timeRows=[];
    syncMainCapabilities();
    const datasets=[],selected=selectedSurveys(s),styles={PSID:{point:'circle',dash:[],radius:4.5},SCF:{point:'rectRot',dash:[5,4],radius:6},CEX:{point:'triangle',dash:[2,4],radius:6},CEX_BM:{point:'crossRot',dash:[8,3,2,3],radius:8},CEX_BM_RECON:{point:'triangle',dash:[2,4],radius:6}};
    KEYS.filter(key=>s.variables.has(key)).forEach(key=>{
      const variable=sourceKey(key,s.measure),color=COLORS[key];
      [...selected].forEach(survey=>{
        if(isParetoMetric(s.metric)&&s.threshold==='p99'&&HOUSEHOLD_SURVEYS.has(survey)&&survey!=='SCF')return;
        const variant=variantFor(survey),style=styles[survey];
        const rows=SUMMARY.filter(row=>row.survey===survey&&row.variant===variant&&row.variable===variable).sort((a,b)=>a.year-b.year);
        if(!rows.some(row=>FINITE(metricValue(row))))return;
        const sourceYears=surveyYears[survey]||[],chartYears=isCEX(survey)&&sourceYears.length?Array.from({length:sourceYears[sourceYears.length-1]-sourceYears[0]+1},(_,i)=>sourceYears[0]+i):sourceYears;
        datasets.push({label:displayLabel(key,s.measure,survey)+' · '+surveyName(survey),survey,key,variable,type:'line',data:chartYears.map(year=>{const row=rows.find(r=>r.year===year),fit=row?tailResult(row):null;return {x:year,y:row&&FINITE(metricValue(row))?metricValue(row):null,q:fit?.q,maxks:fit?.maxks,n_tail:fit?.n_tail};}),showLine:rows.length>1,spanGaps:false,tension:0,borderColor:color,backgroundColor:color,borderWidth:survey==='PSID'?2.5:1.7,borderDash:style.dash,pointStyle:style.point,pointRadius:rows.length===1?7:style.radius,pointHoverRadius:survey==='CEX_BM'?10:8.5,pointHitRadius:10,pointBackgroundColor:survey==='PSID'?'#fff':color,pointBorderColor:survey==='PSID'||survey==='CEX_BM'?color:'#fff',pointBorderWidth:survey==='CEX_BM'?2.4:1.3});
        rows.filter(row=>FINITE(metricValue(row))).forEach(row=>{const fit=tailResult(row),wealth=wealthTail(row),value=metricValue(row);timeRows.push({survey,housing_method:housing.method,source_housing_method:housingMethod(row),weighting_method:weightingMethod(row),wave:row.year,adjustment:variant,source_variant:variant,variable,variable_label:variableDisplayLabel(variable,survey),indicator:s.metric,method:isParetoMetric(s.metric)?s.method:'',threshold:isParetoMetric(s.metric)?s.threshold:'',estimate:value,pareto_estimate:isParetoMetric(s.metric)?fit.estimate:null,wealth_pareto_estimate:s.metric==='pareto_wealth_ratio'?wealth.estimate:null,threshold_quantile:isParetoMetric(s.metric)?fit.q:null,ks:isParetoMetric(s.metric)?fit.maxks:null,n_tail:isParetoMetric(s.metric)?fit.n_tail:null,tail_unit_type:tailUnit(survey)});});
      });
    });
    datasets.push(...(referenceController?.datasets(s)||[]));
    (referenceController?.plotted(s)||[]).forEach(row=>timeRows.push({survey:row.survey,wave:row.year,adjustment:'Standalone reference: '+row.author_variant,variable:row.variable,variable_label:row.source_label,indicator:'pareto',method:row.method,threshold:row.threshold_rule,estimate:row.estimate,threshold_quantile:row.threshold_quantile,ks:row.ks,source_definition:row.source_definition}));
    $('time-chart-title').textContent=metricLabel();
    const weightingLabel=s.adjustment==='full'&&selected.has('PSID')?({scf_income:'SCF income weights',irs_income:'IRS income weights',scf_wealth:'SCF wealth weights'})[weighting.method]:'';
    $('time-chart-subtitle').textContent=[isParetoMetric(s.metric)?s.method+' · '+thresholdName()+(s.metric==='pareto_wealth_ratio'?' · each series divided by wealth':''):'',weightingLabel].filter(Boolean).join(' · ');
    $('time-empty').hidden=!!datasets.length;$('time-empty').textContent=s.variables.size?'No comparable results for this selection.':'Select at least one measure.';
    $('download-time-csv').disabled=!timeRows.length;$('download-time-png').disabled=!datasets.length;
    $('time-variant').value=bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM')?'original':s.adjustment;syncMainCapabilities();
    const notes=[];
    if(housing.method==='bp')notes.push('Homeowner services use the constant housing-value-rate version. Only computed or verified equivalent housing definitions are shown.');
    if(weighting.method==='irs_income')notes.push('PSID fully adjusted results use IRS income weights.');
    if(weighting.method==='scf_wealth')notes.push('PSID fully adjusted results use SCF wealth weights.');
    if(isParetoMetric(s.metric)&&s.threshold==='ks')notes.push('Each coefficient uses its own KS-selected threshold.');
    if(s.metric==='pareto_wealth_ratio')notes.push('Each value divides the selected variable’s Pareto coefficient by the wealth coefficient from the same survey, wave and adjustment stage; wealth equals 1.');
    if(s.variables.has('spending')&&selected.has('SCF')){const rows=SUMMARY.filter(row=>row.survey==='SCF'&&row.variable===spendingKey(s.measure)&&row.variant===variantFor('SCF'));if(!rows.some(row=>FINITE(metricValue(row))))notes.push('Consumption is unavailable in SCF for this adjustment.');}
    if(selected.has('PSID'))notes.push('PSID construction involves extensive cleaning and selected imputations, including for capital income. Other surveys are processed as comparably as their source coverage permits, but the available detail differs: CEX income and wealth coverage is limited, SCF provides little consumption detail, and PSID offers relatively broad and detailed coverage of consumption, labor income, capital income, and wealth—the four displayed components of the household budget constraint.');
    const displayedSurveys=new Set(datasets.map(dataset=>dataset.survey));$('time-note').textContent=notes.join(' ');$('time-chart').setAttribute('aria-label',metricLabel()+' over time in '+[...displayedSurveys].join(' and '));
    const legend=$('time-survey-key');if(legend){legend.replaceChildren();[...displayedSurveys].forEach(survey=>{const item=document.createElement('span'),mark=document.createElement('i'),name=document.createElement('span'),help=document.createElement('span'),description=surveyTooltip(survey);item.className='plot-legend-item';item.setAttribute('aria-label',surveyName(survey)+'. '+description);mark.className='survey-symbol survey-symbol-'+survey.toLowerCase();mark.setAttribute('aria-hidden','true');name.textContent=surveyName(survey);help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=description;help.setAttribute('aria-label','About '+surveyName(survey));item.append(mark,name,help);legend.append(item);});}
    if(!datasets.length){announce('No comparable series selected.');return;}
    const shownYears=[...new Set(datasets.flatMap(dataset=>dataset.data.filter(point=>FINITE(point.y)).map(point=>point.x)))].sort((a,b)=>a-b),xmin=Math.min(...shownYears)-.6,xmax=Math.max(...shownYears)+.6;
    const firstYear=shownYears[0],lastYear=shownYears[shownYears.length-1];
    const yearTicks=shownYears.length>14?shownYears.filter(year=>year===firstYear||year===lastYear||(year%5===0&&year-firstYear>=3&&lastYear-year>=2)):shownYears;
    const legendTopPadding=legend?Math.max(52,legend.offsetHeight+18):12;
    timeChart=new Chart($('time-chart'),{type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},layout:{padding:{top:legendTopPadding,right:14,bottom:5,left:8}},plugins:{legend:{display:false},tooltip:{backgroundColor:'#182437',padding:12,callbacks:{title:items=>items.length?items[0].dataset.survey+' '+items[0].raw.x:'',label:ctx=>(ctx.dataset.isReference?ctx.dataset.label:displayLabel(ctx.dataset.key,s.measure,ctx.dataset.survey))+': '+format(ctx.parsed.y),afterLabel:ctx=>isParetoMetric(s.metric)?[FINITE(ctx.raw.q)?'Threshold: '+num(ctx.raw.q*100,1)+'th percentile':'',FINITE(ctx.raw.maxks)?'KS: '+num(ctx.raw.maxks,4):''].filter(Boolean):''}}},scales:{x:{type:'linear',min:xmin,max:xmax,afterBuildTicks:axis=>{axis.ticks=yearTicks.map(value=>({value}));},grid:{display:false},border:{color:'#d9dce2'},ticks:{maxRotation:0,font:{size:13},callback:value=>Number.isInteger(value)?String(value):''}},y:{grid:{color:'#e9e9ee'},border:{display:false},ticks:{padding:9,font:{size:13},callback:value=>format(value)}}}}});
    requestAnimationFrame(()=>timeChart?.resize());announce(metricLabel()+', '+timeRows.length+' aggregate estimates displayed.');
  }

  const AVERAGE_METRICS=['pareto_estimate','max_ks','threshold_quantile','n_tail','n_obs','gini','share_top20','share_top10','share_top5','share_top1'];
  const INEQUALITY_METRICS=['gini','share_top20','share_top10','share_top5','share_top1'];
  function makeAnnualResult(row,method,rule,q) {
    const fit=tailResult(row,method,rule,q),wealth=wealthTail(row,method,rule,q),ratio=FINITE(fit.estimate)&&FINITE(wealth.estimate)&&wealth.estimate>0?fit.estimate/wealth.estimate:null;
    const result={survey:row.survey,housing_method:housingMethod(row),source_housing_method:housingMethod(row),weighting_method:weightingMethod(row),country:'US',year:row.year,variant:row.variant,source_variant:row.variant,variable:row.variable,variable_label:variableDisplayLabel(row.variable,row.survey),wealth_denominator_label:wealthDenominatorLabel(row.survey),period_type:'wave',period_label:String(row.year),method,threshold_rule:rule,threshold_quantile:fit.q,pareto_estimate:fit.estimate,max_ks:fit.maxks,wealth_pareto_estimate:wealth.estimate,ratio_numerator_mean:fit.estimate,tail_to_wealth:ratio,n_tail:fit.n_tail,tail_unit_type:tailUnit(row.survey),n_obs:row.n_obs,gini:row.gini,share_top20:row.share_top20,share_top10:row.share_top10,share_top5:row.share_top5,share_top1:row.share_top1,n_waves:1,n_waves_total:1,n_waves_pareto:FINITE(fit.estimate)?1:0,n_waves_ratio:FINITE(ratio)?1:0,record_aggregation:isCEX(row.survey)?(META.surveys?.[row.survey]?.record_aggregation||sourceDisplay(row.survey)?.record_aggregation||cexRecordAggregation):'annual estimation sample'};
    INEQUALITY_METRICS.forEach(field=>result['n_waves_'+field]=FINITE(result[field])?1:0);return result;
  }
  function accumulateAverage(map,row) {
    const ks=String(row.threshold_rule).toLowerCase()==='ks',key=[row.survey,row.housing_method||'benchmark',row.weighting_method||'scf_income',row.variant,row.variable,row.method,String(row.threshold_rule).toLowerCase(),ks?'':row.threshold_quantile].join('|');
    if(!map.has(key))map.set(key,{first:row,years:new Set(),paretoYears:new Set(),ratioYears:new Set(),sums:{},counts:{},ratioNumerator:0,ratioDenominator:0});
    const bucket=map.get(key);bucket.years.add(row.year);if(FINITE(row.pareto_estimate))bucket.paretoYears.add(row.year);
    AVERAGE_METRICS.forEach(field=>{if(['max_ks','threshold_quantile','n_tail'].includes(field)&&!FINITE(row.pareto_estimate))return;const value=row[field];if(FINITE(value)){bucket.sums[field]=(bucket.sums[field]||0)+value;bucket.counts[field]=(bucket.counts[field]||0)+1;}});
    if(FINITE(row.pareto_estimate)&&FINITE(row.wealth_pareto_estimate)&&row.wealth_pareto_estimate>0){bucket.ratioNumerator+=row.pareto_estimate;bucket.ratioDenominator+=row.wealth_pareto_estimate;bucket.ratioYears.add(row.year);}
  }
  function averageResults(map) {
    const means=[];map.forEach(bucket=>{
      if(!['pareto_estimate',...INEQUALITY_METRICS].some(field=>bucket.counts[field]>0))return;
      const years=[...bucket.years].sort((a,b)=>a-b),paired=bucket.ratioYears.size,result={...bucket.first,year:null,period_type:'average',period_label:'Across-wave average ('+yearRange(years)+')',n_waves:years.length,n_waves_total:years.length,n_waves_pareto:bucket.counts.pareto_estimate||0,n_waves_ratio:paired,record_aggregation:'arithmetic mean of annual sample counts',years_available:yearList(years),years_pareto:yearList([...bucket.paretoYears].sort((a,b)=>a-b)),years_ratio:yearList([...bucket.ratioYears].sort((a,b)=>a-b))};
      AVERAGE_METRICS.forEach(field=>{result[field]=bucket.counts[field]?bucket.sums[field]/bucket.counts[field]:null;result['n_waves_'+field]=bucket.counts[field]||0;});
      result.wealth_pareto_estimate=paired?bucket.ratioDenominator/paired:null;result.ratio_numerator_mean=paired?bucket.ratioNumerator/paired:null;result.tail_to_wealth=paired&&bucket.ratioDenominator>0?bucket.ratioNumerator/bucket.ratioDenominator:null;means.push(result);
    });return means.sort((a,b)=>a.survey.localeCompare(b.survey)||a.variable.localeCompare(b.variable)||a.variant.localeCompare(b.variant)||a.method.localeCompare(b.method));
  }
  const YODLEE_VARIANTS={durables_4_with_carry:'Durable correction: four categories (paper)',active_unadjusted_same_sample:'Expenditure before durable correction',durables_all_with_carry:'Durable correction: all categories',durables_8_with_carry:'Durable correction: eight categories',active_basic_cleaning:'Basic cleaning: active sample',durables_all_without_carry:'All-category correction: no carry-over',random_raw:'Random sample: raw',random_basic_cleaning:'Random sample: basic cleaning',random_durables_all:'Random sample: durable correction',enriched_raw:'Enriched 2019: raw',enriched_CARD:'Enriched 2019: card sample',enriched_trim01p:'Enriched 2019: trimmed sample'};
  const referencePoints=()=>referenceController?.allPoints()||META.us_reference_points||[];
  function resultsSurveys(){return new Set(r.datasets);}
  function resultsReferenceRows(method=r.method,threshold=r.threshold,variable=r.variable){return referenceController?.tableResults({...r,method,threshold,variable})||[];}
  function fillResultsDatasets(){
    const host=$('results-datasets');host.replaceChildren();
    [...VISIBLE_US_SURVEYS,...new Set(referencePoints().map(row=>row.survey))].forEach(survey=>{
      const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span'),help=document.createElement('span');label.className='overlay-choice small-check';input.type='checkbox';input.value=survey;input.checked=r.datasets.has(survey);input.setAttribute('aria-label',surveyName(survey));name.textContent=surveyName(survey);help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=surveyTooltip(survey);help.setAttribute('aria-label','About '+surveyName(survey));label.append(input,name,help);host.append(label);
      input.addEventListener('change',()=>{if(input.checked)r.datasets.add(survey);else if(r.datasets.size>1)r.datasets.delete(survey);else{input.checked=true;return;}r.survey=r.datasets.size===1?[...r.datasets][0].toLowerCase():'all';syncHousingAvailability();fillResultsVariables();schedule();});
    });
  }
  function fillResultsVariables(){
    const selected=resultsSurveys(),native=referencePoints().filter(row=>selected.has(row.survey)),household=SUMMARY.filter(row=>selected.has(row.survey)),variables=[...new Set([...household,...native].map(row=>row.variable))].filter(variable=>!hiddenSpending.has(variable)).sort((a,b)=>variableDisplayLabel(a,r.survey.toUpperCase()).localeCompare(variableDisplayLabel(b,r.survey.toUpperCase()))),select=$('results-variable');select.replaceChildren();
    const supported=variable=>household.some(row=>row.variable===variable&&row.variant===variantFor(row.survey,r.adjustment))||native.some(row=>row.variable===variable&&(row.survey!=='YODLEE'||r.yodleeVariant==='all'||row.author_variant===r.yodleeVariant));
    [['all','All available measures'],...variables.map(variable=>[variable,variableDisplayLabel(variable,r.survey.toUpperCase())])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;option.disabled=value!=='all'&&!supported(value);select.append(option);});
    if(r.variable!=='all'&&(!variables.includes(r.variable)||!supported(r.variable)))r.variable='all';select.value=r.variable;
  }
  function syncResultsControls(){
    const selected=resultsSurveys(),hasHouseholds=[...selected].some(survey=>VISIBLE_US_SURVEYS.has(survey)),hasYodlee=selected.has('YODLEE'),bankOnly=hasYodlee&&!hasHouseholds,bankOptions=[['all','All saved constructions'],...Object.entries(YODLEE_VARIANTS).filter(([variant])=>referencePoints().some(row=>row.survey==='YODLEE'&&row.author_variant===variant))],adjustment=$('results-adjustment'),bank=$('results-yodlee-adjustment');
    const fill=(select,options,value)=>{select.replaceChildren();options.forEach(([key,text])=>select.add(new Option(text,key)));select.value=value;};
    fill(bank,bankOptions,r.yodleeVariant);$('results-yodlee-adjustment-control').hidden=!hasYodlee||bankOnly;
    fill(adjustment,bankOnly?bankOptions:hasHouseholds?[['full','Reporting + representation'],['adj','Reporting adjustment'],['raw','Raw data']]:[['reference','Not applicable']],bankOnly?r.yodleeVariant:hasHouseholds?r.adjustment:'reference');adjustment.disabled=!hasHouseholds&&!bankOnly;
    adjustment.closest('.control').querySelector('label').textContent=bankOnly?'Durable correction':'Adjustment';
    fillResultsVariables();
    const householdRows=SUMMARY.filter(row=>selected.has(row.survey)&&row.variant===variantFor(row.survey,r.adjustment)&&(r.variable==='all'||row.variable===r.variable)),available=(method,rule)=>householdRows.some(row=>FINITE(tailResult(row,method,rule,r.customQ).estimate)||(!loadedCurveSurveys.has(row.survey)&&curveIndex.get(curveKey(row))?.available_thresholds?.[method]?.includes(rule)))||resultsReferenceRows(method,rule).length>0;
    [...$('results-method').options].forEach(option=>{option.disabled=!['ks','p80','p90','p95','p98'].some(rule=>available(option.value,rule));option.title=option.disabled?'No stored estimates for this method and selection.':'';});if($('results-method').querySelector('option[value="'+r.method+'"]').disabled)r.method=[...$('results-method').options].find(option=>!option.disabled)?.value||'MLE';
    [...$('results-threshold').options].forEach(option=>{option.disabled=option.value==='custom'?!householdRows.length&&!resultsReferenceRows(r.method,'p80').length:!available(r.method,option.value);option.title=option.disabled?'No stored estimates for this threshold and selection.':'';});if($('results-threshold').querySelector('option[value="'+r.threshold+'"]').disabled)r.threshold=[...$('results-threshold').options].find(option=>!option.disabled)?.value||'ks';
    const custom=$('results-custom-threshold');custom.max=selected.size===1&&selected.has('FORBES')?'90':'99';if(r.threshold==='custom'&&100*r.customQ>Number(custom.max))r.customQ=Number(custom.max)/100;custom.value=String(100*r.customQ);$('results-method').value=r.method;$('results-threshold').value=r.threshold;$('results-custom-threshold-control').hidden=r.threshold!=='custom';
  }
  function selectedResultRows(){
    const selected=resultsSurveys(),annual=SUMMARY.filter(row=>selected.has(row.survey)&&row.variant===variantFor(row.survey,r.adjustment)&&(r.variable==='all'||row.variable===r.variable)).map(row=>({...makeAnnualResult(row,r.method,r.threshold,r.customQ),source_housing_method:housingMethod(row),housing_method:housing.method}));
    resultsReferenceRows().forEach(point=>{const row={...point,country:'US',housing_method:'not_applicable',source_housing_method:'not_applicable',weighting_method:point.survey==='YODLEE'?'source_scf_income':'not_applicable',year:point.year,period_type:'wave',period_label:String(point.year),variant:point.author_variant,source_variant:point.author_variant,adjustment_label:point.survey==='YODLEE'?(YODLEE_VARIANTS[point.author_variant]||point.author_variant):'Standalone reference',variable_label:variableDisplayLabel(point.variable,point.survey),pareto_estimate:point.estimate,max_ks:point.ks,wealth_pareto_estimate:null,ratio_numerator_mean:point.estimate,tail_to_wealth:null,n_tail:point.n_tail??null,n_obs:point.n_obs??null,n_waves:1,n_waves_total:1,n_waves_pareto:1,n_waves_ratio:0};INEQUALITY_METRICS.forEach(field=>{row[field]=FINITE(point[field])?point[field]:null;row['n_waves_'+field]=FINITE(row[field])?1:0;});annual.push(row);});
    annual.sort((a,b)=>a.survey.localeCompare(b.survey)||a.year-b.year||a.variable.localeCompare(b.variable)||a.variant.localeCompare(b.variant));const map=new Map();annual.forEach(row=>accumulateAverage(map,row));return [...averageResults(map),...annual];
  }
  let resultsSignature='';
  function renderResults() {

    syncResultsControls();
    const signature=[housing.method,weighting.method,[...r.datasets].sort().join(','),r.variable,r.adjustment,r.yodleeVariant,r.method,r.threshold,r.customQ].join('|');if(signature!==resultsSignature){resultPage=0;resultsSignature=signature;}
    syncTailControls();resultRows=selectedResultRows();const pageSize=50,pages=Math.max(1,Math.ceil(resultRows.length/pageSize));resultPage=Math.max(0,Math.min(resultPage,pages-1));
    const selected=resultsSurveys(),adjustmentText=(bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM')?'Original B&M construction':ADJ[r.adjustment])+(selected.has('SCF')&&r.adjustment!=='raw'?' (SCF: rescaled, original weights)':'');
    const table=$('results-table');table.replaceChildren();const head=document.createElement('thead'),header=document.createElement('tr');
    ['Dataset','Period','Adjustment','Measure','Method','Waves','Tail waves','Ratio waves','Cutoff','Pareto tail','KS','Tail / wealth','Gini','Top 20%','Top 10%','Top 5%','Top 1%','Tail units','Records'].forEach(text=>{const th=document.createElement('th');th.scope='col';th.textContent=text;header.append(th);});head.append(header);table.append(head);
    const body=document.createElement('tbody'),shown=resultRows.slice(resultPage*pageSize,(resultPage+1)*pageSize);
    shown.forEach(row=>{
      const tr=document.createElement('tr');if(row.period_type==='average')tr.className='results-average-row';
      const cells=[surveyName(row.survey),row.period_label,row.adjustment_label||adjustmentLabel(row),row.variable_label,row.method,num(row.n_waves,0),num(row.n_waves_pareto,0),num(row.n_waves_ratio,0),(String(row.threshold_rule).toLowerCase()==='ks'?'KS · ':'')+pct(row.threshold_quantile),num(row.pareto_estimate,3),num(row.max_ks,4),num(row.tail_to_wealth,3)];
      cells.forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});
      INEQUALITY_METRICS.forEach(field=>{const td=document.createElement('td'),count=row['n_waves_'+field]||0;td.textContent=field==='gini'?num(row[field],3):pct(row[field]);if(!FINITE(row[field]))td.className='unavailable-value';if(row.period_type==='average'){td.title='Mean of '+count+' available annual estimates out of '+row.n_waves+' waves.';if(count>0&&count<row.n_waves)td.textContent+=' ['+count+'/'+row.n_waves+']';}tr.append(td);});
      [row.n_tail,row.n_obs].forEach(value=>{const td=document.createElement('td');td.textContent=(row.period_type==='average'&&FINITE(value)?'Avg. ':'')+num(value,row.period_type==='average'?1:0);tr.append(td);});body.append(tr);
    });table.append(body);
    $('results-empty').hidden=!!resultRows.length;$('results-count').textContent=resultRows.length?'Rows '+(resultPage*pageSize+1)+'–'+Math.min((resultPage+1)*pageSize,resultRows.length)+' of '+resultRows.length:'No rows for these filters.';
    $('results-page').textContent='Page '+(resultPage+1)+' of '+pages;$('results-prev').disabled=resultPage===0;$('results-next').disabled=resultPage>=pages-1;$('download-results-selected').disabled=!resultRows.length;
    $('results-note').textContent=''+(selected.has('CEX')?'CEX wealth is partial. '+cexCountsNote:'')+(selected.has('CEX_BM')?' '+(META.cex_bm_display?.counts||META.cex_bm_display?.note||META.surveys?.CEX_BM?.definition||'Original B&M sample, equivalized definition and weights; the PSID adjustment selector does not alter this author construction.'):'')+(selected.has('CEX_BM_RECON')?' '+(META.cex_bm_recon_display?.note||META.surveys?.CEX_BM_RECON?.definition||'Public CEX reconstruction shown separately from the authors’ reference series.'):'');
  }
  async function downloadAllResults() {
    if(allResultsBusy)return;allResultsBusy=true;$('download-results-all').disabled=true;$('all-results-status').textContent='Preparing aggregate results…';
    try{
      await ensureFullCurves([...VISIBLE_US_SURVEYS]);
      const fields=['survey','housing_method','source_housing_method','weighting_method','country','period_type','period_label','year','variant','source_variant','variable','variable_label','wealth_denominator_label','method','threshold_rule','threshold_quantile','pareto_estimate','max_ks','tail_to_wealth','wealth_pareto_estimate','ratio_numerator_mean','n_waves','n_waves_total','n_waves_pareto','n_waves_ratio','n_waves_gini','n_waves_share_top20','n_waves_share_top10','n_waves_share_top5','n_waves_share_top1','years_available','years_pareto','years_ratio','n_tail','tail_unit_type','n_obs','record_aggregation','gini','share_top20','share_top10','share_top5','share_top1','author_variant','source_label','source_definition','provenance'],escape=value=>value===null||value===undefined?'':'"'+String(value).replace(/"/g,'""')+'"',lines=[fields.join(',')],annualLines=[],averages=new Map();
      const serialize=row=>fields.map(field=>escape(row[field])).join(',');
      const appendAnnual=row=>{annualLines.push(serialize(row));accumulateAverage(averages,row);};let groups=0;
      for(const curve of ALL_CURVES.filter(curve=>VISIBLE_US_SURVEYS.has(curve.survey))){
        const row=summaryIndex.get(curveKey(curve))||curve;
        for(const method of ['MLE','OLS']){appendAnnual(makeAnnualResult(row,method,'ks',s.customQ));curve.qs.forEach(q=>{const shortcut=({800:'p80',900:'p90',950:'p95',980:'p98'})[Math.round(q*1000)],result=makeAnnualResult(row,method,shortcut||'custom',q);result.threshold_rule='fixed';appendAnnual(result);});}
        groups++;if(groups%20===0){$('all-results-status').textContent='Preparing '+num(annualLines.length,0)+' aggregate rows…';await new Promise(resolve=>setTimeout(resolve,0));}
      }
      ALL_SUMMARY.filter(row=>VISIBLE_US_SURVEYS.has(row.survey)&&!curveIndex.has(curveKey(row))).forEach(row=>appendAnnual(makeAnnualResult(row,'','Unavailable',null)));
      (referenceController?.allResults()||[]).forEach(row=>appendAnnual({...row,country:'US',period_type:'wave',period_label:String(row.year),variant:row.author_variant,variable_label:row.source_label,pareto_estimate:row.estimate,max_ks:row.ks,wealth_pareto_estimate:null,tail_to_wealth:null,n_waves:1,n_waves_total:1,n_waves_pareto:1,n_waves_ratio:0,tail_unit_type:row.survey==='FORBES'?'listed people or family entries':row.survey==='YODLEE'?'bank–individual accounts':'households',record_aggregation:row.survey==='FORBES'?'distinct listed person/family fortunes; World list plus Forbes 400':'author-defined annual reference point'}));
      averageResults(averages).forEach(row=>lines.push(serialize(row)));
      const url=URL.createObjectURL(new Blob([lines.join('\r\n'),'\r\n',annualLines.join('\r\n')],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='all_US_inequality_results.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('all-results-status').textContent=num(annualLines.length+lines.length-1,0)+' US aggregate rows prepared. Across-wave means precede annual estimates; no records are pooled.';
    }catch(error){$('all-results-status').textContent='The aggregate CSV could not be prepared. Please reload and try again.';console.error(error);}finally{allResultsBusy=false;$('download-results-all').disabled=false;}
  }

  function aggregate(rows) {
    const grouped=new Map();
    rows.forEach(row=>{ const key=row.q_lo+'|'+row.q_hi; if(!grouped.has(key)) grouped.set(key,[]); grouped.get(key).push(row); });
    return [...grouped.values()].map(group=>({x:avg(group.map(r=>r[b.stat+'_x'])),y:avg(group.map(r=>r[b.stat+'_y'])),q_lo:group[0].q_lo,q_hi:group[0].q_hi,n_obs:Math.min(...group.map(r=>r.n_obs)),waves:new Set(group.map(r=>r.year)).size,years_used:[...new Set(group.map(r=>r.year))].sort((a,b)=>a-b).join(';')})).sort((a,c)=>a.q_lo-c.q_lo);
  }
  const point=row=>({x:row[b.stat+'_x'],y:row[b.stat+'_y'],q_lo:row.q_lo,q_hi:row.q_hi,n_obs:row.n_obs,waves:row.n_waves||1,years_used:row.years_used||String(row.year),n_imputations:row.n_imputations??null});
  const capitalIncomePair=()=>Object.values(PAIRS[b.pair]).includes('total_capital_income');
  const capitalIncomeDefinition=(excludeNetRent=b.excludeNetRent,beforePersonalInterest=b.beforePersonalInterest)=>
    !capitalIncomePair()?'benchmark':excludeNetRent?(beforePersonalInterest?'exclude_net_rent_before_personal_interest':'exclude_net_rent'):(beforePersonalInterest?'before_personal_interest':'benchmark');
  const matchesCapitalIncomeDefinition=row=>(row.capital_income_definition||'benchmark')===capitalIncomeDefinition();
  const matchesBinMinimum=row=>Number(row.bin_min_n??10)===b.minN&&matchesCapitalIncomeDefinition(row);
  function syncBivariateCapitalControls(){
    const root=$('biv-capital-controls');if(!root)return;
    root.hidden=!capitalIncomePair();if(root.hidden)return;
    const surveys=selectedSurveys(b),pair=PAIRS[b.pair],ykey=sourceKey(pair.y,b.measure),waveFor=survey=>survey==='PSID'?b.wave:survey==='SCF'?b.scfWave:survey==='CEX_BM_RECON'?b.reconWave:survey==='CEX_BM'?b.bmWave:b.cexWave;
    const available=definition=>BIN_AVAILABILITY.some(row=>specificationMatches(row)&&surveys.has(row.survey)&&Number(row.bin_min_n??10)===b.minN&&row.variant===bivariateVariantFor(row.survey)&&row.xvar===pair.x&&row.yvar===ykey&&(pair.y==='spending'||row.measure==='expenditure')&&(row.capital_income_definition||'benchmark')===definition&&(waveFor(row.survey)==='average'||(row.period_type!=='average'&&row.year===Number(waveFor(row.survey)))));
    [['biv-exclude-net-rent','excludeNetRent'],['biv-before-personal-interest','beforePersonalInterest']].forEach(([id,key])=>{
      const input=$(id),nextExclude=key==='excludeNetRent'?!b.excludeNetRent:b.excludeNetRent,nextInterest=key==='beforePersonalInterest'?!b.beforePersonalInterest:b.beforePersonalInterest;
      input.checked=b[key];input.disabled=!b[key]&&!available(capitalIncomeDefinition(nextExclude,nextInterest));
      input.closest('label').classList.toggle('unavailable-option',input.disabled);
    });
    const supported=available(capitalIncomeDefinition());$('biv-capital-note').hidden=supported;$('biv-capital-note').textContent=supported?'':'This capital-income definition is unavailable for the selected filters.';
  }
  const positive=p=>FINITE(p.x)&&FINITE(p.y)&&p.x>0&&p.y>0;
  function olsFit(points,useLog) {
    if(points.length<2) return null;
    const x=points.map(p=>useLog?Math.log(p.x):p.x), y=points.map(p=>useLog?Math.log(p.y):p.y); const mx=avg(x),my=avg(y);
    const denominator=x.reduce((sum,v)=>sum+(v-mx)**2,0); if(!(denominator>0)) return null;
    const slope=x.reduce((sum,v,i)=>sum+(v-mx)*(y[i]-my),0)/denominator, intercept=my-slope*mx;
    const sse=x.reduce((sum,v,i)=>sum+(y[i]-intercept-slope*v)**2,0),sst=y.reduce((sum,v)=>sum+(v-my)**2,0);
    return {method:'OLS',intercept,slope,r2:sst>0?1-sse/sst:null,n:points.length,space:useLog?'logs':'levels',predict:x=>useLog?Math.exp(intercept+slope*Math.log(x)):intercept+slope*x};
  }
  function nlsFit(points) {
    const sample=points.filter(p=>p.x>0); if(sample.length<2) return null;
    const lx=sample.map(p=>Math.log(p.x)),lo=Math.min(...lx),hi=Math.max(...lx); if(!(hi>lo)) return null;
    const profile=exponent=>{
      const pivot=exponent>=0?hi:lo, z=lx.map(v=>Math.exp(exponent*(v-pivot)));
      const amplitude=z.reduce((sum,v,i)=>sum+v*sample[i].y,0)/z.reduce((sum,v)=>sum+v*v,0);
      return {sse:z.reduce((sum,v,i)=>sum+(sample[i].y-amplitude*v)**2,0),amplitude,pivot};
    };
    let span=8,grid,best;
    for(let pass=0;pass<3;pass++) {
      grid=Array.from({length:161},(_,i)=>{const exponent=-span+2*span*i/160;return {exponent,...profile(exponent)};});
      best=grid.reduce((j,v,i)=>v.sse<grid[j].sse?i:j,0);
      if(best>0&&best<grid.length-1) break;
      if(pass===2) return null;
      span*=2;
    }
    let left=grid[best-1].exponent,right=grid[best+1].exponent;
    const ratio=(Math.sqrt(5)-1)/2;
    let c=right-ratio*(right-left),d=left+ratio*(right-left),fc=profile(c).sse,fd=profile(d).sse;
    for(let step=0;step<70;step++) {
      if(fc<fd){right=d;d=c;fd=fc;c=right-ratio*(right-left);fc=profile(c).sse;}
      else{left=c;c=d;fc=fd;d=left+ratio*(right-left);fd=profile(d).sse;}
    }
    const slope=(left+right)/2,result=profile(slope),intercept=result.amplitude*Math.exp(-slope*result.pivot);
    const my=avg(sample.map(p=>p.y)),sst=sample.reduce((sum,p)=>sum+(p.y-my)**2,0);
    if(!FINITE(intercept)||!FINITE(result.sse)) return null;
    return {method:'NLS',intercept,slope,r2:sst>0?1-result.sse/sst:null,n:sample.length,space:'levels',predict:x=>result.amplitude*Math.exp(slope*(Math.log(x)-result.pivot))};
  }
  function fitCurve(fit,points,useLog) {
    const xlo=Math.min(...points.map(p=>p.x)),xhi=Math.max(...points.map(p=>p.x));
    return Array.from({length:81},(_,i)=>{const t=i/80,x=useLog||fit.method==='NLS'?Math.exp(Math.log(xlo)+t*(Math.log(xhi)-Math.log(xlo))):xlo+t*(xhi-xlo);return {x,y:fit.predict(x)};}).filter(p=>FINITE(p.x)&&FINITE(p.y)&&(!useLog||positive(p)));
  }
  function showFitResults(rows,useLog) {
    $('fit-results')?.setAttribute('data-fit-values',JSON.stringify(rows.map(({name,method,intercept,slope,r2,n})=>({name,method,intercept,slope,r2,n}))));
    const root=$('fit-results');root.replaceChildren();if(!rows.length)return;
    const heading=document.createElement('h3');heading.textContent='Regression results';root.append(heading);
    const scroll=document.createElement('div');scroll.className='table-scroll';
    const table=document.createElement('table');table.innerHTML='<thead><tr><th>Survey</th><th>Fit</th><th>a / A</th><th>b</th><th>R²</th><th>Bins</th></tr></thead>';
    const body=document.createElement('tbody');
    rows.forEach(row=>{const tr=document.createElement('tr');[row.name,row.method+' · '+row.space,num(row.intercept,3),num(row.slope,3),num(row.r2,3),num(row.n,0)].forEach((value,i)=>{const cell=document.createElement('td');cell.textContent=value;if(i===0)cell.style.color=row.color;tr.append(cell);});body.append(tr);});
    table.append(body);scroll.append(table);root.append(scroll);
    const note=document.createElement('p');note.className='fit-note';note.textContent=(useLog?'OLS: log(y) = a + b log(x). ':'OLS: y = a + bx. ')+'NLS: y = A xᵇ, minimizing squared residuals in levels. R² is measured in the indicated fit space; each bin receives equal weight.';root.append(note);
  }
  function logTick(value,index,ticks) {
    const v=Number(value); if(!(v>0)) return ''; const mantissa=v/Math.pow(10,Math.floor(Math.log10(v)));
    return index===0||index===ticks.length-1||[1,2,5].some(n=>Math.abs(mantissa-n)<1e-8)?v.toLocaleString('en-US',{maximumSignificantDigits:4}):'';
  }
  const equalityLineLabel={id:'equalityLineLabel',afterDatasetsDraw(chart){
    const index=chart.data.datasets.findIndex(dataset=>dataset.isReference&&dataset.label==='Equal normalized values');if(index<0)return;
    const end=chart.getDatasetMeta(index).data.at(-1);if(!end)return;
    const {ctx,chartArea:area}=chart;ctx.save();ctx.font='12px Arial, sans-serif';ctx.textAlign='left';ctx.textBaseline='bottom';
    const width=ctx.measureText('45°').width,x=Math.max(area.left+4,Math.min(end.x+7,area.right-width-4)),y=Math.max(area.top+17,Math.min(end.y-6,area.bottom-4));
    ctx.strokeStyle='#fffefa';ctx.lineWidth=4;ctx.strokeText('45°',x,y);ctx.fillStyle='#85848e';ctx.fillText('45°',x,y);ctx.restore();
  }};
  function syncBivariateWaves() {
    const pair=PAIRS[b.pair],ykey=sourceKey(pair.y,b.measure);
    [['PSID','wave','wave-select'],['SCF','scfWave','scf-wave-select'],['CEX','cexWave','cex-wave-select'],['CEX_BM_RECON','reconWave','recon-wave-select'],['CEX_BM','bmWave','bm-wave-select']].forEach(([survey,field,id])=>{
      const available=[...new Set(BINS.filter(row=>matchesBinMinimum(row)&&row.survey===survey&&row.variant===bivariateVariantFor(survey)&&(pair.y==='spending'||row.measure==='expenditure')&&row.xvar===pair.x&&row.yvar===ykey).map(row=>row.year).filter(FINITE))].sort((a,c)=>a-c);
      if(available.length&&b[field]!=='average'&&!available.includes(Number(b[field])))b[field]=String(available[available.length-1]);
      const select=$(id);select.replaceChildren();
      [['average','Across-wave average'],...available.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);});select.value=available.includes(Number(b[field]))||b[field]==='average'?b[field]:'average';
    });
  }
  function renderBivariate() {
    const binningPair=PAIRS[b.pair],binningSurveys=selectedSurveys(b);
    [...$('biv-bin-min').options].forEach(option=>{option.disabled=!BIN_AVAILABILITY.some(row=>specificationMatches(row)&&Number(row.bin_min_n??10)===Number(option.value)&&matchesCapitalIncomeDefinition(row)&&binningSurveys.has(row.survey)&&row.variant===bivariateVariantFor(row.survey)&&row.xvar===binningPair.x&&row.yvar===sourceKey(binningPair.y,b.measure)&&(binningPair.y==='spending'||row.measure==='expenditure'));option.title=option.disabled?'No stored estimates for this minimum and selection.':option.value==='0'?'Use nonempty original percentile bins without merging.':'';});
    $('biv-bin-min').value=String(b.minN);
    syncBivariateWaves();
    syncBivariateCapitalControls();
    destroy('biv-chart',bivChart); bivChart=null; binRows=[];
    Object.entries(PAIRS).forEach(([key,pair])=>{const option=$('pair-select').querySelector('option[value="'+key+'"]');if(option){option.textContent=(isCEX(b.primary.toUpperCase())?displayLabel(pair.x,b.measure,b.primary.toUpperCase()):pair.x==='networth_val'?'Wealth':LABELS[pair.x])+' → '+displayLabel(pair.y,b.measure,b.primary.toUpperCase());option.title=option.textContent;option.disabled=b.primary==='cex_bm'&&selectedSurveys(b).size===1&&!BINS.some(row=>row.survey==='CEX_BM'&&row.xvar===pair.x&&row.yvar===sourceKey(pair.y,b.measure));}});
    $('pair-select').title=$('pair-select').selectedOptions[0]?.textContent||'';
    const pair=PAIRS[b.pair], ykey=sourceKey(pair.y,b.measure), useLog=b.scale==='loglog',datasets=[], fits=[], regressions=[],plotted=[], omitted=[],unavailable=[];
    const visiblePoint=p=>FINITE(p.x)&&FINITE(p.y)&&(!useLog||positive(p));
    const specs=[{survey:'PSID',color:'#b34470',point:'circle'},{survey:'SCF',color:'#2c5c88',point:'rectRot'},{survey:'CEX_BM_RECON',color:'#7b8154',point:'triangle'},{survey:'CEX',color:hasCorrectedCEXBins?'#8b6388':'#7b8154',point:hasCorrectedCEXBins?'crossRot':'triangle'},{survey:'CEX_BM',color:'#8b6388',point:'crossRot'}];
    specs.filter(spec=>selectedSurveys(b).has(spec.survey)).forEach(spec=>{
      const measure=pair.y==='spending'?b.measure:'expenditure';
      let rows=BINS.filter(r=>matchesBinMinimum(r)&&r.survey===spec.survey&&r.variant===bivariateVariantFor(spec.survey)&&(pair.y==='spending'||r.measure==='expenditure')&&r.xvar===pair.x&&r.yvar===ykey);
      const values=[...new Set(rows.map(r=>r.year).filter(FINITE))].sort((a,c)=>a-c),chosenWave=spec.survey==='PSID'?b.wave:spec.survey==='SCF'?b.scfWave:spec.survey==='CEX_BM'?b.bmWave:spec.survey==='CEX_BM_RECON'?b.reconWave:b.cexWave;
      const hasComputedAverage=rows.some(row=>row.period_type==='average');
      if(chosenWave==='average')rows=rows.filter(row=>hasComputedAverage?row.period_type==='average':row.period_type!=='average');else rows=rows.filter(r=>r.period_type!=='average'&&r.year===Number(chosenWave));
      if(!rows.length&&b.minN===0){unavailable.push(surveyName(spec.survey)+': unmerged bins are unavailable.');return;}
      if(!rows.length){unavailable.push(spec.survey+(chosenWave==='average'?'':' '+chosenWave)+': '+displayLabel(pair.y,b.measure,spec.survey)+' unavailable'+(values.length?'; available in '+yearList(values):'')+'.');return;}
      const selected=chosenWave==='average'&&!hasComputedAverage?aggregate(rows):rows.map(point).sort((a,c)=>a.q_lo-c.q_lo);
      const points=selected.filter(visiblePoint); if(selected.length>points.length) omitted.push(spec.survey+': '+(selected.length-points.length)+' nonpositive or unavailable bin'+(selected.length-points.length===1?'':'s'));
      if(!points.length) return;
      const name=surveyName(spec.survey)+' '+(chosenWave==='average'?yearRange(values)+(values.length>1?' average':''):chosenWave),ols=olsFit(points,useLog),nls=nlsFit(points),fit=b.fit==='ols'?ols:b.fit==='nls'?nls:null;
      [ols,nls].filter(Boolean).forEach(result=>regressions.push({name,color:spec.color,...result}));
      if(fit) {
        fits.push({name,...fit,color:spec.color,bins:points.length,min_n:Math.min(...points.map(p=>p.n_obs))});
        datasets.push({label:name+' '+fit.method,survey:spec.survey,type:'line',data:fitCurve(fit,points,useLog),borderColor:spec.color,borderDash:[6,5],borderWidth:1.7,pointRadius:0,showLine:true,isFit:true,order:2});
      }
      datasets.push({label:name,survey:spec.survey,type:'scatter',data:points,borderColor:spec.color,backgroundColor:spec.color,pointStyle:spec.point,pointRadius:spec.survey==='CEX_BM'?6:spec.survey==='SCF'?4.5:3.5,pointHoverRadius:spec.survey==='CEX_BM'?8:6,pointBorderWidth:spec.survey==='CEX_BM'?2.2:1,showLine:false,isMain:true,order:1});
      plotted.push(...points);
      points.forEach(p=>binRows.push({survey:spec.survey,housing_method:housing.method,source_housing_method:housingSource(spec.survey),weighting_method:weightingMethod(rows[0]||{}),capital_income_definition:capitalIncomeDefinition(),wave:chosenWave,n_waves:p.waves,years_used:p.years_used,n_imputations:p.n_imputations,adjustment:bivariateVariantFor(spec.survey),source_variant:bivariateVariantFor(spec.survey),measure,xvar:pair.x,yvar:ykey,x_label:displayLabel(pair.x,b.measure,spec.survey),y_label:displayLabel(pair.y,b.measure,spec.survey),statistic:b.stat,axis_scale:b.scale,fit_method:b.fit,bin_min_n:b.minN,q_lo:p.q_lo,q_hi:p.q_hi,x:p.x,y:p.y,min_tail_units:p.n_obs,tail_unit_type:tailUnit(spec.survey),ols_intercept:ols?.intercept??null,ols_slope:ols?.slope??null,ols_r_squared:ols?.r2??null,nls_scale:nls?.intercept??null,nls_exponent:nls?.slope??null,nls_r_squared:nls?.r2??null}));
      if(spec.survey==='PSID'&&b.traces) {
        const annual=BINS.filter(r=>r.period_type!=='average'&&matchesBinMinimum(r)&&r.survey==='PSID'&&r.variant===b.adjustment&&(pair.y==='spending'||r.measure==='expenditure')&&r.xvar===pair.x&&r.yvar===ykey);
        years.filter(y=>b.wave==='average'||y!==Number(b.wave)).forEach(y=>{
          const values=annual.filter(r=>r.year===y).map(point).filter(visiblePoint);
          datasets.push({label:'PSID '+y,type:'line',data:values,borderColor:'#8b90a333',backgroundColor:'#8b90a333',borderWidth:.7,pointRadius:0,showLine:true,isTrace:true,order:4});
        });
      }
    });
    const lx=displayLabel(pair.x,b.measure,b.primary.toUpperCase()),ly=displayLabel(pair.y,b.measure,b.primary.toUpperCase());
    $('biv-chart-title').textContent=ly+' and '+(pair.x==='networth_val'&&!isCEX(b.primary.toUpperCase())?'wealth':lx.toLowerCase().replace(/\bcex\b/g,'CEX'));
    $('biv-chart-subtitle').textContent='Normalized weighted '+(b.stat==='mean'?'means':'medians')+' · '+(useLog?'log–log':'level')+' axes'+(b.adjustment==='full'&&selectedSurveys(b).has('PSID')?' · '+({scf_income:'SCF income weights',irs_income:'IRS income weights',scf_wealth:'SCF wealth weights'})[weighting.method]:'')+(housing.method==='bp'?' · Constant imputed rent rate':'');
    if(capitalIncomePair())$('biv-chart-subtitle').textContent+=(b.excludeNetRent?' · Excludes net imputed rent':'')+(b.beforePersonalInterest?' · Before personal-debt interest':'');
    $('biv-chart').setAttribute('aria-label',ly+' versus '+lx+' in the upper tail');
    $('biv-empty').hidden=!!plotted.length;
    $('biv-empty').textContent='No comparable '+(useLog?'positive ':'')+'results for this selection.';
    const onlyBM=selectedSurveys(b).size===1&&selectedSurveys(b).has('CEX_BM');$('biv-variant').disabled=onlyBM;$('biv-variant').value=onlyBM?'raw':b.adjustment;$('biv-variant').title=onlyBM?'B&M relationships use the identified original reported sample; adjusted income and wealth rankings are unavailable.':'';$('wave-select').disabled=!selectedSurveys(b).has('PSID');$('show-waves').disabled=!selectedSurveys(b).has('PSID');
    $('scf-wave-select').disabled=!selectedSurveys(b).has('SCF');
    $('recon-wave-select').disabled=!selectedSurveys(b).has('CEX_BM_RECON');$('recon-wave-select').closest('.control').hidden=!selectedSurveys(b).has('CEX_BM_RECON');const hasCEXRelationship=selectedSurveys(b).has('CEX');$('cex-wave-select').disabled=!hasCEXRelationship;$('bm-wave-select').disabled=!selectedSurveys(b).has('CEX_BM');
    $('wave-select').closest('.control').hidden=!selectedSurveys(b).has('PSID');$('scf-wave-select').closest('.control').hidden=!selectedSurveys(b).has('SCF');$('cex-wave-select').closest('.control').hidden=!hasCEXRelationship;$('bm-wave-select').closest('.control').hidden=!selectedSurveys(b).has('CEX_BM');$('show-waves').closest('label').hidden=!selectedSurveys(b).has('PSID');
    [['PSID','wave-select'],['SCF','scf-wave-select'],['CEX','cex-wave-select'],['CEX_BM_RECON','recon-wave-select'],['CEX_BM','bm-wave-select']].forEach(([survey,id])=>$(id).disabled=!selectedSurveys(b).has(survey)||$(id).options.length<2);
    $('biv-measure-select').disabled=pair.y!=='spending';
    $('download-biv-csv').disabled=!binRows.length; $('download-biv-png').disabled=!plotted.length;
    $('slope-readout').replaceChildren();
    fits.forEach((fit,index)=>{if(index)$('slope-readout').append(document.createTextNode('  ·  ')); const span=document.createElement('span'); span.style.color=fit.color; span.textContent=fit.name+' · '+fit.method+' '+(fit.method==='NLS'?'exponent':useLog?'elasticity':'slope')+' '+num(fit.slope,3); $('slope-readout').append(span);});
    let interpretation=$('biv-tail-ratio');if(!interpretation){interpretation=document.createElement('p');interpretation.id='biv-tail-ratio';interpretation.className='biv-tail-ratio';$('slope-readout').closest('.biv-toolbar').after(interpretation);}
    interpretation.replaceChildren();const tailFits=fits.filter(fit=>(useLog||fit.method==='NLS')&&FINITE(fit.slope)&&fit.slope>0&&FINITE(1/fit.slope));interpretation.hidden=!tailFits.length;
    if(tailFits.length){
      const symbols={networth_val:'a',total_income:'y',total_labor_income:'y_L',total_capital_income:'y_K',spending:b.measure.startsWith('expenditure')?'e':b.measure==='vacation'?'v':b.measure==='food_total'?'f':'c'},heading=document.createElement('strong');heading.append('Implied Pareto-tail ratio: ');
      tailFits.forEach((fit,index)=>{if(index)heading.append(' · ');if(tailFits.length>1)heading.append(fit.name+' ');const numerator=document.createElement('sub'),denominator=document.createElement('sub');numerator.textContent=symbols[pair.y];denominator.textContent=symbols[pair.x];heading.append('ζ',numerator,'/ζ',denominator,' ≈ '+num(1/fit.slope,2));});heading.append('.');
      const help=document.createElement('button');help.type='button';help.className='help-marker detail-help hover-help';help.textContent='?';help.dataset.helpToggle='true';help.setAttribute('aria-label','About implied Pareto-tail ratios');help.setAttribute('aria-expanded','false');help.dataset.tooltip='Joint '+ly.toLowerCase()+'–'+lx.toLowerCase()+' relationship: a straight log–log line has constant elasticity. Its reciprocal gives the implied Pareto-tail ratio under a power law; the variables’ level ratio is constant only at slope one. Binning reduces idiosyncratic noise but requires enough observations, so estimates start at P80 (top 20%).';interpretation.append(heading,help);
    }
    showFitResults(regressions,useLog);
    $('biv-chart').dataset.binMin=String(b.minN);$('biv-chart').dataset.pair=b.pair;$('biv-chart').dataset.cexWave=b.reconWave;$('biv-chart').dataset.capitalDefinition=capitalIncomeDefinition();
    const notes=[...unavailable],selected=selectedSurveys(b);
    const intervals=[...selected].map(survey=>surveyName(survey)+' '+num(100*(META.relationship_bin_intervals?.[survey]??.001),1)).join('; ');
    if($('biv-bin-note'))$('biv-bin-note').textContent='Weighted bin statistics in the top 20%, ages 20–80 with positive food spending. Base intervals, in percentile points: '+intervals+'. '+(b.minN===0?'No minimum observation count or merging.':'Adjacent intervals are merged to retain at least '+b.minN+' '+(selected.size===1&&[...selected].some(isCEX)?tailUnit([...selected][0]):'observations')+' in every relevant wave/adjustment cell.'+(selected.has('SCF')?' The SCF minimum applies within each imputation.':''));
    if(selected.has('CEX_BM'))notes.push(META.cex_bm_display?.bivariate_note||META.cex_bm_display?.note||META.surveys?.CEX_BM?.definition||'CEX B&M uses the separate author sample with the same displayed measure.');
    if(selectedSurveys(b).has('CEX'))notes.push('CEX (previous construction) retains the earlier PSID-style consumption measure. CEX wealth coverage is partial.');
    if(b.minN===0){if([b.wave,b.scfWave,b.reconWave,b.cexWave].includes('average'))notes.push('Unmerged averages use each bin’s available nonempty waves; the number of waves can differ across bins.');if(selected.has('SCF'))notes.push('SCF cells must be nonempty in all five imputations.');}
    if(omitted.length) notes.push(omitted.join('; ')+ ' omitted from this plot.');
    const counts=regressions.filter(f=>f.method==='OLS');
    if(counts.length) notes.push(counts.map(f=>f.name+': '+f.n+' bins').join(' · ')+'.');
    $('biv-omissions').textContent=notes.join(' ');
    if(!plotted.length) return;
    const lo=Math.max(Math.min(...plotted.map(p=>p.x)),Math.min(...plotted.map(p=>p.y))), hi=Math.min(Math.max(...plotted.map(p=>p.x)),Math.max(...plotted.map(p=>p.y)));
    if(hi>lo) datasets.push({label:'Equal normalized values',type:'line',data:[{x:lo,y:lo},{x:hi,y:hi}],borderColor:'#b8b7bf',borderDash:[3,5],borderWidth:1,pointRadius:0,isReference:true,order:3});
    bivChart=new Chart($('biv-chart'),{type:'scatter',data:{datasets},plugins:[equalityLineLabel],options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:12,right:14,left:5,bottom:0}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:9,font:{size:13},padding:17,filter:item=>!datasets[item.datasetIndex].isTrace&&!datasets[item.datasetIndex].isFit}},tooltip:{backgroundColor:'#182437',padding:11,filter:item=>!!item.dataset.isMain,callbacks:{title:items=>items.length?items[0].dataset.label:'',label:ctx=>[displayLabel(pair.x,b.measure,ctx.dataset.survey)+' / mean: '+num(ctx.parsed.x,3),displayLabel(pair.y,b.measure,ctx.dataset.survey)+' / mean: '+num(ctx.parsed.y,3)],afterLabel:ctx=>num(100*ctx.raw.q_lo,1)+'–'+num(100*ctx.raw.q_hi,1)+' percentile · min. '+num(ctx.raw.n_obs,0)+(' '+tailUnit(ctx.dataset.survey))}}},scales:{x:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},border:{color:'#d9dce2'},title:{display:true,text:lx+' / sample mean',font:{size:13}},ticks:{callback:useLog?logTick:value=>num(value,1),autoSkip:!useLog,font:{size:13},maxRotation:0}},y:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},border:{display:false},title:{display:true,text:ly+' / sample mean',font:{size:13}},ticks:{callback:useLog?logTick:value=>num(value,1),autoSkip:!useLog,font:{size:13}}}}}});
    requestAnimationFrame(()=>bivChart?.resize());
    announce(fits.map(f=>f.name+' slope '+num(f.slope,3)).join('; '));
  }

  const setRadioValue=(name,value)=>document.querySelectorAll('input[name="'+name+'"]').forEach(input=>input.checked=input.value===value);
  function syncMainCapabilities(){
    if(s.measure!=='food_total')s.overlays.delete('nielsen');
    const selected=selectedSurveys(s),hasHousehold=[...selected].some(survey=>HOUSEHOLD_SURVEYS.has(survey)),hasAdjustable=[...selected].some(survey=>ADJUSTABLE_SURVEYS.has(survey)),hasConsumption=hasHousehold||selected.has('YODLEE')||selected.has('NIELSEN'),onlySCF=selected.size===1&&selected.has('SCF');
    if(!hasHousehold&&!isParetoMetric(s.metric)){s.metric='pareto';s.paretoMetric='pareto';}
    if(!hasHousehold&&s.metric==='pareto_wealth_ratio'){s.metric='pareto';s.paretoMetric='pareto';}
    if(!onlySCF&&s.customQ>.99)s.customQ=.99;
    $('indicator-select').value=s.metric;$('estimator-select').value=s.method;$('threshold-select').value=s.threshold;
    const kind=indicatorKind(s.metric);setRadioValue('indicator-kind',kind);setRadioValue('pareto-measure',s.paretoMetric);setRadioValue('pareto-estimator',s.method);setRadioValue('tail-threshold',s.threshold);setRadioValue('top-share-cutoff',s.shareMetric);
    $('pareto-options').hidden=kind!=='pareto';$('top-share-options').hidden=kind!=='shares';$('gini-options').hidden=kind!=='gini';
    document.querySelectorAll('input[name="indicator-kind"]').forEach(input=>{const unavailable=(input.value==='shares'||input.value==='gini')&&!hasHousehold;input.disabled=unavailable;input.closest('label')?.classList.toggle('unavailable-option',unavailable);input.closest('label').title=unavailable?'Top shares and Gini coefficients are unavailable for standalone reference datasets.':'';});
    document.querySelectorAll('input[name="pareto-measure"]').forEach(input=>{const unavailable=input.value==='pareto_wealth_ratio'&&!hasHousehold;input.disabled=unavailable;input.closest('label')?.classList.toggle('unavailable-option',unavailable);});
    const ols=document.querySelector('input[name="pareto-estimator"][value="OLS"]');if(ols){ols.disabled=false;ols.closest('label')?.classList.remove('unavailable-option');ols.closest('label').title='Datasets without a stored OLS estimate for the selected threshold are omitted automatically.';}
    const p99=document.querySelector('input[name="tail-threshold"][value="p99"]');if(p99){p99.disabled=false;p99.closest('label')?.classList.remove('unavailable-option');p99.closest('label').title='Dataset–series combinations without a stored P99 estimate are omitted automatically.';}
    const custom=$('custom-threshold');custom.max=onlySCF?'99.9':'99';custom.step='.1';custom.value=(100*s.customQ).toFixed(s.customQ*100%1?1:0);
    $('custom-threshold-control').hidden=kind!=='pareto'||s.threshold!=='custom';$('custom-threshold-note').textContent=s.threshold==='custom'?(onlySCF?'SCF supports stored thresholds through P99.9.':'Above P99 is available only for SCF. Estimates near P99 are less precise for PSID and CEX.') : '';
    const adjustmentUnavailable=!hasAdjustable;$('time-variant').disabled=adjustmentUnavailable||(bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM'));document.querySelector('.adjustment-block')?.classList.toggle('adjustment-unavailable',adjustmentUnavailable);$('measure-select').disabled=!hasConsumption;$('measure-select').closest('.control')?.classList.toggle('unavailable-option',!hasConsumption);
    syncWeightingControls();
  }
  function syncTailControls() {
    syncMainCapabilities();
    $('results-survey').value=r.survey;$('results-variable').value=r.variable;
    $('results-method').value=r.method;$('results-threshold').value=r.threshold;$('results-custom-threshold-control').hidden=r.threshold!=='custom';
  }
  function applyCustom(value,noteId,state=s) {
    const percentile=Number(value),maximum=state===r?Number($('results-custom-threshold').max)||99:state===s&&selectedSurveys(s).size===1&&selectedSurveys(s).has('SCF')?99.9:99;if(!Number.isFinite(percentile)||percentile<70||percentile>maximum||Math.abs(percentile*10-Math.round(percentile*10))>1e-7){$(noteId).textContent='Choose a percentile from 70 to '+maximum+' in 0.1-point steps.';return false;}
    state.customQ=percentile/100;$(noteId).textContent='';syncTailControls();return true;
  }
  function bind(id,fn) { $(id).addEventListener('change',event=>{fn(event.target.value);schedule();}); }
  bind('survey-select',value=>{s.primary=value;s.primaryEnabled=true;s.overlays.delete(value);if(value==='cex_bm'){s.measure='flow';s.variables.add('spending');}syncHousingAvailability();syncMainCapabilities();fillOverlays('overlay-controls',s,mainOverlayChoices());fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSeries();});
  const applyMainMetric=value=>{s.metric=value;if(isParetoMetric(value))s.paretoMetric=value;if(value.startsWith('share_'))s.shareMetric=value;if(value==='pareto_wealth_ratio')[...s.overlays].filter(survey=>!surveyChoices().includes(survey)).forEach(survey=>s.overlays.delete(survey));syncMainCapabilities();fillOverlays('overlay-controls',s,mainOverlayChoices());fillSeries();};
  bind('indicator-select',applyMainMetric);bind('time-variant',value=>{s.adjustment=value;applySpecificationSelection(false);});bind('threshold-select',value=>{s.threshold=value;syncTailControls();});
  bind('estimator-select',value=>{s.method=value;syncTailControls();});bind('results-method',value=>{r.method=value;syncTailControls();});bind('results-threshold',value=>{r.threshold=value;syncTailControls();});
  bind('results-survey',value=>{r.survey=value;r.datasets=value==='all'?new Set([...VISIBLE_US_SURVEYS,...referencePoints().map(row=>row.survey)]):new Set([value.toUpperCase()]);fillResultsDatasets();syncHousingAvailability();fillResultsVariables();});bind('results-variable',value=>r.variable=value);bind('results-adjustment',value=>{if(![...r.datasets].some(survey=>VISIBLE_US_SURVEYS.has(survey))&&r.datasets.has('YODLEE'))r.yodleeVariant=value;else r.adjustment=value;});bind('results-yodlee-adjustment',value=>r.yodleeVariant=value);
  $('custom-threshold').addEventListener('input',event=>{if(applyCustom(event.target.value,'custom-threshold-note'))schedule();});
  $('results-custom-threshold').addEventListener('input',event=>{if(applyCustom(event.target.value,'results-custom-threshold-note',r))schedule();});
  $('custom-threshold').addEventListener('change',event=>{if(applyCustom(event.target.value,'custom-threshold-note')){const value=100*s.customQ;event.target.value=value.toFixed(value%1?1:0);schedule();}});
  $('results-custom-threshold').addEventListener('change',event=>{if(applyCustom(event.target.value,'results-custom-threshold-note',r)){event.target.value=(100*r.customQ).toFixed(0);schedule();}});
  bind('measure-select',value=>{s.measure=value;if(value!=='food_total')s.overlays.delete('nielsen');$('measure-select').title=displayLabel('spending',value,s.primary.toUpperCase());fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());});
  document.querySelectorAll('input[name="indicator-kind"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;applyMainMetric(input.value==='pareto'?s.paretoMetric:input.value==='shares'?s.shareMetric:'gini');schedule();}));
  document.querySelectorAll('input[name="pareto-measure"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;applyMainMetric(input.value);schedule();}));
  document.querySelectorAll('input[name="pareto-estimator"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.method=input.value;syncTailControls();schedule();}));
  document.querySelectorAll('input[name="tail-threshold"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.threshold=input.value;syncTailControls();schedule();}));
  document.querySelectorAll('input[name="top-share-cutoff"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.shareMetric=input.value;applyMainMetric(input.value);schedule();}));
  [['weight-scf-income','scf_income'],['weight-irs-income','irs_income'],['weight-scf-wealth','scf_wealth']].forEach(([id,method])=>$(id).addEventListener('change',event=>{weighting.method=event.target.checked?method:'scf_income';applySpecificationSelection();}));
  bind('biv-survey-select',value=>{b.primary=value;b.overlays.delete(value);syncHousingAvailability();if(value==='cex_bm'&&!['wealth_consumption','income_consumption'].includes(b.pair)){b.pair='wealth_consumption';$('pair-select').value=b.pair;}fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());fillSpendingSelect('biv-measure-select',value,b,BINS);});
  bind('biv-variant',value=>{b.adjustment=value;fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);}); bind('biv-measure-select',value=>{b.measure=value;$('biv-measure-select').title=spendingName(value);}); bind('pair-select',value=>b.pair=value); bind('wave-select',value=>b.wave=value);
  bind('recon-wave-select',value=>b.reconWave=value);bind('scf-wave-select',value=>b.scfWave=value);bind('cex-wave-select',value=>b.cexWave=value);bind('bm-wave-select',value=>b.bmWave=value);
  bind('biv-bin-min',value=>b.minN=Number(value));
  [['biv-exclude-net-rent','excludeNetRent'],['biv-before-personal-interest','beforePersonalInterest']].forEach(([id,key])=>$(id)?.addEventListener('change',event=>{b[key]=event.target.checked;schedule();}));
  bind('biv-scale',value=>b.scale=value);bind('biv-fit',value=>b.fit=value);
  $('show-waves').addEventListener('change',event=>{b.traces=event.target.checked;schedule();});
  document.querySelectorAll('[data-stat]').forEach(button=>button.addEventListener('click',()=>{b.stat=button.dataset.stat;document.querySelectorAll('[data-stat]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));schedule();}));

  function downloadCSV(rows,name) {
    if(!rows.length) return; const fields=[...new Set(rows.flatMap(Object.keys))];
    const escape=value=>value===null||value===undefined?'':'"'+String(value).replace(/"/g,'""')+'"';
    const content=[fields.join(','),...rows.map(row=>fields.map(key=>escape(row[key])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})); const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadPNG(chart,name) { if(!chart)return; const anchor=document.createElement('a');anchor.download=name;anchor.href=chart.toBase64Image('image/png',1);anchor.click(); }
  $('download-time-csv').addEventListener('click',()=>downloadCSV(timeRows,'inequality_results.csv'));
  $('download-biv-csv').addEventListener('click',()=>downloadCSV(binRows,'joint_distribution_results.csv'));
  $('download-time-png').addEventListener('click',()=>downloadPNG(timeChart,'inequality.png'));
  $('download-biv-png').addEventListener('click',()=>downloadPNG(bivChart,'joint_distribution.png'));
  $('results-prev').addEventListener('click',()=>{resultPage--;renderResults();});$('results-next').addEventListener('click',()=>{resultPage++;renderResults();});
  $('download-results-selected').addEventListener('click',()=>downloadCSV(resultRows,'selected_inequality_results.csv'));
  $('download-results-all').addEventListener('click',downloadAllResults);

  function definitions() {
    const root=$('definitions-content');root.replaceChildren();root.classList.add('definitions-box');
    const heading=document.createElement('h3');heading.textContent='Measures and comparability';root.append(heading);
    const publicCEX=META.cex_bm_recon_display||{},publicCEXMeta=META.surveys?.CEX_BM_RECON||{};
    const scroll=document.createElement('div');scroll.className='table-scroll';const table=document.createElement('table');table.className='definitions-table';table.innerHTML='<thead><tr><th>Measure</th><th>PSID</th><th>SCF</th><th>CEX</th></tr></thead>';
    const rows=[
      ['Consumption','Consumption flow; expenditure and partial spending bundles are alternatives.','Expenditure and partial spending bundles; coverage varies by wave.',publicCEXMeta.variables?.consump_def1||'Meyer–Sullivan consumption augmented with PSID health, education and charitable giving.'],
      ['Expenditure','Saved consump_def5 expenditure excludes owner-occupied imputed rent. An alternative adds the NIPA-matched uniform owner-rent term.','Expenditure excluding owner-occupied imputed rent; the inclusive alternative adds the NIPA-matched uniform owner-rent term.','Purchase expenditure is available both excluding and including imputed rent; spending measures retain the Meyer–Sullivan equivalence scale and person weights.'],
      ['Labor income','Wages plus 67% of business income.','Wages plus 50% of the business/rental income bundle.',publicCEXMeta.variables?.total_labor_income||'Wages plus 67% of business income.'],
      ['Capital income','Business capital share, financial and rental income, net owner rent less debt interest; excludes realized gains.','Corresponding capital components, including observed realized gains.',publicCEXMeta.capital_income?.definition||'Observed capital income using the PSID/CEX identity.'],
      ['Total income','Constructed labor and capital income plus transfers and pensions. Used in the relationship plots.','Constructed labor and capital income plus transfers and pensions. Used in the relationship plots.',publicCEXMeta.total_income?.definition||'Before-tax total income using the PSID/CEX identity.'],
      ['Net worth','Assets less liabilities, with the authors’ component adjustments.','Assets less liabilities, adjusted by component; pension coverage differs from the PSID.',publicCEXMeta.wealth?.included||'Partial CEX net worth on the final-interview wealth sample.']
    ];
    const body=document.createElement('tbody');rows.forEach(row=>{const tr=document.createElement('tr');row.forEach((text,i)=>{const cell=document.createElement(i===0?'th':'td');cell.textContent=text;cell.style.whiteSpace='normal';if(i===0)cell.scope='row';tr.append(cell);});body.append(tr);});table.append(body);scroll.append(table);root.append(scroll);
    const note=document.createElement('p');note.textContent='PSID '+yearRange(years)+' and SCF '+yearRange(scfYears)+' use reference persons aged 20–80 and household survey weights. CEX covers '+yearRange(bmReconYears)+' with the same age range, positive food spending and person weights. CEX spending is equivalized; income and partial wealth retain consumer-unit amounts. Survey comparisons reflect these coverage and definition differences.';root.append(note);
    const addDetails=(title,texts)=>{const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title;details.append(summary);texts.filter(Boolean).forEach(text=>{const p=document.createElement('p');p.textContent=text;details.append(p);});root.append(details);return details;};
    addDetails('Estimation and log–log relationships',[
      'The main plot offers survey-weighted Pareto MLE or OLS, Pareto coefficients relative to the corresponding wealth coefficient, Gini coefficients and top 20%, 10%, 5% and 1% shares. A lower Pareto coefficient means a heavier tail. In the relative view, wealth equals one and each numerator is paired with wealth from the same survey, wave, adjustment stage and threshold rule. KS thresholds are selected separately by method, variable and wave using each source’s search window. Custom thresholds use whole percentiles from P70 to P99; unavailable cutoffs remain blank. The table provides numeric values and an aggregate CSV. Quantile figures draw only actual source grid points, with 90% Student-t intervals and the mean wave-specific KS estimate as the horizontal reference.',
      'Relationship plots use weighted bins in the top 20%. Initial 0.1-percentage-point intervals are merged until every relevant cell has the selected minimum of 5, 10 or 20 households in PSID/SCF, counted within each SCF imputation, or distinct CEX consumer units. '+(META.cex_display?.bivariate_note||cexCountsNote)+' Variables are normalized by their selected-sample weighted means. SCF points first average five imputations; across-wave views give equal weight to available waves.',
      'OLS fits levels or logarithms according to the selected axes. NLS fits y = A x^b using squared residuals in levels. Both give each displayed bin equal weight. R² is measured in the indicated fit space; only log plots omit nonpositive bin coordinates. Only observed CEX measure definitions are used in its bivariate plots; unavailable legacy definitions are left blank.'
    ]);
    const spending=addDetails('Spending alternatives and aggregate adjustments',[
      'PSID reporting adjustments reconcile components to national accounts; full adjustment also uses the SCF-income representation weights. SCF reported values use the original component values. Its rescaled and fully adjusted versions coincide: components are reconciled separately within each wave and imputation, with the original SCF weights and no additional representation correction. The Adjustments tab explains the PSID procedure graphically.'
    ]);
    spendingOptions.filter(option=>option.definition).forEach(option=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=option.label+': ';p.append(strong,document.createTextNode(option.definition));spending.append(p);});
    const methods=META.other_survey_methods,international=methods?.international,cex=methods?.cex;
    if(international)addDetails('HFCS, SHIW and HILDA conventions',[...Object.values(international.definitions||{}),...Object.values(international.methodology||{}),international.averaging,international.bivariate]);
    const earlySCF=META.surveys?.SCF?.early_extension;if(earlySCF?.historical_income_controls)addDetails('SCF: historical income controls',[earlySCF.historical_income_controls,earlySCF.signed_rental_income_control]);
    if(META.housing_methods||META.housing_method_aliases)addDetails('Homeowner housing services',[META.housing_methods?.definition||'The alternative uses a housing-value rate that is constant across homeowners within a survey and wave. Raw outcomes retain the source construction rate; rescaled and fully adjusted owner services are reconciled separately to the corresponding aggregate owner-rent control. Source representation weights are held fixed for this housing-definition sensitivity unless explicitly documented otherwise.',...Object.values(META.housing_methods?.notes||{})]);
    if(META.surveys?.CEX_BM_RECON){const meta=META.surveys.CEX_BM_RECON;addDetails('CEX: construction, definitions and coverage',[publicCEX.note,meta.sample,meta.coverage_note,...Object.values(meta.units||{}),meta.construction,...Object.values(meta.stages||{}),meta.labor_income?.reporting_adjustment,meta.capital_income?.definition,meta.capital_income?.reporting_adjustment,meta.capital_income?.housing_link,meta.total_income?.definition,meta.total_income?.reporting_adjustment,meta.wealth?.included,meta.wealth?.excluded,meta.wealth?.reporting_adjustment,...Object.values(meta.housing?.methods||{}),meta.housing?.limitation,meta.housing?.missing,meta.vehicle?.method,meta.vehicle?.missing,meta.vehicle?.limitation,meta.furniture?.method,meta.furniture?.missing,meta.representation?.note,...(meta.relationship_availability||[]).map(row=>'The wealth–capital-income relationship is unavailable in '+row.year+' with the constant imputed-rent rate and full adjustment because its paired-sample capital-income mean is nonpositive. The separate capital-income estimate remains available.'),publicCEX.validation_note].filter(Boolean));}
    if(META.us_reference_methods)addDetails('Standalone reference estimates',Object.entries(META.us_reference_methods).map(([survey,method])=>surveyName(survey)+': '+Object.values(method).filter(value=>typeof value==='string').join(' ')));
    const privacy=document.createElement('p');privacy.className='definition-note';privacy.textContent='Only final summary statistics and bin-level results are embedded. No household records, identifiers or survey-weight arrays are included.';root.append(privacy);
  }

  if(typeof Chart!=='function') { $('page-error').hidden=false;$('page-error').textContent='The embedded chart library could not be loaded.';return; }
  Chart.defaults.font.family='Arial, sans-serif'; Chart.defaults.color='#6c7180';
  if(typeof initUSReferencePoints==='function')referenceController=initUSReferencePoints(META);
  $('wave-select').replaceChildren();
  [['average','Across-wave average'],...years.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('wave-select').append(option);});
  $('wave-select').value=b.wave;
  $('scf-wave-select').replaceChildren();
  [['average','Across-wave average'],...scfYears.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('scf-wave-select').append(option);});
  if(!scfYears.includes(Number(b.scfWave)))b.scfWave=String(scfYears[scfYears.length-1]);
  $('scf-wave-select').value=b.scfWave;
  $('cex-wave-select').replaceChildren();
  [['average','Across-wave average'],...cexBivYears.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('cex-wave-select').append(option);});
  if(cexBivYears.length&&!cexBivYears.includes(Number(b.cexWave)))b.cexWave=String(cexBivYears[cexBivYears.length-1]);
  $('cex-wave-select').value=b.cexWave;
  $('recon-wave-select').replaceChildren();[['average','Across-wave average'],...bmReconYears.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('recon-wave-select').append(option);});if(!bmReconYears.includes(Number(b.reconWave)))b.reconWave=String(bmReconYears.at(-1));$('recon-wave-select').value=b.reconWave;
  $('biv-survey-select').replaceChildren();bivariateSurveyChoices().forEach(survey=>{const option=document.createElement('option');option.value=survey;option.textContent=surveyName(survey);$('biv-survey-select').append(option);});
  $('survey-select').value=s.primary;$('biv-survey-select').value=b.primary;
  fillOverlays('overlay-controls',s,mainOverlayChoices());fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());
  fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);$('biv-bin-min').value=String(b.minN);$('biv-scale').value=b.scale;$('biv-fit').value=b.fit;
  if($('overview-subtitle'))$('overview-subtitle').textContent='Consumption, income and wealth across survey waves.';
  function initializeOtherController(){
    if(otherController||typeof initOtherSurveys!=='function')return;
    const variables=['consump_def1','total_labor_income','total_income','networth_val','total_capital_income'],psidRows=[];
    for(const housing_method of [...new Set(ALL_SUMMARY.filter(row=>row.survey==='PSID').map(housingMethod))])for(const variant of ['raw','adj','full'])for(const weighting_method of (variant==='full'?['scf_income','irs_income','scf_wealth']:['scf_income']))for(const method of ['MLE','OLS']){
      const annual=years.map(year=>{
        const row={country:'US',country_name:'United States',survey:'PSID',housing_method,weighting_method,period_type:'wave',year,period_label:String(year),specification:variant,method,threshold:'KS',n_waves:1};
        variables.forEach(variable=>{const source=summaryIndex.get(['PSID',year,variant,variable,housing_method,weighting_method].join('|'));row[variable]=source?tailResult(source,method,'ks').estimate:null;});return row;
      });
      const mean={...annual[0],period_type:'average',year:null,period_label:yearRange(years)+' average',n_waves:annual.length};
      variables.forEach(variable=>{mean[variable]=avg(annual.map(row=>row[variable]));});psidRows.push(...annual,mean);
    }
    otherController=initOtherSurveys(DATA.other||{},psidRows,{usCurves:ALL_CURVES.filter(curve=>['PSID','CEX_BM_RECON'].includes(curve.survey)),usBinAvailability:BIN_AVAILABILITY.filter(row=>['PSID','SCF','CEX_BM_RECON'].includes(row.survey)),usBins:ALL_BINS.filter(row=>['PSID','SCF','CEX_BM_RECON'].includes(row.survey)&&FINITE(row.q_lo)),loadInternationalBins:separateBlocks?loadInternationalBins:null,loadUSBins:separateBlocks?async(surveys=['PSID'],selection={})=>{await ensureBivariate(surveys,{all:true,...selection});return ALL_BINS.filter(row=>['PSID','SCF','CEX_BM_RECON'].includes(row.survey)&&FINITE(row.q_lo));}:null,getHousingMethod:()=>housing.method,getSpecificationSignature:()=>housing.method+'|'+weighting.method,housingMatches:specificationMatches,metadata:META});
    if(otherVisible()){const control=document.querySelector('.global-housing-control:not(.quantile-housing-control)'),nav=$('cc-secondary-nav')?.querySelector('.secondary-nav-inner');if(control&&nav){control.hidden=false;nav.append(control);}}
  }
  function initializeThresholdController(){
    if(thresholdController||typeof ThresholdProfiles==='undefined')return;
    thresholdController=ThresholdProfiles.create({host:$('us-quantile-profiles'),curves:[...ALL_CURVES,...(referenceController?.profileCurves()||[])],surveys:['PSID','SCF','CEX_BM_RECON','YODLEE','FORBES'],spendingOptions,metadata:META,getHousingMethod:()=>housing.method,getSpecificationSignature:()=>housing.method+'|'+weighting.method,housingMatches:specificationMatches,onSurveyChange:survey=>{profileSurvey=survey;syncHousingAvailability();}});
    const housingControl=document.createElement('div');housingControl.className='global-housing-control quantile-housing-control';
    housingControl.innerHTML='<label class="small-check" for="quantile-constant-housing-service"><input type="checkbox" id="quantile-constant-housing-service">Constant imputed rent rate</label><button class="help-marker detail-help" type="button" data-help-control="constant_imputed_rent" aria-label="About constant imputed rent" aria-expanded="false">?</button>';
    $('us-quantile-profiles').querySelector('.threshold-profile-controls').append(housingControl);
    $('quantile-constant-housing-service').addEventListener('change',event=>{$('constant-housing-service').checked=event.target.checked;applyHousingMethod();});
  }
  function initializeAdjustmentController(){if(!adjustmentController&&typeof initAdjustments==='function')adjustmentController=initAdjustments(DATA.adjustments||{},{getHousingMethod:()=>housing.method,getWeightingMethod:()=>weighting.method,housingMatches,loadComposition:async survey=>{const key='composition_'+survey,value=await loadBlock(key);blockPromises.delete(key);return value;}});}
  if(typeof initDataAndCorrespondence==='function')dataController=initDataAndCorrespondence(META);
  window.addEventListener('adjustments-procedure-visible',()=>{if(adjustmentsVisible())adjustmentController?.render();});
  function filterSpecificationData(){SUMMARY=ALL_SUMMARY.filter(specificationMatches);CURVES=ALL_CURVES.filter(specificationMatches);BINS=ALL_BINS.filter(specificationMatches);}
  function syncWeightingControls(){
    const available=s.adjustment==='full'&&selectedSurveys(s).has('PSID')&&!!META.weighting_sensitivity;
    $('weight-scf-income').checked=weighting.method==='scf_income';$('weight-irs-income').checked=weighting.method==='irs_income';$('weight-scf-wealth').checked=weighting.method==='scf_wealth';
    $('weight-scf-income').disabled=!available;$('weight-irs-income').disabled=!available;$('weight-scf-wealth').disabled=!available;
    ['weight-scf-income','weight-irs-income','weight-scf-wealth'].forEach(id=>$(id).closest('.weighting-choice')?.classList.toggle('unavailable-option',!available));document.querySelector('.weighting-control')?.classList.toggle('weighting-unavailable',!available);
  }
  function applySpecificationSelection(shouldSchedule=true){
    filterSpecificationData();syncWeightingControls();fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);fillResultsVariables();fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());if(shouldSchedule)schedule();
  }
  function syncHousingAvailability(){
    const input=$('constant-housing-service'),mainSelection=selectedSurveys(s),supports=survey=>ALL_SUMMARY.some(row=>row.survey===survey&&housingMethod(row)==='bp'),unavailable=mainVisible()?![...mainSelection].some(supports):resultsVisible()?![...resultsSurveys()].some(supports):bivVisible()?!supports(b.primary.toUpperCase()):quantilesVisible()?(profileSurvey==='all'?![...VISIBLE_US_SURVEYS].some(supports):!supports(profileSurvey)):false;
    input.disabled=unavailable;input.closest('.weighting-choice')?.classList.toggle('unavailable-option',unavailable);input.title=unavailable?'The constant-rate homeowner-service alternative is available for PSID and CEX.':'Use the source constant-rate homeowner-service construction, retaining its documented component factors and representation weights.';
    input.checked=housing.method==='bp';
    ['quantile-constant-housing-service','biv-constant-housing-service'].forEach(id=>{const localInput=$(id);if(localInput){localInput.checked=housing.method==='bp';localInput.disabled=unavailable;localInput.title=input.title;localInput.closest('.local-housing-control,.quantile-housing-control')?.classList.toggle('unavailable-option',unavailable);}});
    syncWeightingControls();
  }
  function applyHousingMethod(){
    housing.method=$('constant-housing-service').checked?'bp':'benchmark';
    applySpecificationSelection();
  }
  function initDetailHelp(){
    const controls=META.weighting_sensitivity?.controls||{},fallback={irs_income:{tooltip:['Reweights PSID to the IRS/SOI income distribution using median-normalized income brackets and the corresponding reporting correction.','Available for fully adjusted PSID results.']},scf_wealth:{tooltip:['Reweights PSID to the SCF wealth distribution using median-normalized wealth brackets and the corresponding reporting correction.','Available for fully adjusted PSID results.']},scf_income:{tooltip:['Benchmark: reweight PSID and CEX units to the SCF income distribution using median-normalized income brackets.','This is the default representation correction in the fully adjusted specification. Yodlee bank-transaction data always use SCF income weights for representativeness.']},ks_threshold:{tooltip:['KS selects the tail threshold that minimizes the maximum distance between the empirical upper tail and its fitted Pareto distribution.','The threshold is selected separately for each dataset, wave, variable and estimator.']}};
    const popover=document.createElement('div');popover.className='detail-popover';popover.hidden=true;popover.setAttribute('role','tooltip');document.body.append(popover);let active=null,pinned=null;
    const helpTarget=node=>node?.closest?.('[data-help-control],.hover-help[data-tooltip]'),linesFor=target=>{if(!target.dataset.helpControl)return[target.dataset.tooltip].filter(Boolean);const key=target.dataset.helpControl,lines=[...((fallback[key]||controls[key])?.tooltip||[])];if(key==='constant_imputed_rent')lines.push('It also affects capital income because imputed rent is counted as rental income.');return lines;};
    const closeHelp=target=>{if(target&&target!==active)return;if(active?.matches('[data-help-control],[data-help-toggle]'))active.setAttribute('aria-expanded','false');active=null;pinned=null;popover.hidden=true;};
    const openHelp=target=>{const lines=linesFor(target);if(!lines.length)return;closeHelp();active=target;popover.replaceChildren();if(lines.length===1)popover.textContent=lines[0];else{const list=document.createElement('ul');lines.forEach(value=>{const item=document.createElement('li');item.textContent=value;list.append(item);});popover.append(list);}popover.hidden=false;if(target.matches('[data-help-control],[data-help-toggle]'))target.setAttribute('aria-expanded','true');const rect=target.getBoundingClientRect(),gap=8,margin=10,width=Math.min(320,window.innerWidth-2*margin);popover.style.width=width+'px';popover.style.left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin))+'px';let top=rect.bottom+gap;popover.style.top=top+'px';const height=popover.getBoundingClientRect().height;if(top+height>window.innerHeight-margin)popover.style.top=Math.max(margin,rect.top-height-gap)+'px';};
    document.addEventListener('click',event=>{const target=helpTarget(event.target);if(target){event.preventDefault();event.stopPropagation();if(target.dataset.helpToggle){if(pinned===target)closeHelp();else{openHelp(target);pinned=target;}}}else if(pinned)closeHelp();},true);document.addEventListener('mouseover',event=>{const target=helpTarget(event.target);if(target&&!target.contains(event.relatedTarget))openHelp(target);});document.addEventListener('mouseout',event=>{const target=helpTarget(event.target);if(target&&pinned!==target&&!target.contains(event.relatedTarget))closeHelp(target);});document.addEventListener('focusin',event=>{const target=helpTarget(event.target);if(target)openHelp(target);});document.addEventListener('focusout',event=>{const target=helpTarget(event.target);if(target&&pinned!==target)closeHelp(target);});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeHelp();});window.addEventListener('resize',()=>closeHelp());window.addEventListener('scroll',()=>closeHelp(),true);
  }
  $('constant-housing-service').checked=false;
  $('constant-housing-service').title='Use the source constant-rate homeowner-service construction, retaining its documented component factors and representation weights.';
  $('constant-housing-service').addEventListener('change',applyHousingMethod);
  $('biv-constant-housing-service').addEventListener('change',event=>{$('constant-housing-service').checked=event.target.checked;applyHousingMethod();});
  initDetailHelp();
  ['survey-select','results-survey'].forEach(id=>{['cex','cex_bm'].forEach(value=>{const option=$(id).querySelector('option[value="'+value+'"]');if(option)option.hidden=true;});});
  filterSpecificationData();syncWeightingControls();
  fillResultsDatasets();fillResultsVariables();syncTailControls();definitions();fillSeries();tab('inequality');
  if(loadingMain){loadingMain.inert=false;loadingMain.removeAttribute('aria-busy');loadingMain.setAttribute('data-interactive-ms',String(Math.round(performance.now())));}if(loadingNav)loadingNav.inert=false;startupStatus.remove();
  window.addEventListener('resize',()=>{if(mainVisible())timeChart?.resize();if(quantilesVisible())thresholdController?.resize();if(bivVisible())bivChart?.resize();if(otherVisible())otherController?.resize();if(adjustmentsVisible()&&(!dataController||dataController.isProcedureVisible()))adjustmentController?.resize();if(dataVisible()||adjustmentsVisible())dataController?.resize();});
})().catch(error=>{document.querySelector('main')?.removeAttribute('inert');document.querySelector('main')?.removeAttribute('aria-busy');document.getElementById('primary-nav')?.removeAttribute('inert');console.error(error);const target=document.getElementById('page-error');if(target){target.hidden=false;target.textContent='The results could not be loaded. Please reload the page in a current browser.';}});
