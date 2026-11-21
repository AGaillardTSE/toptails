let mobileFilterId = 0;

function initializeMobileFilters(root = document) {
  const selector = '.explorer-grid > .sidebar, .threshold-profile-controls, .results-controls, #panel-other .other-controls, .adjustment-figure-controls, .adjustment-distribution-controls';
  root.querySelectorAll(selector).forEach(controls => {
    if (controls.hasAttribute('data-mobile-filters')) return;
    controls.setAttribute('data-mobile-filters', '');
    if (!controls.id) controls.id = 'mobile-filters-' + ++mobileFilterId;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-filter-toggle';
    toggle.textContent = 'Filters';
    toggle.setAttribute('aria-controls', controls.id);
    toggle.setAttribute('aria-expanded', 'false');
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'mobile-filter-done';
    done.textContent = 'Done';
    function setOpen(open) {
      controls.toggleAttribute('data-mobile-filters-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', () => setOpen(!controls.hasAttribute('data-mobile-filters-open')));
    done.addEventListener('click', () => {
      setOpen(false);
      toggle.focus();
    });
    controls.before(toggle);
    controls.append(done);

    const sidebar = controls.matches('.sidebar');
    const heading = controls.parentElement.querySelector(sidebar
      ? ':scope > .plot-surface > :is(.plot-top, .chart-heading-row)'
      : ':scope > :is(.threshold-heading, .other-card-heading, .results-heading, .adjustment-results-header)');
    const title = heading?.querySelector('h2, h3');
    if (!title) return;

    const row = document.createElement('div');
    row.className = 'mobile-filter-title';
    const sidebarSlot = sidebar ? document.createComment('Plot filters') : null;
    if (sidebarSlot) controls.before(sidebarSlot);
    const phoneLayout = window.matchMedia('(max-width: 760px)');

    function alignWithTitle() {
      const focused = document.activeElement;
      if (phoneLayout.matches) {
        title.before(row);
        row.append(title, toggle);
        heading.classList.add('mobile-filter-heading');
        if (sidebarSlot) heading.after(controls);
      } else if (row.parentElement) {
        row.before(title);
        if (sidebarSlot) sidebarSlot.after(controls);
        controls.before(toggle);
        row.remove();
        heading.classList.remove('mobile-filter-heading');
      }
      if (controls.contains(focused) && focused.getClientRects().length) focused.focus({preventScroll: true});
    }

    phoneLayout.addEventListener('change', alignWithTitle);
    alignWithTitle();
  });
}

const chartsWithHiddenYAxisTitle = new WeakSet();
const chartsBeingExported = new WeakSet();

const onlineYAxisTitles = {
  id: 'onlineYAxisTitles',
  beforeInit(chart) {
    const title = chart.config.options.scales?.y?.title;
    if (!title?.display) return;
    const display = title.display;
    title.display = context => chartsBeingExported.has(chart) &&
      (typeof display === 'function' ? display(context) : display);
    chartsWithHiddenYAxisTitle.add(chart);
  }
};

function withFigureYAxisTitles(charts, capture) {
  const affected = charts.filter(chart => chartsWithHiddenYAxisTitle.has(chart));
  for (const chart of affected) chartsBeingExported.add(chart);
  try {
    for (const chart of affected) chart.update('none');
    return capture();
  } finally {
    for (const chart of affected) chartsBeingExported.delete(chart);
    for (const chart of affected) chart.update('none');
  }
}

function enableTouchTooltipDismissal(Chart) {
  let touchChart;
  function dismiss() {
    if (!touchChart?.canvas || !touchChart.tooltip?.getActiveElements().length) return;
    touchChart.setActiveElements([]);
    touchChart.tooltip.setActiveElements([], {x:0,y:0});
    touchChart.render();
  }
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const chart = event.target instanceof HTMLCanvasElement ? Chart.getChart(event.target) : undefined;
    if (chart !== touchChart) dismiss();
    touchChart = chart;
  }, {capture:true,passive:true});
  window.addEventListener('scroll', dismiss, {capture:true,passive:true});
}

function createTimeWindow(canvas, onChange) {
  const element = document.createElement('div');
  element.className = 'time-window';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Time window');
  element.hidden = true;
  element.innerHTML = `<div class="time-window-heading">
    <span>Time window</span><output class="time-window-years"></output>
    <button type="button" class="text-button" aria-label="Reset time window">Reset</button>
  </div><div class="time-window-sliders">
    <div class="time-window-rail" aria-hidden="true"></div>
    <input type="range" step="1" aria-label="Start year">
    <input type="range" step="1" aria-label="End year">
  </div><div class="time-window-ticks" aria-hidden="true"></div>`;
  canvas.parentElement.after(element);
  const sliders = element.querySelector('.time-window-sliders');
  const rail = element.querySelector('.time-window-rail');
  const [start, end] = element.querySelectorAll('input');
  const output = element.querySelector('output');
  const ticks = element.querySelector('.time-window-ticks');
  const reset = element.querySelector('button');
  let minimum, maximum, selectedStart = null, selectedEnd = null;

  const percent = year => 100 * (year - minimum) / (maximum - minimum) + '%';
  const values = () => [start.valueAsNumber, end.valueAsNumber];

  function showSelection() {
    const [first, last] = values();
    element.style.setProperty('--time-window-start', percent(first));
    element.style.setProperty('--time-window-end', percent(last));
    element.classList.toggle('time-window-start-on-top', first === maximum);
    output.textContent = first === last ? String(first) : first + '–' + last;
    reset.disabled = first === minimum && last === maximum;
  }

  function commit() {
    const [first, last] = values();
    selectedStart = first === minimum ? null : first;
    selectedEnd = last === maximum ? null : last;
    onChange();
  }

  start.addEventListener('input', () => {
    if (start.valueAsNumber > end.valueAsNumber) start.value = end.value;
    showSelection();
  });
  end.addEventListener('input', () => {
    if (end.valueAsNumber < start.valueAsNumber) end.value = start.value;
    showSelection();
  });
  start.addEventListener('change', commit);
  end.addEventListener('change', commit);
  reset.addEventListener('click', () => {
    start.value = minimum;
    end.value = maximum;
    start.focus({preventScroll:true});
    showSelection();
    commit();
  });

  sliders.addEventListener('click', event => {
    if (event.target === start || event.target === end) return;
    const {left, width} = rail.getBoundingClientRect();
    if (!width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - left) / width));
    const year = Math.round(minimum + fraction * (maximum - minimum));
    const [first, last] = values();
    const input = year <= (first + last) / 2 ? start : end;
    input.value = year;
    showSelection();
    commit();
  });

  function update(years) {
    if (!years.length) {
      element.hidden = true;
      return null;
    }
    const lo = Math.min(...years), hi = Math.max(...years);
    if (selectedStart > hi || (selectedEnd !== null && selectedEnd < lo)) {
      selectedStart = selectedEnd = null;
    }
    const from = Math.max(lo, selectedStart ?? lo), to = Math.min(hi, selectedEnd ?? hi);
    element.hidden = lo === hi;
    if (element.hidden) return {from, to};
    if (lo !== minimum || hi !== maximum) {
      minimum = lo;
      maximum = hi;
      for (const input of [start, end]) {
        input.min = lo;
        input.max = hi;
      }
      const step = [1, 2, 5, 10, 20, 50].find(value => (hi - lo) / value <= 5) || 100;
      const markedYears = [lo];
      for (let year = Math.ceil(lo / step) * step; year < hi; year += step) {
        if (year - lo >= step * .65 && hi - year >= step * .65) markedYears.push(year);
      }
      markedYears.push(hi);
      ticks.replaceChildren(...markedYears.map(year => {
        const tick = document.createElement('span');
        tick.textContent = year;
        tick.style.left = percent(year);
        return tick;
      }));
    }
    start.value = from;
    end.value = to;
    showSelection();
    return {from, to};
  }

  return {element, update};
}

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
    let initialBlocksLoaded=0;
    await Promise.all(initialBlocks.map(async node=>{
      const key=node.dataset.explorerBlock;
      DATA[key]=await loadBlock(key);
      startupStatus.textContent='Loading aggregate results · '+Math.round(100*++initialBlocksLoaded/initialBlocks.length)+'%';
    }));
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
  let BIN_AVAILABILITY=unpack(DATA.bivariate);
  let ALL_BINS=BIN_AVAILABILITY,SUMMARY=ALL_SUMMARY,BINS=ALL_BINS,CURVES=ALL_CURVES;
  const META = DATA.metadata || {};
  BIN_AVAILABILITY.push(...(META.relationship_additions_catalog||[]));
  const loadedBinSurveys=new Set(separateBlocks?[]:ALL_BINS.map(row=>row.survey)),loadedBinBlocks=new Set(),binPromises=new Map();
  const housing={method:'benchmark'};
  const dina={capitalDefinition:'including_fiscal_gains'};
  const dinaVariant=()=>META.saez_zucman_reference?.capital_income_definitions?.[dina.capitalDefinition]?.author_variant||'dina_2022_incl_gains';
  const weighting={method:'scf_income'};
  const housingMethod=row=>row.housing_method||'benchmark';
  const weightingMethod=row=>row.weighting_method||(row.survey==='CEX_BM_RECON'?'scf_housing':'scf_income');
  const housingSource=(survey,method=housing.method)=>META.housing_method_aliases?.[survey]?.[method]||method;
  const housingMatches=row=>housingMethod(row)===housingSource(row.survey||'PSID');
  const weightingMatches=row=>row.survey==='CEX_BM_RECON'?weightingMethod(row)==='scf_housing':['PSID','CEX'].includes(row.survey)&&row.variant==='full'?weightingMethod(row)===weighting.method:weightingMethod(row)==='scf_income';
  const specificationMatches=row=>row.survey==='SAEZ_ZUCMAN'||housingMatches(row)&&weightingMatches(row);
  const detailedCurveSurveys=[...document.querySelectorAll('[data-explorer-block^="tail_curves_"]')].map(node=>node.dataset.explorerBlock.slice('tail_curves_'.length)),loadedCurveSurveys=new Set(detailedCurveSurveys.length?[]:ALL_CURVES.map(row=>row.survey)),curvePromises=new Map();
  async function ensureFullCurves(surveys=detailedCurveSurveys){
    await Promise.all(surveys.filter(survey=>detailedCurveSurveys.includes(survey)).map(survey=>{
      if(loadedCurveSurveys.has(survey))return;
      if(!curvePromises.has(survey))curvePromises.set(survey,(async()=>{
        const key='tail_curves_'+survey,rows=unpack(await loadBlock(key));blockPromises.delete(key);
        if(META.reference_curve_surveys?.includes(survey))referenceController.addCurves(rows);else{ALL_CURVES=ALL_CURVES.filter(row=>row.survey!==survey).concat(rows);rows.forEach(row=>curveIndex.set(curveKey(row),row));CURVES=ALL_CURVES.filter(specificationMatches);}loadedCurveSurveys.add(survey);
      })().catch(error=>{curvePromises.delete(survey);throw error;}));return curvePromises.get(survey);
    }));
  }
  async function ensureDeferredBlock(key){if(!DATA[key])DATA[key]=await loadBlock(key);return DATA[key];}
  let bivariateCataloguePromise;
  function ensureBivariateCatalogue(){
    if(DATA.bivariate||!$('explorer-block-bivariate'))return;
    if(!bivariateCataloguePromise)bivariateCataloguePromise=loadBlock('bivariate').then(catalogue=>{
      BIN_AVAILABILITY=unpack(catalogue).concat(META.relationship_additions_catalog||[]);
      ALL_BINS=BIN_AVAILABILITY;
      BINS=ALL_BINS.filter(specificationMatches);
      for(const row of ALL_BINS)BIVARIATE_SURVEYS.add(row.survey);
      fillBivariateCatalogueControls();
      DATA.bivariate=catalogue;
    }).catch(error=>{bivariateCataloguePromise=null;throw error;});
    return bivariateCataloguePromise;
  }
  const binScopeMatches=(row,scope)=>!row.relationship_addition&&row.survey===scope.survey&&(!scope.pair_scoped||row.xvar===scope.xvar)&&housingMethod(row)===scope.housing_method&&weightingMethod(row)===scope.weighting_method&&(row.capital_income_definition||'benchmark')===scope.capital_income_definition&&(!FINITE(scope.bin_min_n)||Number(row.bin_min_n??10)===scope.bin_min_n);
  function selectedBinBlocks(survey,{all=false,minN=b.minN,adjustment=b.adjustment}={}){
    const pair=PAIRS[b.pair],ykey=sourceKey(pair.y,b.measure),dinaSource=survey==='SAEZ_ZUCMAN';
    const scopes=[...(META.relationship_blocks||[]),...(META.relationship_additions||[])].filter(scope=>scope.survey===survey);
    if(!scopes.length)return null;
    const method=dinaSource?'native_dina':survey==='CEX_BM_RECON'?'scf_housing':survey==='PSID'&&adjustment==='full'?weighting.method:'scf_income',definition=dinaSource?dina.capitalDefinition:all?'benchmark':capitalIncomeDefinition(),housingMethod=dinaSource?'not_applicable':housingSource(survey);
    return scopes.filter(scope=>(scope.pair_scoped?(!scope.pairs||scope.pairs.includes(b.pair))&&scope.xvar===pair.x:scope.additive?scope.xvar===pair.x&&scope.yvar===ykey&&scope.variant===bivariateVariantFor(survey):b.pair!=='income_capital')&&scope.housing_method===housingMethod&&scope.weighting_method===method&&scope.capital_income_definition===definition&&(!FINITE(scope.bin_min_n)||scope.bin_min_n===minN));
  }
  const bivariateReady=survey=>{const scopes=selectedBinBlocks(survey);return scopes?scopes.every(scope=>loadedBinBlocks.has(scope.key)):loadedBinSurveys.has(survey);};
  async function ensureBivariate(surveys,selection={}){
    await Promise.all(surveys.map(survey=>{
      const scopes=selectedBinBlocks(survey,selection);
      if(scopes)return Promise.all(scopes.map(scope=>{
        if(loadedBinBlocks.has(scope.key))return;
        if(!binPromises.has(scope.key))binPromises.set(scope.key,(async()=>{
          let rows=unpack(await loadBlock(scope.key));blockPromises.delete(scope.key);if(scope.additive){rows=rows.map(row=>({...row,relationship_addition:true}));ALL_BINS=ALL_BINS.filter(row=>!(row.relationship_addition&&row.survey===survey)).concat(rows);}else ALL_BINS=ALL_BINS.filter(row=>!binScopeMatches(row,scope)).concat(rows);loadedBinBlocks.add(scope.key);BINS=ALL_BINS.filter(specificationMatches);
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
    fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());syncBivariateCapitalControls();
    const surveys=[...selectedSurveys(b)];
    if(surveys.every(bivariateReady)){$('biv-chart').parentElement.removeAttribute('aria-busy');renderBivariate();return;}
    const empty=$('biv-empty');empty.hidden=false;empty.textContent='Loading '+surveys.filter(survey=>!bivariateReady(survey)).map(surveyName).join(' and ')+' relationship results…';$('biv-chart').parentElement.setAttribute('aria-busy','true');$('download-biv-csv').disabled=true;$('download-biv-png').disabled=true;
    ensureBivariate(surveys).then(()=>{fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);if(bivVisible())schedule();}).catch(error=>{empty.textContent='Relationship results could not be loaded. Please reload the page.';console.error(error);});
  }
  const isCEX=survey=>['CEX','CEX_BM','CEX_BM_RECON'].includes(survey);
  const sourceDisplay=survey=>survey==='CEX_BM_RECON'?(META.cex_bm_recon_display||META.cex_bm_display||META.cex_display):survey==='CEX_BM'?(META.cex_bm_display||META.cex_display):META.cex_display;
  const cexRecordUnit=META.surveys?.CEX?.record_unit||'consumer-unit-interview';
  const cexAnnual=['household-year','consumer-unit-year'].includes(cexRecordUnit);
  const cexTailUnit=META.cex_display?.tail_unit||(cexRecordUnit==='household-year'?'household-years':cexRecordUnit==='consumer-unit-year'?'consumer-unit-years':'distinct consumer units');
  const cexRecordAggregation=META.cex_display?.record_aggregation||(cexRecordUnit==='household-year'?'one household/address-year, averaged available quarterly reports':cexRecordUnit==='consumer-unit-year'?'one consumer-unit-year, averaged available quarterly reports':'quarterly consumer-unit interview records');
  const cexCountsNote=META.cex_display?.counts||META.cex_display?.counts_note||(cexRecordUnit==='household-year'?'Each CEX record and tail unit is one verified single-CU household/address-year, averaging available quarterly reports; repeated interviews do not count as separate annual observations.':cexRecordUnit==='consumer-unit-year'?'Each CEX record and tail unit is one consumer-unit-year, averaging available quarterly reports; repeated interviews do not count as separate annual observations.':'CEX tail units count distinct consumer units, while records count quarterly interviews.');
  const tailUnit=survey=>survey==='SAEZ_ZUCMAN'?'synthetic adults aged 20+':isCEX(survey)?(META.surveys?.[survey]?.tail_unit||sourceDisplay(survey)?.tail_unit||cexTailUnit):'households';
  const FINITE = x => typeof x === 'number' && Number.isFinite(x);
  const avg = a => { const x = a.filter(FINITE); return x.length ? x.reduce((s,v)=>s+v,0)/x.length : null; };
  const num = (x,d=2) => FINITE(x) ? x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const pct = x => FINITE(x) ? num(100*x,1)+'%' : '—';
  // Author's series_cols in PSID/0_PSID_final_figures.R.
  const COLORS = {spending:'#477EAD',total_labor_income:'#BF5555',total_capital_income:'#C4A12A',total_income:'#A96F4B',networth_val:'#4D8B69'};
  const KEYS = ['spending','total_labor_income','total_capital_income','networth_val','total_income'];
  const LABELS = {total_labor_income:'Labor income',total_capital_income:'Capital income',total_income:'Total income',networth_val:'Net worth'};
  const ADJ = {raw:'Raw data',adj:'Rescaled',full:'Fully adjusted'};
  const adjustmentLabel=row=>isCEX(row.survey)&&row.variable==='networth_val'&&row.variant==='full'&&!ALL_SUMMARY.some(value=>value.survey===row.survey&&value.variable==='networth_val'&&value.variant==='adj'&&housingMethod(value)===housingMethod(row))?'Income reweighted':row.survey==='SCF'&&row.variant==='adj'?'Rescaled':row.variant==='original'?'Original B&M construction':ADJ[row.variant]||row.variant;
  const PAIRS = {
    wealth_consumption:{x:'networth_val',y:'spending'}, income_consumption:{x:'total_income',y:'spending'},
    labor_consumption:{x:'total_labor_income',y:'spending'},capital_consumption:{x:'total_capital_income',y:'spending'},
    wealth_capital:{x:'networth_val',y:'total_capital_income'},income_capital:{x:'total_income',y:'total_capital_income'}
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
  const s = {cexIncome:false,tab:'inequality',primary:'psid',primaryEnabled:true,overlays:new Set(['scf','yodlee','forbes','saez_zucman']),metric:'pareto',paretoMetric:'pareto',shareMetric:'share_top20',adjustment:'full',method:'MLE',threshold:'ks',customQ:.95,measure:'flow',variables:new Set(KEYS.filter(key=>key!=='total_income'))};
  const r = {survey:'psid',datasets:new Set(['PSID']),yodleeVariant:'all',variable:'all',adjustment:'full',method:'MLE',threshold:'ks',customQ:.95};
  const b = {primary:'psid',overlays:new Set(),adjustment:'full',measure:'flow',pair:'wealth_consumption',wave:'average',scfWave:'average',dinaWave:'average',autoSCF:false,cexWave:'latest',reconWave:'latest',bmWave:'latest',stat:'mean',minN:10,excludeNetRent:false,beforePersonalInterest:false,traces:false,scale:'loglog',fit:'ols'};
  let eyeController,definitionsController,paretoController,timeChart,bivChart,otherController,adjustmentController,quantileComparison,referenceController,dataController,frame,timeRows=[],binRows=[],resultRows=[],resultPage=0,allResultsBusy=false,lastUSTab='inequality';
  const VISIBLE_US_SURVEYS=new Set(['PSID','SCF','CEX_BM_RECON']);
  const BIVARIATE_SURVEYS=new Set([...BIN_AVAILABILITY.map(row=>row.survey),...(META.relationship_blocks||[]).map(scope=>scope.survey)]),hasCorrectedCEXBins=BIVARIATE_SURVEYS.has('CEX_BM_RECON');
  const surveyChoices=()=>['psid','scf',...(ALL_SUMMARY.some(row=>row.survey==='CEX_BM_RECON')?['cex_bm_recon']:[])];
  const bivariateSurveyChoices=()=>['psid','scf','cex_bm_recon','saez_zucman'].filter(survey=>BIVARIATE_SURVEYS.has(survey.toUpperCase()));
  const mainOverlayChoices=()=>{const choices=[...surveyChoices(),...(referenceController?.sources||[]).map(x=>x.toLowerCase())],order=['psid','cex_bm_recon','scf','yodlee','nielsen','forbes'];return [...order.filter(key=>choices.includes(key)),...choices.filter(key=>!order.includes(key))];};
  const surveyName=survey=>survey.toUpperCase()==='YODLEE'?'Yodlee (bank data)':survey.toUpperCase()==='CEX_BM_RECON'?'CEX':survey.toUpperCase()==='CEX'&&hasCorrectedCEXBins?'CEX (previous construction)':META.surveys?.[survey.toUpperCase()]?.label||(survey.toUpperCase()==='CEX_BM'?'CEX B&M':referenceController?.labels[survey.toUpperCase()]||survey.toUpperCase());
  const SURVEY_TOOLTIPS={
    PSID:'Panel Study of Income Dynamics: longitudinal U.S. household panel covering consumption, income, and wealth.',
    SCF:'Survey of Consumer Finances: triennial U.S. household survey designed to measure household finances and oversample wealthy families.',
    CEX:'Consumer Expenditure Interview Survey: consumer-unit interviews covering spending, income, and partial wealth.',
    CEX_BM:'Authors’ supplied CEX B&M reference series, retained unchanged.',
    CEX_BM_RECON:'Consumer Expenditure Interview Survey (CEX), using the Meyer–Sullivan consumption construction and public extension. Consumption and partial wealth are shown by default. Public-use income components are poorly reported at the top: topcoding severely biases upper-tail estimates. In Tails over time and US Tails by quantile, Show income enables these optional estimates. Representation uses SCF primary-home values and nonownership.',
    YODLEE:'Bank–individual-account transaction data: each observation is one person’s account within the sampled banking system, not a complete household consumption unit. Spending outside the observed account—such as cash or activity at other institutions—is not captured. SCF income weights are always used to improve representativeness.',
    NIELSEN:'NielsenIQ household-panel reference based on annual retail purchases. It is available only when “Variable for consumption” is Food because it does not measure the broader consumption concepts used by the other choices.',
    SAEZ_ZUCMAN:'Distributional National Accounts (DINA), 1970–2019: synthetic adults aged 20+, reconstructed from tax, survey and national accounts data. Income follows Piketty, Saez and Zucman; wealth follows Saez and Zucman. Capital and total income include fiscal capital gains by default.' + (META.dina_total_income_release?.ks_window?.length === 2 ? ' For total income, the KS search spans '+META.dina_total_income_release.ks_window.map(q=>'P'+Number((100*q).toFixed(2))).join('–')+'.' : ''),
    FORBES:'World’s Billionaires + Forbes 400, 1982–2024: one weight per distinct listed person or family fortune, with overlaps removed. The lists use different dates within a year; early coverage relies on historical Forbes 400 records. Sources and coverage are described in Sources.'
  };
  const surveyTooltip=survey=>SURVEY_TOOLTIPS[survey.toUpperCase()]||surveyName(survey);
  const spendingKey = measure => spendingOptions.find(option=>option.value===measure)?.key || FALLBACK_SPENDING.find(option=>option.value===measure)?.key || measure;
  const spendingName = measure => spendingOptions.find(option=>option.value===measure)?.label || FALLBACK_SPENDING.find(option=>option.value===measure)?.label || measure;
  const label = (key,measure) => key==='spending' ? spendingName(measure) : LABELS[key] || key;
  const sourceKey = (key,measure) => key==='spending' ? spendingKey(measure) : key;
  const displayLabel = (key,measure,survey) => isCEX(survey)?(META.cex_optional_income?.variables?.[sourceKey(key,measure)]||sourceDisplay(survey)?.labels?.[sourceKey(key,measure)]||({networth_val:'Partial net worth (CEX)',total_capital_income:'Observed capital income (CEX)'})[sourceKey(key,measure)]||label(key,measure)):label(key,measure);
  const variableDisplayLabel = (variable,survey) => (isCEX(survey)?sourceDisplay(survey)?.labels?.[variable]:null)||META.variables?.[variable]?.label||spendingOptions.find(option=>option.key===variable)?.label||LABELS[variable]||variable.replace(/_/g,' ');
  const wealthDenominatorLabel = survey => isCEX(survey)?(sourceDisplay(survey)?.labels?.networth_val||'Partial net worth (CEX)'):'Net worth';
  const bmOriginalOnly=!ALL_SUMMARY.some(row=>row.survey==='CEX_BM'&&['raw','adj','full'].includes(row.variant));
  const variantFor = (survey,adjustment=s.adjustment) => survey==='CEX_BM'&&bmOriginalOnly?'original':adjustment;
  const bivariateVariantFor=survey=>survey==='SAEZ_ZUCMAN'?'reference':survey==='CEX_BM'?'raw':variantFor(survey,b.adjustment);
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
  const paretoVisible = () => !$('panel-pareto').hidden;
  const dataVisible = () => !$('panel-data').hidden;
  const resultsVisible = () => !$('panel-results').hidden;
  const quantilesVisible = () => !$('panel-quantiles').hidden;
  const curveKey = row => [row.survey,row.year,row.variant,row.variable,housingMethod(row),weightingMethod(row)].join('|');
  const curveIndex = new Map(ALL_CURVES.map(curve=>[curveKey(curve),curve]));
  const summaryIndex = new Map(ALL_SUMMARY.map(row=>[curveKey(row),row]));
  const thresholdQ = (rule=s.threshold,customQ=s.customQ) => {const q=rule==='ks'?null:rule==='custom'?customQ:Number(rule.slice(1))/100;return FINITE(q)?q:null;};
  const thresholdName = (state=s) => state.threshold==='ks'?'KS-selected thresholds':state.threshold==='custom'?'Percentile '+num(100*state.customQ,1)+' thresholds':({p80:'Top 20% · 80th-percentile thresholds',p90:'Top 10% · 90th-percentile thresholds',p95:'Top 5% · 95th-percentile thresholds',p98:'Top 2% · 98th-percentile thresholds',p99:'Top 1% · 99th-percentile thresholds'})[state.threshold];
  function appendParetoEstimationLink(container){
    const link=document.createElement('a');
    link.className='subtitle-tab-link';
    link.href='#panel-pareto';
    link.textContent='Pareto estimation';
    link.addEventListener('click',event=>{event.preventDefault();tab('pareto');});
    container.append(' (see ',link,')');
  }
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
    if(mainVisible()&&s.cexIncome&&selectedSurveys(s).has('CEX_BM_RECON')){await ensureCEXIncome();fillSeries();}
    if(mainVisible()&&isParetoMetric(s.metric)&&s.threshold!=='ks')await ensureFullCurves([...selectedSurveys(s)]);
    if(resultsVisible())await ensureFullCurves([...resultsSurveys()].filter(survey=>r.threshold!=='ks'||META.reference_curve_surveys?.includes(survey)));
    if(quantilesVisible()&&!quantileComparison)initializeQuantileComparison();
    if(bivVisible())await ensureBivariateCatalogue();
    if(otherVisible()){await ensureDeferredBlock('other');if(s.cexIncome)await ensureCEXIncome();initializeOtherController();}
    if(adjustmentsVisible()){await ensureDeferredBlock('adjustments');initializeAdjustmentController();}
    if(paretoVisible()){if(!paretoController)paretoController=initParetoEstimation({host:$('pareto-estimation-content'),loadData:()=>loadBlock('illustration_ks')});await paretoController.render();}
  }
  function schedule() {
    const request=++viewRequest;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(async()=>{try{
      $('page-error').hidden=true;
      const preparation=prepareView();
      const pending=bivVisible()&&!DATA.bivariate&&$('explorer-block-bivariate')||otherVisible()&&!otherController||adjustmentsVisible()&&!adjustmentController||(mainVisible()&&s.threshold!=='ks'?[...selectedSurveys(s)]:resultsVisible()&&r.threshold!=='ks'?[...resultsSurveys()]:[]).some(survey=>detailedCurveSurveys.includes(survey)&&!loadedCurveSurveys.has(survey));
      if(pending){startupStatus.textContent='Loading selected results…';document.body.append(startupStatus);loadingMain?.setAttribute('aria-busy','true');}
      await preparation;if(request!==viewRequest)return;
      if(mainVisible())renderTime();if(resultsVisible())renderResults();if(quantilesVisible())quantileComparison?.render();if(bivVisible())renderBivariateWhenReady();if(s.tab==='eyeballing')eyeController?.render();if(otherVisible())otherController?.render();if(adjustmentsVisible()&&(!dataController||dataController.isProcedureVisible()))adjustmentController?.render();if(dataVisible()||adjustmentsVisible())dataController?.render();if(!$('panel-definitions').hidden)definitionsController?.render();
      initializeMobileFilters();
      if(!loadingMain?.dataset.firstPlotMs)loadingMain?.setAttribute('data-first-plot-ms',String(Math.round(performance.now())));
      startupStatus.remove();loadingMain?.removeAttribute('aria-busy');
    }catch(error){if(request!==viewRequest)return;startupStatus.remove();loadingMain?.removeAttribute('aria-busy');$('page-error').hidden=false;$('page-error').textContent='The selected plot could not be drawn. Please change the selection or reload the page.';console.error(error);}});
  }
  function tab(name) {
    const us=['inequality','quantiles','results','loglog','eyeballing'].includes(name);if(us)lastUSTab=name;s.tab=name;
    $('us-secondary-nav').hidden=!us;$('live-announcement').hidden=name!=='inequality';if(name!=='inequality')$('live-announcement').textContent='';
    const housingControl=document.querySelector('.global-housing-control'),housingNav=us?$('us-secondary-nav')?.querySelector('.secondary-nav-inner'):name==='other'?$('cc-secondary-nav')?.querySelector('.secondary-nav-inner'):name==='adjustments'?$('dc-adjustments-nav-inner'):null;
    if(housingControl){housingControl.hidden=!housingNav;if(housingNav)housingNav.append(housingControl);}
    document.querySelectorAll('#primary-nav [data-section]').forEach(button=>{const active=button.dataset.section===(us?'us':name);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);if(button.dataset.section==='us')button.setAttribute('aria-controls','panel-'+lastUSTab);});
    document.querySelectorAll('#us-secondary-nav [data-tab]').forEach(button=>{const active=button.dataset.tab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);});
    ['inequality','quantiles','results','loglog','eyeballing','other','adjustments','pareto','data','definitions','repository'].forEach(key=>{const panel=$('panel-'+key),active=key===name;panel.hidden=!active;panel.classList.toggle('active',active);});if(name==='definitions')definitionsController?.chooseDefault([...selectedSurveys(s)]);syncHousingAvailability();schedule();
  }
  document.querySelectorAll('#us-secondary-nav [data-tab]').forEach(button=>{
    button.addEventListener('click',()=>tab(button.dataset.tab));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const all=[...document.querySelectorAll('#us-secondary-nav [data-tab]')];let index=all.indexOf(button);if(event.key==='Home')index=0;else if(event.key==='End')index=all.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;all[index].focus();tab(all[index].dataset.tab);});
  });
  document.querySelectorAll('#primary-nav [data-section]').forEach(button=>{
    button.addEventListener('click',()=>tab(button.dataset.section==='us'?lastUSTab:button.dataset.section));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const all=[...document.querySelectorAll('#primary-nav [data-section]')];let index=all.indexOf(button);if(event.key==='Home')index=0;else if(event.key==='End')index=all.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;all[index].focus();tab(all[index].dataset.section==='us'?lastUSTab:all[index].dataset.section);});
  });

  let cexIncomeSummary=[],cexIncomeCurves=[],cexIncomeReady=false;
  const timeSummary=()=>s.cexIncome?SUMMARY.concat(cexIncomeSummary.filter(specificationMatches)):SUMMARY;
  const timeKeys=()=>KEYS;
  async function ensureCEXIncome(){
    if(cexIncomeReady)return;
    const payload=await loadBlock('optional_income_CEX_BM_RECON');
    cexIncomeSummary=unpack(payload.summary);
    cexIncomeCurves=unpack(payload.curves);cexIncomeCurves.forEach(row=>curveIndex.set(curveKey(row),row));
    cexIncomeReady=true;
  }
  function fillSeries() {
    $('series-controls').replaceChildren();const selection=selectedSurveys(s),labelSurvey=selection.size===1?[...selection][0]:s.primary.toUpperCase();
    timeKeys().forEach(key=>{
      const onlyCEX=selectedSurveys(s).size===1&&selectedSurveys(s).has('CEX_BM_RECON');if(onlyCEX&&!s.cexIncome&&['total_labor_income','total_capital_income','total_income'].includes(key))return;
      const item=document.createElement('label'); item.className='series-choice'; item.style.setProperty('--series',COLORS[key]);
      const input=document.createElement('input'); input.type='checkbox'; input.checked=s.variables.has(key); input.setAttribute('aria-label',displayLabel(key,s.measure,labelSurvey));
      const selected=selectedSurveys(s),surveyAvailable=timeSummary().some(row=>selected.has(row.survey)&&row.variant===variantFor(row.survey,s.adjustment)&&row.variable===sourceKey(key,s.measure)),referenceAvailable=[...selected].some(survey=>referenceController?.hasVariable(survey,sourceKey(key,s.measure))||(key==='spending'&&survey==='NIELSEN'&&s.measure==='food_total'));input.disabled=!surveyAvailable&&!referenceAvailable;
      input.addEventListener('change',()=>{ input.checked?s.variables.add(key):s.variables.delete(key);if(key==='networth_val'&&!input.checked&&s.overlays.has('forbes')){s.overlays.delete('forbes');fillOverlays('overlay-controls',s,mainOverlayChoices());}schedule(); });
      const swatch=document.createElement('span'); swatch.className='series-swatch'; const text=document.createElement('span'); text.textContent=displayLabel(key,s.measure,labelSurvey);
      item.append(input,swatch,text);
      if (key==='total_income') {
        const group=document.createElement('span');
        group.className='us-total-income-choice';
        group.append(item,createUSTotalIncomeHelp());
        $('series-controls').append(group);
      } else $('series-controls').append(item);
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
      const input=document.createElement('input'),reference=!surveyChoices().includes(survey),ratioUnavailable=state===s&&s.metric==='pareto_wealth_ratio'&&reference&&!referenceController?.supportsMetric(survey.toUpperCase(),s.metric),nielsenUnavailable=state===s&&survey==='nielsen'&&state.measure!=='food_total',locked=state===b&&survey==='psid',relationshipUnavailable=state===b&&!BIN_AVAILABILITY.some(row=>row.survey===survey.toUpperCase()&&specificationMatches(row)&&row.variant===bivariateVariantFor(row.survey)&&row.xvar===PAIRS[b.pair].x&&row.yvar===sourceKey(PAIRS[b.pair].y,b.measure));input.type='checkbox';input.checked=(survey===state.primary&&state.primaryEnabled!==false)||state.overlays.has(survey);input.disabled=ratioUnavailable||nielsenUnavailable||locked||relationshipUnavailable;input.title=relationshipUnavailable?(survey==='cex_bm_recon'?'CEX shows consumption and partial wealth only. Public-use income components are topcoded, severely distorting their upper tails.':'This dataset has no stored estimates for the selected relationship and adjustment.'):locked?'PSID remains selected as the reference dataset.':ratioUnavailable?'This reference series has no matching wealth coefficient.':nielsenUnavailable?'Select Food under “Variable for consumption” to use NielsenIQ.':'';item.classList.toggle('unavailable-option',ratioUnavailable||nielsenUnavailable||relationshipUnavailable);input.setAttribute('aria-label',(unified?'Show ':'Compare with ')+name+'. '+description);input.addEventListener('change',()=>{
        if(unified){
          if(input.checked){if(survey===state.primary)state.primaryEnabled=true;else state.overlays.add(survey);}
          else if(selectedSurveys(state).size<=1){input.checked=true;announce('At least one dataset must remain selected.');return;}
          else if(survey===state.primary)state.primaryEnabled=false;
          else state.overlays.delete(survey);
        }else input.checked?state.overlays.add(survey):state.overlays.delete(survey);
        if(state===s&&survey==='forbes'&&input.checked)state.variables.add('networth_val');
        if(state===s){syncHousingAvailability();syncMainCapabilities();fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());}
        if(state===b){if(survey==='scf')b.autoSCF=false;syncHousingAvailability();fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);}
        schedule();
      });item.append(input,labelText,help);
      if(id==='overlay-controls'&&survey==='cex_bm_recon'){
        const row=document.createElement('div'),option=document.createElement('label'),income=document.createElement('input'),text=document.createElement('span'),detail=document.createElement('span');
        row.className='cex-dataset-row';option.className='small-check cex-income-option';income.type='checkbox';income.id='cex-show-income';income.checked=s.cexIncome;income.disabled=!selectedSurveys(s).has('CEX_BM_RECON');income.setAttribute('aria-label','Show CEX topcoded income');text.textContent='Show income';
        detail.className='help-marker hover-help';detail.textContent='?';detail.tabIndex=0;detail.setAttribute('aria-label','About CEX topcoded income');detail.dataset.tooltip=META.cex_optional_income?.warning||'Public-use CEX income is incompletely reported and topcoded, severely distorting upper-tail estimates. Corrections do not recover the original high-income observations.';help.remove();
        income.addEventListener('change',()=>{s.cexIncome=income.checked;fillSeries();schedule();});option.append(income,text);row.append(item,option,detail);fieldset.append(row);
      }else fieldset.append(item);
    });
  }
  function destroy(canvas,chart) { const existing=Chart.getChart($(canvas)); if(existing) existing.destroy(); else if(chart) chart.destroy(); }
  const timeWindow = createTimeWindow($('time-chart'), schedule);
  const phoneLayout = window.matchMedia('(max-width: 760px)');
  phoneLayout.addEventListener('change', () => { if (mainVisible()) schedule(); });

  function renderTime() {
    destroy('time-chart',timeChart);timeChart=null;timeRows=[];
    syncMainCapabilities();syncDinaControls();
    let datasets=[];
    const selected=selectedSurveys(s),styles={PSID:{point:'circle',dash:[],radius:4.5},SCF:{point:'rectRot',dash:[5,4],radius:6},CEX:{point:'triangle',dash:[2,4],radius:6},CEX_BM:{point:'crossRot',dash:[8,3,2,3],radius:8},CEX_BM_RECON:{point:'triangle',dash:[2,4],radius:6}};
    timeKeys().filter(key=>s.variables.has(key)).forEach(key=>{
      const variable=sourceKey(key,s.measure),color=COLORS[key];
      [...selected].forEach(survey=>{
        if(isParetoMetric(s.metric)&&s.threshold==='p99'&&HOUSEHOLD_SURVEYS.has(survey)&&!['SCF','CEX_BM_RECON'].includes(survey))return;
        const variant=variantFor(survey),style=styles[survey];
        const rows=timeSummary().filter(row=>row.survey===survey&&row.variant===variant&&row.variable===variable).sort((a,b)=>a.year-b.year);
        if(!rows.some(row=>FINITE(metricValue(row))))return;
        const sourceYears=surveyYears[survey]||[],chartYears=isCEX(survey)&&sourceYears.length?Array.from({length:sourceYears[sourceYears.length-1]-sourceYears[0]+1},(_,i)=>sourceYears[0]+i):sourceYears;
        datasets.push({label:displayLabel(key,s.measure,survey)+' · '+surveyName(survey),survey,key,variable,type:'line',data:chartYears.map(year=>{const row=rows.find(r=>r.year===year),fit=row?tailResult(row):null,period=SeriesYears.period(row||{survey,year,variable});return {x:period.year,wave:year,period_label:period.detail,y:row&&FINITE(metricValue(row))?metricValue(row):null,q:fit?.q,maxks:fit?.maxks,n_tail:fit?.n_tail};}),showLine:rows.length>1,spanGaps:false,tension:0,borderColor:color,backgroundColor:color,borderWidth:survey==='PSID'?2.5:1.7,borderDash:style.dash,pointStyle:style.point,pointRadius:rows.length===1?7:style.radius,pointHoverRadius:survey==='CEX_BM'?10:8.5,pointHitRadius:10,pointBackgroundColor:survey==='PSID'?'#fff':color,pointBorderColor:survey==='PSID'||survey==='CEX_BM'?color:'#fff',pointBorderWidth:survey==='CEX_BM'?2.4:1.3});
        rows.filter(row=>FINITE(metricValue(row))).forEach(row=>{const fit=tailResult(row),wealth=wealthTail(row),value=metricValue(row);timeRows.push({survey,income_topcoded:survey==='CEX_BM_RECON'&&['total_labor_income','total_capital_income','total_income'].includes(variable),housing_method:housing.method,source_housing_method:housingMethod(row),weighting_method:weightingMethod(row),wave:row.year,observation_year:SeriesYears.period(row).year,observation_period:SeriesYears.period(row).label,year_basis:SeriesYears.period(row).basis,adjustment:variant,source_variant:variant,variable,variable_label:variableDisplayLabel(variable,survey),indicator:s.metric,method:isParetoMetric(s.metric)?s.method:'',threshold:isParetoMetric(s.metric)?s.threshold:'',estimate:value,pareto_estimate:isParetoMetric(s.metric)?fit.estimate:null,wealth_pareto_estimate:s.metric==='pareto_wealth_ratio'?wealth.estimate:null,threshold_quantile:isParetoMetric(s.metric)?fit.q:null,ks:isParetoMetric(s.metric)?fit.maxks:null,n_tail:isParetoMetric(s.metric)?fit.n_tail:null,tail_unit_type:tailUnit(survey)});});
      });
    });
    datasets.push(...(referenceController?.datasets(s)||[]));
    if(phoneLayout.matches){
      for(const dataset of datasets)if(typeof dataset.pointRadius==='number')dataset.pointRadius=Math.max(2.5,dataset.pointRadius*.72);
    }
    (referenceController?.plotted(s)||[]).forEach(row=>timeRows.push({survey:row.survey,wave:row.year,observation_year:SeriesYears.period(row).year,observation_period:SeriesYears.period(row).label,year_basis:SeriesYears.period(row).basis,adjustment:'Standalone reference: '+row.author_variant,variable:row.variable,variable_label:row.source_label,indicator:s.metric,method:row.method,threshold:row.threshold_rule,estimate:row.estimate,pareto_estimate:isParetoMetric(s.metric)?row.pareto_estimate??row.estimate:null,wealth_pareto_estimate:row.wealth_pareto_estimate??null,threshold_quantile:row.threshold_quantile,ks:row.ks,n_tail:row.n_tail??null,tail_unit_type:row.unit||META.surveys?.[row.survey]?.tail_unit||'',author_variant:row.author_variant,capital_income_definition:row.capital_income_definition||'',source_definition:row.source_definition}));
    datasets.forEach(dataset=>{if(dataset.isReference)dataset.data=dataset.data.map(point=>{const period=SeriesYears.period({survey:dataset.survey,variable:dataset.variable,year:point.x});return{...point,x:period.year,wave:period.wave,period_label:period.detail};});});
    const availableYears = datasets.flatMap(dataset => dataset.data.filter(point => FINITE(point.y)).map(point => point.x));
    const visibleYears = timeWindow.update(availableYears);
    if (visibleYears) {
      const inWindow = year => year >= visibleYears.from && year <= visibleYears.to;
      for (const dataset of datasets) dataset.data = dataset.data.filter(point => inWindow(point.x));
      datasets = datasets.filter(dataset => dataset.data.some(point => FINITE(point.y)));
      timeRows = timeRows.filter(row => inWindow(row.observation_year));
    }
    $('time-chart-title').textContent=metricLabel()+' over time';
    const yTitle=({pareto:'Pareto tail coefficient (ζ)',pareto_wealth_ratio:'Relative to wealth (ζₓ / ζₐ)',gini:'Gini coefficient'})[s.metric]||metricLabel();
    const shownHouseholds=new Set(datasets.map(dataset=>dataset.survey).filter(survey=>['PSID','CEX_BM_RECON','SCF'].includes(survey))),adjustmentLabels=[];
    if(s.adjustment==='full'){
      if(shownHouseholds.has('PSID'))adjustmentLabels.push('PSID is rescaled to national accounts and uses '+({scf_income:'SCF income weights',irs_income:'IRS income weights',scf_wealth:'SCF wealth weights'})[weighting.method]+'.');
      if(shownHouseholds.has('CEX_BM_RECON'))adjustmentLabels.push('CEX is rescaled to national accounts and uses SCF housing weights.');
      if(shownHouseholds.has('SCF'))adjustmentLabels.push('SCF is rescaled to national accounts only.');
    }else if(shownHouseholds.size){
      const names=['PSID','CEX_BM_RECON','SCF'].filter(survey=>shownHouseholds.has(survey)).map(survey=>surveyName(survey)).join(', ');
      adjustmentLabels.push(names+': '+(s.adjustment==='adj'?'rescaled to national accounts only.':'raw data.'));
    }
    const subtitle=$('time-chart-subtitle'),estimatorLabel=isParetoMetric(s.metric)?s.method+' · '+thresholdName():'';
    subtitle.replaceChildren();
    if(estimatorLabel){
      const estimator=document.createElement('span');
      estimator.className='subtitle-estimator';
      estimator.textContent=estimatorLabel;
      if(s.threshold==='ks')appendParetoEstimationLink(estimator);
      if(s.metric==='pareto_wealth_ratio')estimator.append(' · each series divided by wealth');
      subtitle.append(estimator);
    }
    const phone=phoneLayout.matches,notesPanel=$('time-note').parentElement,actions=$('download-time-csv')?.closest('.chart-actions');
    notesPanel.querySelector('.time-adjustment-summary')?.remove();
    if(adjustmentLabels.length){
      const detail=document.createElement('span');
      detail.className='time-adjustment-summary';
      detail.textContent=adjustmentLabels.join(' ');
      const link=document.createElement('a');
      link.className='subtitle-tab-link';
      link.href='#panel-adjustments';
      link.textContent='Survey Adjustments';
      link.addEventListener('click',event=>{event.preventDefault();tab('adjustments');});
      detail.append(' (see ',link,' for details)');
      if(phone)notesPanel.prepend(detail);
      else subtitle.append(detail);
    }
    if(actions){
      const target=phone?timeWindow.element:subtitle.closest('.plot-top,.chart-heading-row');
      if(target&&phone&&target.nextElementSibling!==actions)target.after(actions);
      if(target&&!phone&&actions.parentElement!==target)target.append(actions);
    }
    $('time-empty').hidden=!!datasets.length;$('time-empty').textContent=visibleYears?'No estimates in the selected time window.':s.variables.size?'No comparable results for this selection.':'Select at least one measure.';
    $('download-time-csv').disabled=!timeRows.length;$('download-time-png').disabled=!datasets.length;
    $('time-variant').value=bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM')?'original':s.adjustment;syncMainCapabilities();
    const notes=[];
    if(housing.method==='bp')notes.push('Homeowner services use the constant housing-value-rate version. Only computed or verified equivalent housing definitions are shown.');
    if(s.adjustment==='full'&&shownHouseholds.has('PSID')&&weighting.method==='irs_income')notes.push('PSID fully adjusted results use IRS income weights.');
    if(s.adjustment==='full'&&shownHouseholds.has('PSID')&&weighting.method==='scf_wealth')notes.push('PSID fully adjusted results use SCF wealth weights.');
    if(isParetoMetric(s.metric)&&s.threshold==='ks')notes.push('Each coefficient uses its own KS-selected threshold.');
    if(s.metric==='pareto_wealth_ratio')notes.push('Each value divides the selected variable’s Pareto coefficient by the wealth coefficient from the same survey, wave and adjustment stage; wealth equals 1.');
    if(s.variables.has('spending')&&selected.has('SCF')){const rows=SUMMARY.filter(row=>row.survey==='SCF'&&row.variable===spendingKey(s.measure)&&row.variant===variantFor('SCF'));if(!rows.some(row=>FINITE(metricValue(row))))notes.push('Consumption is unavailable in SCF for this adjustment.');}
    if(selected.has('PSID'))notes.push('PSID construction involves extensive cleaning and selected imputations, including for capital income. Other surveys are processed as comparably as their source coverage permits, but the available detail differs: CEX shows consumption and partial wealth by default, SCF provides little consumption detail, and PSID offers relatively broad and detailed coverage of consumption, labor income, capital income, and wealth—the four displayed components of the household budget constraint.');
    if(s.cexIncome&&selected.has('CEX_BM_RECON'))notes.push('CEX income components are topcoded, severely biasing upper-tail estimates.');
    if(selected.has('SAEZ_ZUCMAN'))notes.push('DINA covers synthetic adults aged 20+ in 1970–2019. Capital and total income include fiscal capital gains.');
    notes.push('Dates follow each series’ reference period or wealth valuation year; survey waves are identified in tooltips.');
    $('time-chart').dataset.observationYears=JSON.stringify(datasets.map(dataset=>({survey:dataset.survey,variable:dataset.variable,points:dataset.data.filter(point=>FINITE(point.y)).map(point=>({wave:point.wave,year:point.x}))})));
    const displayedSurveys=new Set(datasets.map(dataset=>dataset.survey));$('time-note').textContent=notes.join(' ');$('time-chart').setAttribute('aria-label',yTitle+' over time in '+[...displayedSurveys].join(' and '));
    const legend=$('time-survey-key');if(legend){legend.replaceChildren();[...displayedSurveys].forEach(survey=>{const item=document.createElement('span'),mark=document.createElement('i'),name=document.createElement('span'),help=document.createElement('span'),description=surveyTooltip(survey);item.className='plot-legend-item';item.setAttribute('aria-label',surveyName(survey)+'. '+description);mark.className='survey-symbol survey-symbol-'+survey.toLowerCase();mark.setAttribute('aria-hidden','true');name.textContent=surveyName(survey);help.className='help-marker hover-help';help.textContent='?';help.tabIndex=0;help.dataset.tooltip=description;help.setAttribute('aria-label','About '+surveyName(survey));item.append(mark,name,help);legend.append(item);});}
    if(!datasets.length){announce('No comparable series selected.');return;}
    const {from, to} = visibleYears;
    const shownYears = [...new Set([from, ...availableYears.filter(year => year >= from && year <= to), to])].sort((a,b) => a-b);
    const xmin = from - .6, xmax = to + .6;
    const firstYear=shownYears[0],lastYear=shownYears[shownYears.length-1];
    const yearTicks=shownYears.length>14?shownYears.filter(year=>year===firstYear||year===lastYear||(year%5===0&&year-firstYear>=3&&lastYear-year>=2)):shownYears;
    const legendTopPadding=()=>legend?Math.max(52,legend.offsetHeight+18):12;
    timeChart=new Chart($('time-chart'),{type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'nearest',intersect:false},layout:{padding:{top:legendTopPadding(),right:14,bottom:5,left:8}},onResize:chart=>{chart.options.layout.padding.top=legendTopPadding();},plugins:{legend:{display:false},tooltip:{backgroundColor:'#182437',padding:12,callbacks:{title:items=>items.length?items[0].dataset.survey+' · '+(items[0].raw.period_label||items[0].raw.x):'',label:ctx=>(ctx.dataset.isReference?ctx.dataset.label:displayLabel(ctx.dataset.key,s.measure,ctx.dataset.survey))+': '+format(ctx.parsed.y),afterLabel:ctx=>isParetoMetric(s.metric)?[FINITE(ctx.raw.q)?'Threshold: '+num(ctx.raw.q*100,1)+'th percentile':'',FINITE(ctx.raw.maxks)?'KS: '+num(ctx.raw.maxks,4):''].filter(Boolean):''}}},scales:{x:{type:'linear',min:xmin,max:xmax,title:{display:true,text:'Reference year',font:{size:13}},afterBuildTicks:axis=>{
      const count=axis.chart.width<500?Math.min(6,yearTicks.length):yearTicks.length;
      const years=count<yearTicks.length?Array.from({length:count},(_,index)=>yearTicks[Math.round(index*(yearTicks.length-1)/(count-1))]):yearTicks;
      axis.ticks=years.map(value=>({value}));
    },grid:{display:false},border:{color:'#d9dce2'},ticks:{maxRotation:0,font:{size:13},callback:value=>Number.isInteger(value)?String(value):''}},y:{title:{display:true,text:yTitle,font:{size:13}},grid:{color:'#e9e9ee'},border:{display:false},ticks:{padding:9,font:{size:13},callback:value=>format(value)}}}}});
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
    const ks=String(row.threshold_rule).toLowerCase()==='ks',key=[row.survey,row.housing_method||'benchmark',weightingMethod(row),row.variant,row.variable,row.method,String(row.threshold_rule).toLowerCase(),ks?'':row.threshold_quantile].join('|');
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
  const resultsTotalIncomeHelp=createUSTotalIncomeHelp();
  const resultsMeasureLabel=$('results-variable').previousElementSibling;
  const resultsMeasureTitle=document.createElement('span');
  resultsMeasureTitle.className='us-total-income-choice';
  resultsMeasureLabel.replaceWith(resultsMeasureTitle);
  resultsMeasureTitle.append(resultsMeasureLabel,resultsTotalIncomeHelp);
  function fillResultsVariables(){
    const selected=resultsSurveys(),native=referencePoints().filter(row=>selected.has(row.survey)),household=SUMMARY.filter(row=>selected.has(row.survey)),variables=[...new Set([...household,...native].map(row=>row.variable))].filter(variable=>!hiddenSpending.has(variable)).sort((a,b)=>variableDisplayLabel(a,r.survey.toUpperCase()).localeCompare(variableDisplayLabel(b,r.survey.toUpperCase()))),select=$('results-variable');select.replaceChildren();
    const supported=variable=>household.some(row=>row.variable===variable&&row.variant===variantFor(row.survey,r.adjustment))||native.some(row=>row.variable===variable&&(row.survey!=='YODLEE'||r.yodleeVariant==='all'||row.author_variant===r.yodleeVariant));
    [['all','All available measures'],...variables.map(variable=>[variable,variableDisplayLabel(variable,r.survey.toUpperCase())])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;option.disabled=value!=='all'&&!supported(value);select.append(option);});
    if(r.variable!=='all'&&(!variables.includes(r.variable)||!supported(r.variable)))r.variable='all';select.value=r.variable;
    resultsTotalIncomeHelp.hidden=r.variable!=='total_income';
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
    const custom=$('results-custom-threshold'),spec=customThresholdSpec(r);custom.max=String(spec.maximum);custom.step=String(spec.step);if(r.threshold==='custom'&&100*r.customQ>Number(custom.max))r.customQ=Number(custom.max)/100;custom.value=String(100*r.customQ);$('results-method').value=r.method;$('results-threshold').value=r.threshold;$('results-custom-threshold-control').hidden=r.threshold!=='custom';
  }
  function selectedResultRows(){
    const selected=resultsSurveys(),annual=SUMMARY.filter(row=>selected.has(row.survey)&&row.variant===variantFor(row.survey,r.adjustment)&&(r.variable==='all'||row.variable===r.variable)).map(row=>({...makeAnnualResult(row,r.method,r.threshold,r.customQ),source_housing_method:housingMethod(row),housing_method:housing.method}));
    resultsReferenceRows().forEach(point=>{const row={...point,country:'US',housing_method:'not_applicable',source_housing_method:'not_applicable',weighting_method:point.survey==='YODLEE'?'source_scf_income':'not_applicable',year:point.year,period_type:'wave',period_label:String(point.year),variant:point.author_variant,source_variant:point.author_variant,adjustment_label:point.survey==='YODLEE'?(YODLEE_VARIANTS[point.author_variant]||point.author_variant):point.survey==='SAEZ_ZUCMAN'?'DINA reference':'Standalone reference',variable_label:variableDisplayLabel(point.variable,point.survey),pareto_estimate:point.estimate,max_ks:point.ks,wealth_pareto_estimate:point.wealth_pareto_estimate??null,ratio_numerator_mean:point.estimate,tail_to_wealth:point.tail_to_wealth??null,tail_unit_type:point.unit||META.surveys?.[point.survey]?.tail_unit||'',n_tail:point.n_tail??null,n_obs:point.n_obs??null,n_waves:1,n_waves_total:1,n_waves_pareto:FINITE(point.estimate)?1:0,n_waves_ratio:FINITE(point.tail_to_wealth)?1:0};INEQUALITY_METRICS.forEach(field=>{row[field]=FINITE(point[field])?point[field]:null;row['n_waves_'+field]=FINITE(row[field])?1:0;});annual.push(row);});
    annual.sort((a,b)=>a.survey.localeCompare(b.survey)||a.year-b.year||a.variable.localeCompare(b.variable)||a.variant.localeCompare(b.variant));const map=new Map();annual.forEach(row=>accumulateAverage(map,row));return [...averageResults(map),...annual];
  }
  let resultsSignature='';
  function renderResults() {

    syncResultsControls();syncDinaControls();
    const signature=[housing.method,weighting.method,dina.capitalDefinition,[...r.datasets].sort().join(','),r.variable,r.adjustment,r.yodleeVariant,r.method,r.threshold,r.customQ].join('|');if(signature!==resultsSignature){resultPage=0;resultsSignature=signature;}
    syncTailControls();resultRows=selectedResultRows();const pageSize=50,pages=Math.max(1,Math.ceil(resultRows.length/pageSize));resultPage=Math.max(0,Math.min(resultPage,pages-1));
    const selected=resultsSurveys(),adjustmentText=(bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM')?'Original B&M construction':ADJ[r.adjustment])+(selected.has('SCF')&&r.adjustment!=='raw'?' (SCF: rescaled, original weights)':'');
    const table=$('results-table');table.replaceChildren();const head=document.createElement('thead'),header=document.createElement('tr');
    ['Dataset','Wave / source period','Adjustment','Measure','Method','Waves','Tail waves','Ratio waves','Cutoff','Pareto tail','KS','Tail / wealth','Gini','Top 20%','Top 10%','Top 5%','Top 1%','Tail units','Records'].forEach(text=>{const th=document.createElement('th');th.scope='col';th.textContent=text;header.append(th);});head.append(header);table.append(head);
    const body=document.createElement('tbody'),shown=resultRows.slice(resultPage*pageSize,(resultPage+1)*pageSize);
    shown.forEach(row=>{
      const tr=document.createElement('tr');if(row.period_type==='average')tr.className='results-average-row';
      const cells=[surveyName(row.survey),row.period_label,row.adjustment_label||adjustmentLabel(row),row.variable_label,row.method,num(row.n_waves,0),num(row.n_waves_pareto,0),num(row.n_waves_ratio,0),(String(row.threshold_rule).toLowerCase()==='ks'?'KS · ':'')+pct(row.threshold_quantile),num(row.pareto_estimate,3),num(row.max_ks,4),num(row.tail_to_wealth,3)];
      cells.forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});
      INEQUALITY_METRICS.forEach(field=>{const td=document.createElement('td'),count=row['n_waves_'+field]||0;td.textContent=field==='gini'?num(row[field],3):pct(row[field]);if(!FINITE(row[field]))td.className='unavailable-value';if(row.period_type==='average'){td.title='Mean of '+count+' available annual estimates out of '+row.n_waves+' waves.';if(count>0&&count<row.n_waves)td.textContent+=' ['+count+'/'+row.n_waves+']';}tr.append(td);});
      [row.n_tail,row.n_obs].forEach(value=>{const td=document.createElement('td');td.textContent=(row.period_type==='average'&&FINITE(value)?'Avg. ':'')+num(value,row.period_type==='average'?1:0);if(row.tail_unit_type)td.title=row.tail_unit_type;tr.append(td);});body.append(tr);
    });table.append(body);
    $('results-empty').hidden=!!resultRows.length;$('results-count').textContent=resultRows.length?'Rows '+(resultPage*pageSize+1)+'–'+Math.min((resultPage+1)*pageSize,resultRows.length)+' of '+resultRows.length:'No rows for these filters.';
    $('results-page').textContent='Page '+(resultPage+1)+' of '+pages;$('results-prev').disabled=resultPage===0;$('results-next').disabled=resultPage>=pages-1;$('download-results-selected').disabled=!resultRows.length;
    $('results-note').textContent=(selected.has('SAEZ_ZUCMAN')?'DINA counts refer to synthetic adult rows, not population totals. ':'')+(selected.has('CEX')?'CEX wealth is partial. '+cexCountsNote:'')+(selected.has('CEX_BM')?' '+(META.cex_bm_display?.counts||META.cex_bm_display?.note||META.surveys?.CEX_BM?.definition||'Original B&M sample, equivalized definition and weights; the PSID adjustment selector does not alter this author construction.'):'')+(selected.has('CEX_BM_RECON')?' '+(META.cex_bm_recon_display?.note||META.surveys?.CEX_BM_RECON?.definition||'Public CEX reconstruction shown separately from the authors’ reference series.'):'');
  }
  async function downloadAllResults() {
    if(allResultsBusy)return;allResultsBusy=true;$('download-results-all').disabled=true;$('all-results-status').textContent='Preparing aggregate results…';
    try{
      await ensureFullCurves([...VISIBLE_US_SURVEYS,...(META.reference_curve_surveys||[])]);
      const fields=['survey','housing_method','source_housing_method','weighting_method','country','period_type','period_label','year','variant','source_variant','variable','variable_label','wealth_denominator_label','method','threshold_rule','threshold_quantile','pareto_estimate','max_ks','tail_to_wealth','wealth_pareto_estimate','ratio_numerator_mean','n_waves','n_waves_total','n_waves_pareto','n_waves_ratio','n_waves_gini','n_waves_share_top20','n_waves_share_top10','n_waves_share_top5','n_waves_share_top1','years_available','years_pareto','years_ratio','n_tail','tail_unit_type','n_obs','record_aggregation','gini','share_top20','share_top10','share_top5','share_top1','author_variant','capital_income_definition','source_label','source_definition','provenance'],escape=value=>value===null||value===undefined?'':'"'+String(value).replace(/"/g,'""')+'"',lines=[fields.join(',')],annualLines=[],averages=new Map();
      const serialize=row=>fields.map(field=>escape(row[field])).join(',');
      const appendAnnual=row=>{annualLines.push(serialize(row));accumulateAverage(averages,row);};let groups=0;
      for(const curve of ALL_CURVES.filter(curve=>VISIBLE_US_SURVEYS.has(curve.survey))){
        const row=summaryIndex.get(curveKey(curve))||curve;
        for(const method of ['MLE','OLS']){appendAnnual(makeAnnualResult(row,method,'ks',s.customQ));curve.qs.forEach(q=>{const shortcut=({800:'p80',900:'p90',950:'p95',980:'p98'})[Math.round(q*1000)],result=makeAnnualResult(row,method,shortcut||'custom',q);result.threshold_rule='fixed';appendAnnual(result);});}
        groups++;if(groups%20===0){$('all-results-status').textContent='Preparing '+num(annualLines.length,0)+' aggregate rows…';await new Promise(resolve=>setTimeout(resolve,0));}
      }
      ALL_SUMMARY.filter(row=>VISIBLE_US_SURVEYS.has(row.survey)&&!curveIndex.has(curveKey(row))).forEach(row=>appendAnnual(makeAnnualResult(row,'','Unavailable',null)));
      (referenceController?.allResults()||[]).forEach(row=>appendAnnual({...row,country:'US',period_type:'wave',period_label:String(row.year),variant:row.author_variant,variable_label:row.source_label,pareto_estimate:row.estimate,max_ks:row.ks,wealth_pareto_estimate:row.wealth_pareto_estimate??null,tail_to_wealth:row.tail_to_wealth??null,n_waves:1,n_waves_total:1,n_waves_pareto:1,n_waves_ratio:FINITE(row.tail_to_wealth)?1:0,tail_unit_type:row.unit||META.surveys?.[row.survey]?.tail_unit||(row.survey==='FORBES'?'listed people or family entries':row.survey==='YODLEE'?'bank–individual accounts':'households'),record_aggregation:row.survey==='FORBES'?'distinct listed person/family fortunes; World list plus Forbes 400':'author-defined annual reference point'}));
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
  const matchesCapitalIncomeDefinition=row=>(row.capital_income_definition||'benchmark')===(row.survey==='SAEZ_ZUCMAN'?dina.capitalDefinition:capitalIncomeDefinition());
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
    [['PSID','wave','wave-select'],['SCF','scfWave','scf-wave-select'],['CEX','cexWave','cex-wave-select'],['CEX_BM_RECON','reconWave','recon-wave-select'],['CEX_BM','bmWave','bm-wave-select'],['SAEZ_ZUCMAN','dinaWave','dina-wave-select']].forEach(([survey,field,id])=>{
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
    const specs=[{survey:'PSID',color:'#b34470',point:'circle'},{survey:'SCF',color:'#2c5c88',point:'rectRot'},{survey:'SAEZ_ZUCMAN',color:'#a06d33',point:'rect'},{survey:'CEX_BM_RECON',color:'#7b8154',point:'triangle'},{survey:'CEX',color:hasCorrectedCEXBins?'#8b6388':'#7b8154',point:hasCorrectedCEXBins?'crossRot':'triangle'},{survey:'CEX_BM',color:'#8b6388',point:'crossRot'}];
    specs.filter(spec=>selectedSurveys(b).has(spec.survey)&&(spec.survey!=='SAEZ_ZUCMAN'||['wealth_capital','income_capital'].includes(b.pair))).forEach(spec=>{
      const measure=pair.y==='spending'?b.measure:'expenditure';
      let rows=BINS.filter(r=>matchesBinMinimum(r)&&r.survey===spec.survey&&r.variant===bivariateVariantFor(spec.survey)&&(pair.y==='spending'||r.measure==='expenditure')&&r.xvar===pair.x&&r.yvar===ykey);
      const values=[...new Set(rows.map(r=>r.year).filter(FINITE))].sort((a,c)=>a-c),chosenWave=spec.survey==='SAEZ_ZUCMAN'?b.dinaWave:spec.survey==='PSID'?b.wave:spec.survey==='SCF'?b.scfWave:spec.survey==='CEX_BM'?b.bmWave:spec.survey==='CEX_BM_RECON'?b.reconWave:b.cexWave;
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
      points.forEach(p=>binRows.push({survey:spec.survey,housing_method:spec.survey==='SAEZ_ZUCMAN'?'not_applicable':housing.method,source_housing_method:spec.survey==='SAEZ_ZUCMAN'?'not_applicable':housingSource(spec.survey),weighting_method:weightingMethod(rows[0]||{}),capital_income_definition:spec.survey==='SAEZ_ZUCMAN'?dina.capitalDefinition:capitalIncomeDefinition(),wave:chosenWave,n_waves:p.waves,years_used:p.years_used,n_imputations:p.n_imputations,adjustment:bivariateVariantFor(spec.survey),source_variant:bivariateVariantFor(spec.survey),measure,xvar:pair.x,yvar:ykey,x_label:displayLabel(pair.x,b.measure,spec.survey),y_label:displayLabel(pair.y,b.measure,spec.survey),statistic:b.stat,axis_scale:b.scale,fit_method:b.fit,bin_min_n:b.minN,q_lo:p.q_lo,q_hi:p.q_hi,x:p.x,y:p.y,min_tail_units:p.n_obs,tail_unit_type:tailUnit(spec.survey),ols_intercept:ols?.intercept??null,ols_slope:ols?.slope??null,ols_r_squared:ols?.r2??null,nls_scale:nls?.intercept??null,nls_exponent:nls?.slope??null,nls_r_squared:nls?.r2??null}));
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
    $('biv-chart-subtitle').textContent='Normalized weighted '+(b.stat==='mean'?'means':'medians')+' · '+(useLog?'log–log':'level')+' axes'+(b.adjustment==='full'&&selectedSurveys(b).has('PSID')?' · '+(selectedSurveys(b).has('CEX_BM_RECON')?'PSID: ':'')+({scf_income:'SCF income weights',irs_income:'IRS income weights',scf_wealth:'SCF wealth weights'})[weighting.method]:'')+(b.adjustment==='full'&&selectedSurveys(b).has('CEX_BM_RECON')?' · CEX: SCF housing values':'')+(housing.method==='bp'?' · Constant imputed rent rate':'');
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
    const notes=[...unavailable],selected=selectedSurveys(b);syncDinaControls();
    $('dina-wave-select').closest('.control').hidden=!selected.has('SAEZ_ZUCMAN')||!['wealth_capital','income_capital'].includes(b.pair);$('dina-wave-select').disabled=!selected.has('SAEZ_ZUCMAN');
    let dinaNote=$('biv-dina-note');if(!dinaNote){dinaNote=document.createElement('p');dinaNote.id='biv-dina-note';dinaNote.className='biv-source-note';$('biv-omissions').after(dinaNote);}dinaNote.replaceChildren();dinaNote.hidden=!selected.has('SAEZ_ZUCMAN')||!['wealth_capital','income_capital'].includes(b.pair);if(!dinaNote.hidden){dinaNote.append('DINA covers adults aged 20+. ');if(b.pair==='wealth_capital'){dinaNote.append('Saez–Zucman estimates part of wealth by capitalizing investment income, so a tight wealth–capital-income fit partly reflects how the data are constructed. ');const a=document.createElement('a');a.href='https://doi.org/10.1093/qje/qjw004';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Source';dinaNote.append(a);}else if(b.pair==='income_capital')dinaNote.append('Total income is personal pre-tax income. The gains-inclusive definition adds fiscal gains to both total and capital income.');}
    const intervals=[...selected].filter(survey=>survey!=='SAEZ_ZUCMAN'||['wealth_capital','income_capital'].includes(b.pair)).map(survey=>surveyName(survey)+' '+num(100*(META.relationship_bin_intervals?.[survey]??.001),1)).join('; ');
    if($('biv-bin-note'))$('biv-bin-note').textContent='Weighted bin statistics in the top 20%.'+([...selected].some(survey=>survey!=='SAEZ_ZUCMAN')?' Survey samples use ages 20–80 with positive food spending.':'')+' Base intervals, in percentile points: '+intervals+'. '+(b.minN===0?'No minimum observation count or merging.':'Adjacent intervals are merged to retain at least '+b.minN+' '+(selected.size===1&&[...selected].some(isCEX)?tailUnit([...selected][0]):'observations')+' in every relevant wave/adjustment cell.'+(selected.has('SCF')?' The SCF minimum applies within each imputation.':''));
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
    bivChart=new Chart($('biv-chart'),{type:'scatter',data:{datasets},plugins:[equalityLineLabel],options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:12,right:14,left:5,bottom:0}},plugins:{onlineYAxisTitles:false,legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:9,font:{size:13},padding:17,filter:item=>!datasets[item.datasetIndex].isTrace&&!datasets[item.datasetIndex].isFit}},tooltip:{backgroundColor:'#182437',padding:11,filter:item=>!!item.dataset.isMain,callbacks:{title:items=>items.length?items[0].dataset.label:'',label:ctx=>[displayLabel(pair.x,b.measure,ctx.dataset.survey)+' / mean: '+num(ctx.parsed.x,3),displayLabel(pair.y,b.measure,ctx.dataset.survey)+' / mean: '+num(ctx.parsed.y,3)],afterLabel:ctx=>num(100*ctx.raw.q_lo,1)+'–'+num(100*ctx.raw.q_hi,1)+' percentile · min. '+num(ctx.raw.n_obs,0)+(' '+tailUnit(ctx.dataset.survey))}}},scales:{x:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},border:{color:'#d9dce2'},title:{display:true,text:lx+' / sample mean',font:{size:13}},ticks:{callback:useLog?logTick:value=>num(value,1),autoSkip:!useLog,font:{size:13},maxRotation:0}},y:{type:useLog?'logarithmic':'linear',grid:{color:'#ececf0'},border:{display:false},title:{display:true,text:ly+' / sample mean',font:{size:13}},ticks:{callback:useLog?logTick:value=>num(value,1),autoSkip:!useLog,font:{size:13}}}}}});
    requestAnimationFrame(()=>bivChart?.resize());
    announce(fits.map(f=>f.name+' slope '+num(f.slope,3)).join('; '));
  }

  const setRadioValue=(name,value)=>document.querySelectorAll('input[name="'+name+'"]').forEach(input=>input.checked=input.value===value);
  function syncMainCapabilities(){
    if(s.measure!=='food_total')s.overlays.delete('nielsen');
    const selected=selectedSurveys(s),hasHousehold=[...selected].some(survey=>HOUSEHOLD_SURVEYS.has(survey)),hasAdjustable=[...selected].some(survey=>ADJUSTABLE_SURVEYS.has(survey)),hasConsumption=hasHousehold||selected.has('YODLEE')||selected.has('NIELSEN'),onlySCF=selected.size===1&&selected.has('SCF');
    const hasMetricReference=[...selected].some(survey=>referenceController?.supportsMetric(survey,s.metric)),hasShareReference=[...selected].some(survey=>referenceController?.supportsMetric(survey,'share_top10')),hasGiniReference=[...selected].some(survey=>referenceController?.supportsMetric(survey,'gini'));
    if(!hasHousehold&&!hasMetricReference&&!isParetoMetric(s.metric)){s.metric='pareto';s.paretoMetric='pareto';}
    const hasWealthReference=[...selected].some(survey=>referenceController?.supportsMetric(survey,'pareto_wealth_ratio')),hasHouseholdWealth=[...selected].some(survey=>HOUSEHOLD_SURVEYS.has(survey)&&ALL_SUMMARY.some(row=>row.survey===survey&&row.variable==='networth_val'));
    if(!hasHouseholdWealth&&!hasWealthReference&&s.metric==='pareto_wealth_ratio'){s.metric='pareto';s.paretoMetric='pareto';}
    if(!onlySCF&&s.customQ>.99)s.customQ=.99;
    $('indicator-select').value=s.metric;$('estimator-select').value=s.method;$('threshold-select').value=s.threshold;
    const kind=indicatorKind(s.metric);setRadioValue('indicator-kind',kind);setRadioValue('pareto-measure',s.paretoMetric);setRadioValue('pareto-estimator',s.method);setRadioValue('tail-threshold',s.threshold);setRadioValue('top-share-cutoff',s.shareMetric);
    $('pareto-options').hidden=kind!=='pareto';$('top-share-options').hidden=kind!=='shares';$('gini-options').hidden=kind!=='gini';
    document.querySelectorAll('input[name="indicator-kind"]').forEach(input=>{const unavailable=!hasHousehold&&(input.value==='shares'?!hasShareReference:input.value==='gini'?!hasGiniReference:false);input.disabled=unavailable;input.closest('label')?.classList.toggle('unavailable-option',unavailable);input.closest('label').title=unavailable?'Top shares and Gini coefficients are unavailable for standalone reference datasets.':'';});
    document.querySelectorAll('input[name="pareto-measure"]').forEach(input=>{const unavailable=input.value==='pareto_wealth_ratio'&&!hasHouseholdWealth&&!hasWealthReference;input.disabled=unavailable;input.closest('label')?.classList.toggle('unavailable-option',unavailable);});
    const ols=document.querySelector('input[name="pareto-estimator"][value="OLS"]');if(ols){ols.disabled=false;ols.closest('label')?.classList.remove('unavailable-option');ols.closest('label').title='Datasets without a stored OLS estimate for the selected threshold are omitted automatically.';}
    const p99=document.querySelector('input[name="tail-threshold"][value="p99"]');if(p99){p99.disabled=false;p99.closest('label')?.classList.remove('unavailable-option');p99.closest('label').title='Dataset–series combinations without a stored P99 estimate are omitted automatically.';}
    document.querySelectorAll('input[name="tail-threshold"]').forEach(input=>{input.disabled=!hasHousehold&&input.value!=='custom'&&![...selected].some(survey=>referenceController?.hasThreshold(survey,s.method,input.value,s.customQ));input.closest('label')?.classList.toggle('unavailable-option',input.disabled);});
    if(document.querySelector('input[name="tail-threshold"]:checked')?.disabled){s.threshold='ks';$('threshold-select').value=s.threshold;setRadioValue('tail-threshold',s.threshold);}
    const custom=$('custom-threshold'),spec=customThresholdSpec(s);custom.max=String(spec.maximum);custom.step=String(spec.step);custom.value=String(Math.round(10000*s.customQ)/100);
    $('custom-threshold-control').hidden=kind!=='pareto'||s.threshold!=='custom';$('custom-threshold-note').textContent=s.threshold==='custom'?(spec.onlyDina?'DINA supports P70–P98.5 in 0.25-point steps.':onlySCF?'SCF supports stored thresholds through P99.9.':'Above P99 is available only for SCF. Estimates near P99 are less precise for PSID and CEX.') : '';
    const adjustmentUnavailable=!hasAdjustable;$('time-variant').disabled=adjustmentUnavailable||(bmOriginalOnly&&selected.size===1&&selected.has('CEX_BM'));document.querySelector('.adjustment-block')?.classList.toggle('adjustment-unavailable',adjustmentUnavailable);$('measure-select').disabled=!hasConsumption;$('measure-select').closest('.control')?.classList.toggle('unavailable-option',!hasConsumption);
    syncWeightingControls();
  }
  function syncTailControls() {
    syncMainCapabilities();
    $('results-survey').value=r.survey;$('results-variable').value=r.variable;
    $('results-method').value=r.method;$('results-threshold').value=r.threshold;$('results-custom-threshold-control').hidden=r.threshold!=='custom';
  }
  function customThresholdSpec(state){const selected=state===r?resultsSurveys():selectedSurveys(state),hasDina=selected.has('SAEZ_ZUCMAN'),onlyDina=hasDina&&selected.size===1;return {hasDina,onlyDina,maximum:onlyDina?98.5:selected.size===1&&selected.has('FORBES')?90:selected.size===1&&selected.has('SCF')?99.9:99,step:onlyDina?.25:hasDina?.05:.1};}
  function applyCustom(value,noteId,state=s) {
    const percentile=Number(value),spec=customThresholdSpec(state),onGrid=n=>Math.abs(n-Math.round(n))<1e-7,validStep=spec.onlyDina?onGrid(percentile*4):onGrid(percentile*10)||(spec.hasDina&&onGrid(percentile*4));if(!Number.isFinite(percentile)||percentile<70||percentile>spec.maximum||!validStep){$(noteId).textContent='Choose a stored percentile from 70 to '+spec.maximum+(spec.onlyDina?' in 0.25-point steps.':'.');return false;}
    state.customQ=percentile/100;$(noteId).textContent='';syncTailControls();return true;
  }
  function bind(id,fn) { $(id).addEventListener('change',event=>{fn(event.target.value);schedule();}); }
  bind('survey-select',value=>{s.primary=value;s.primaryEnabled=true;s.overlays.delete(value);if(value==='cex_bm'){s.measure='flow';s.variables.add('spending');}syncHousingAvailability();syncMainCapabilities();fillOverlays('overlay-controls',s,mainOverlayChoices());fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSeries();});
  const applyMainMetric=value=>{s.metric=value;if(isParetoMetric(value))s.paretoMetric=value;if(value.startsWith('share_'))s.shareMetric=value;if(value==='pareto_wealth_ratio')[...s.overlays].filter(survey=>!surveyChoices().includes(survey)&&!referenceController?.supportsMetric(survey.toUpperCase(),value)).forEach(survey=>s.overlays.delete(survey));syncMainCapabilities();fillOverlays('overlay-controls',s,mainOverlayChoices());fillSeries();};
  bind('indicator-select',applyMainMetric);bind('time-variant',value=>{s.adjustment=value;applySpecificationSelection(false);});bind('threshold-select',value=>{s.threshold=value;syncTailControls();});
  bind('estimator-select',value=>{s.method=value;syncTailControls();});bind('results-method',value=>{r.method=value;syncTailControls();});bind('results-threshold',value=>{r.threshold=value;syncTailControls();});
  bind('results-survey',value=>{r.survey=value;r.datasets=value==='all'?new Set([...VISIBLE_US_SURVEYS,...referencePoints().map(row=>row.survey)]):new Set([value.toUpperCase()]);fillResultsDatasets();syncHousingAvailability();fillResultsVariables();});bind('results-variable',value=>r.variable=value);bind('results-adjustment',value=>{if(![...r.datasets].some(survey=>VISIBLE_US_SURVEYS.has(survey))&&r.datasets.has('YODLEE'))r.yodleeVariant=value;else r.adjustment=value;});bind('results-yodlee-adjustment',value=>r.yodleeVariant=value);
  $('custom-threshold').addEventListener('input',event=>{if(applyCustom(event.target.value,'custom-threshold-note'))schedule();});
  $('results-custom-threshold').addEventListener('input',event=>{if(applyCustom(event.target.value,'results-custom-threshold-note',r))schedule();});
  $('custom-threshold').addEventListener('change',event=>{if(applyCustom(event.target.value,'custom-threshold-note')){const value=100*s.customQ;event.target.value=String(Math.round(value*100)/100);schedule();}});
  $('results-custom-threshold').addEventListener('change',event=>{if(applyCustom(event.target.value,'results-custom-threshold-note',r)){event.target.value=String(Math.round(10000*r.customQ)/100);schedule();}});
  bind('measure-select',value=>{s.measure=value;if(value!=='food_total')s.overlays.delete('nielsen');$('measure-select').title=displayLabel('spending',value,s.primary.toUpperCase());fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());});
  document.querySelectorAll('input[name="indicator-kind"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;applyMainMetric(input.value==='pareto'?s.paretoMetric:input.value==='shares'?s.shareMetric:'gini');schedule();}));
  document.querySelectorAll('input[name="pareto-measure"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;applyMainMetric(input.value);schedule();}));
  document.querySelectorAll('input[name="pareto-estimator"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.method=input.value;syncTailControls();schedule();}));
  document.querySelectorAll('input[name="tail-threshold"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.threshold=input.value;syncTailControls();schedule();}));
  document.querySelectorAll('input[name="top-share-cutoff"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;s.shareMetric=input.value;applyMainMetric(input.value);schedule();}));
  [['weight-scf-income','scf_income'],['weight-irs-income','irs_income'],['weight-scf-wealth','scf_wealth']].forEach(([id,method])=>$(id).addEventListener('change',event=>{weighting.method=event.target.checked?method:'scf_income';applySpecificationSelection();}));
  function changeBivariatePair(value){if(value!=='wealth_consumption')b.overlays.delete('cex_bm_recon');const capital=['wealth_capital','income_capital'].includes(value);if(!capital&&b.autoSCF){b.overlays.delete('scf');b.autoSCF=false;}if(capital&&!b.overlays.has('scf')){b.overlays.add('scf');b.autoSCF=true;}b.pair=value;fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());}
  bind('biv-survey-select',value=>{b.primary=value;b.overlays.delete(value);syncHousingAvailability();if(value==='cex_bm'&&!['wealth_consumption','income_consumption'].includes(b.pair)){b.pair='wealth_consumption';$('pair-select').value=b.pair;}fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());fillSpendingSelect('biv-measure-select',value,b,BINS);});
  bind('biv-variant',value=>{b.adjustment=value;fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);}); bind('biv-measure-select',value=>{b.measure=value;$('biv-measure-select').title=spendingName(value);}); bind('pair-select',changeBivariatePair); bind('wave-select',value=>b.wave=value);
  bind('dina-wave-select',value=>b.dinaWave=value);bind('recon-wave-select',value=>b.reconWave=value);bind('scf-wave-select',value=>b.scfWave=value);bind('cex-wave-select',value=>b.cexWave=value);bind('bm-wave-select',value=>b.bmWave=value);
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
  function downloadPNG(chart,name) { if(!chart)return; const anchor=document.createElement('a');anchor.download=name;anchor.href=withFigureYAxisTitles([chart],()=>chart.toBase64Image('image/png',1));anchor.click(); }
  $('download-time-csv').addEventListener('click',()=>downloadCSV(timeRows,'inequality_results.csv'));
  $('download-biv-csv').addEventListener('click',()=>downloadCSV(binRows,'joint_distribution_results.csv'));
  $('download-time-png').addEventListener('click',()=>downloadPNG(timeChart,'inequality.png'));
  $('download-biv-png').addEventListener('click',()=>downloadPNG(bivChart,'joint_distribution.png'));
  $('results-prev').addEventListener('click',()=>{resultPage--;renderResults();});$('results-next').addEventListener('click',()=>{resultPage++;renderResults();});
  $('download-results-selected').addEventListener('click',()=>downloadCSV(resultRows,'selected_inequality_results.csv'));
  $('download-results-all').addEventListener('click',downloadAllResults);

  function definitions(){definitionsController=initBudgetDefinitions({host:$('definitions-content'),metadata:META,summary:ALL_SUMMARY,referencePoints,spendingOptions,getHousingMethod:()=>housing.method,getDinaCapitalDefinition:()=>dina.capitalDefinition});}

  if(typeof Chart!=='function') { $('page-error').hidden=false;$('page-error').textContent='The embedded chart library could not be loaded.';return; }
  enableTouchTooltipDismissal(Chart);
  const isOnlineBuild = document.querySelector('[data-explorer-block][data-parts]') !== null;
  if (isOnlineBuild) Chart.register(onlineYAxisTitles);
  Chart.defaults.font.family='Arial, sans-serif'; Chart.defaults.color='#6c7180';
  if(typeof initUSReferencePoints==='function')referenceController=initUSReferencePoints(META,{getCapitalVariant:dinaVariant});
  initializeDinaControls();
  $('wave-select').replaceChildren();
  [['average','Across-wave average'],...years.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('wave-select').append(option);});
  $('wave-select').value=b.wave;
  $('scf-wave-select').replaceChildren();
  [['average','Across-wave average'],...scfYears.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('scf-wave-select').append(option);});
  if(b.scfWave!=='average'&&!scfYears.includes(Number(b.scfWave)))b.scfWave=String(scfYears[scfYears.length-1]);
  $('scf-wave-select').value=b.scfWave;
  function fillBivariateCatalogueControls(){
    const cexBivYears=[...new Set(BINS.filter(row=>row.survey==='CEX').map(row=>row.year).filter(FINITE))].sort((a,b)=>a-b);
    $('cex-wave-select').replaceChildren(new Option('Across-wave average','average'),...cexBivYears.map(year=>new Option(String(year),String(year))));
    if(cexBivYears.length&&b.cexWave!=='average'&&!cexBivYears.includes(Number(b.cexWave)))b.cexWave=String(cexBivYears.at(-1));
    $('cex-wave-select').value=b.cexWave;
    $('biv-survey-select').replaceChildren(...bivariateSurveyChoices().map(survey=>new Option(surveyName(survey),survey)));
    $('biv-survey-select').value=b.primary;
    fillOverlays('biv-overlay-controls',b,bivariateSurveyChoices());
    fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);
  }
  fillBivariateCatalogueControls();
  $('recon-wave-select').replaceChildren();[['average','Across-wave average'],...bmReconYears.map(year=>[String(year),String(year)])].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;$('recon-wave-select').append(option);});if(!bmReconYears.includes(Number(b.reconWave)))b.reconWave=String(bmReconYears.at(-1));$('recon-wave-select').value=b.reconWave;
  $('survey-select').value=s.primary;
  fillOverlays('overlay-controls',s,mainOverlayChoices());
  fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);$('biv-bin-min').value=String(b.minN);$('biv-scale').value=b.scale;$('biv-fit').value=b.fit;
  if($('overview-subtitle'))$('overview-subtitle').textContent='Consumption, income and wealth across survey waves.';
  function crossCountryUSSummary(measure,{indicator='pareto',threshold='ks',q=.95}={}){
    const fields={consump_def1:'c',total_labor_income:'labor',total_income:'income',networth_val:'wealth',total_capital_income:'capital'};
    const methods=['MLE','OLS'],isTail=indicator==='pareto'||indicator==='ratio',ratio=indicator==='ratio';
    const cutoff=isTail&&threshold!=='ks'?thresholdQ(threshold,q):null;
    const thresholdLabel=isTail?(cutoff===null?'KS':'P'+Number((100*cutoff).toFixed(4))):null;
    const groups=new Map();
    function add(source,method,specification,estimate){
      if(!FINITE(estimate))return;
      const {survey,year,variable}=source;
      const consumption=measure==='auto'?(survey==='SCF'?'expenditure_incl_rent':'consump_def1')
        :measure==='food_total'&&survey==='NIELSEN'?'retail_expenditure':measure;
      const key=variable===consumption?'consump_def1':variable;
      if(!fields[key]||(key==='consump_def1'&&variable!==consumption))return;
      const id=[survey,method,specification].join('|');
      if(!groups.has(id))groups.set(id,new Map());
      const annual=groups.get(id);
      if(!annual.has(year))annual.set(year,{
        country:'US',country_name:'United States',survey,method,specification,threshold:thresholdLabel,
        housing_method:specification==='reference'?'not_applicable':housingMethod(source),
        weighting_method:specification==='reference'?(survey==='YODLEE'?'source_scf_income':'not_applicable'):weightingMethod(source),
        period_type:'wave',year,period_label:String(year),n_waves:1,
      });
      const row=annual.get(year);
      row[key]=estimate;
      if(key==='consump_def1')row.consumption_measure=variable;
    }
    function fixedEstimate(row,method,curve){
      const index=curve?.qs?.findIndex(value=>Math.abs(value-cutoff)<1e-7)??-1;
      const estimate=curve?.[method.toLowerCase()]?.[index];
      if(!FINITE(estimate))return null;
      const stored=row['pareto_'+threshold];
      return method==='MLE'&&threshold!=='custom'&&FINITE(stored)?stored:estimate;
    }
    const sourceRows=ALL_SUMMARY.filter(row=>VISIBLE_US_SURVEYS.has(row.survey)&&specificationMatches(row));
    for(const row of sourceRows)for(const method of methods){
      const estimate=!isTail?row[indicator]:cutoff===null?tailResult(row,method,'ks').estimate:fixedEstimate(row,method,curveIndex.get(curveKey(row)));
      add(row,method,row.variant,estimate);
    }
    if(s.cexIncome)for(const row of (isTail?cexIncomeCurves:cexIncomeSummary).filter(specificationMatches)){
      if(['total_labor_income','total_income','total_capital_income'].includes(row.variable))
        for(const method of methods){
          const estimate=!isTail?row[indicator]:cutoff===null?row['ks_'+method.toLowerCase()]?.estimate:fixedEstimate(row,method,row);
          add(row,method,row.variant,estimate);
        }
    }
    if(cutoff!==null){
      for(const method of methods)for(const point of referenceController?.summaryThresholdPoints(method,threshold,q)||[]){
        add(point,method,'reference',point.estimate);
      }
    }else{
      for(const point of referencePoints()){
        if(!point.default_reference&&point.survey!=='SAEZ_ZUCMAN')continue;
        if(isTail)add(point,point.method,'reference',point.estimate);
        else for(const method of methods)add(point,method,'reference',point[indicator]);
      }
    }
    const hasWealth=row=>FINITE(row.networth_val)&&row.networth_val>0;
    return [...groups.values()].flatMap(annual=>{
      const rows=[...annual.values()].filter(row=>!ratio||hasWealth(row)).sort((a,b)=>a.year-b.year);
      if(!rows.length)return [];
      const mean={...rows[0],period_type:'average',year:null,period_label:yearRange(rows.map(row=>row.year))+' average',n_waves:rows.length};
      for(const [variable,count] of Object.entries(fields)){
        const observed=rows.filter(row=>FINITE(row[variable]));
        const numerator=avg(observed.map(row=>row[variable]));
        mean[variable]=ratio&&observed.length?numerator/avg(observed.map(row=>row.networth_val)):numerator;
        mean['n_waves_'+count]=observed.length;
      }
      mean.consumption_measure=rows.find(row=>row.consumption_measure)?.consumption_measure;
      if(!ratio)return [...rows,mean];
      const normalized=rows.map(row=>{
        const item={...row};
        for(const variable of Object.keys(fields))if(FINITE(row[variable]))item[variable]=row[variable]/row.networth_val;
        return item;
      });
      return [...normalized,mean];
    });
  }
  function initializeOtherController(){
    if(otherController||typeof initOtherSurveys!=='function')return;
    const usSurveys=[...VISIBLE_US_SURVEYS,...(referenceController?.sources||[])];
    otherController=initOtherSurveys(DATA.other||{}, {
      usSurveys,getUSSummary:crossCountryUSSummary,spendingOptions,surveyName,surveyTooltip,appendParetoEstimationLink,
      prepareUSSummaryThresholds:()=>ensureFullCurves([...VISIBLE_US_SURVEYS,...(META.reference_curve_surveys||[])]),
      loadUSCurves:async()=>{
        await ensureFullCurves([...VISIBLE_US_SURVEYS,...(META.reference_curve_surveys||[])]);
        return ALL_CURVES.filter(row=>VISIBLE_US_SURVEYS.has(row.survey))
          .concat(referenceController?.profileCurves({includeNielsen:true})||[]);
      },
      getCEXIncome:()=>s.cexIncome,onCEXIncomeChange:value=>{s.cexIncome=value;fillOverlays('overlay-controls',s,mainOverlayChoices());fillSeries();schedule();},
      getLoadedCEXCurves:()=>cexIncomeCurves,
      loadCEXIncome:async()=>{await ensureCEXIncome();return cexIncomeCurves;},
      getDinaCapitalDefinition:()=>dina.capitalDefinition,onDinaCapitalDefinitionChange:setDinaCapitalDefinition,
      loadInternationalBins:separateBlocks?loadInternationalBins:null,getHousingMethod:()=>housing.method,
      getSpecificationSignature:()=>housing.method+'|'+weighting.method+'|'+dina.capitalDefinition,
      housingMatches:specificationMatches,metadata:META,createEyeballing:host=>createEyeballing(host,true),
    });
    if(otherVisible()){const control=document.querySelector('.global-housing-control'),nav=$('cc-secondary-nav')?.querySelector('.secondary-nav-inner');if(control&&nav){control.hidden=false;nav.append(control);}}
  }
  function setDinaCapitalDefinition(value){if(!META.saez_zucman_reference?.capital_income_definitions?.[value])return;dina.capitalDefinition=value;syncDinaControls();fillResultsVariables();schedule();}
  function initializeDinaControls(){
    if(!META.surveys?.SAEZ_ZUCMAN)return;
    for(const [name,anchor] of [['results',$('results-datasets')?.closest('.control')],['biv',$('biv-overlay-controls')?.closest('.control')]]){
      if(!anchor)continue;const box=document.createElement('div');box.className='control dina-capital-control';box.id='dina-capital-'+name+'-control';const label=document.createElement('label');label.htmlFor='dina-capital-'+name;label.textContent='Capital gains (DINA)';const select=document.createElement('select');select.id=label.htmlFor;Object.entries(META.saez_zucman_reference.capital_income_definitions).forEach(([value,row])=>select.add(new Option(row.label,value)));select.value=dina.capitalDefinition;select.addEventListener('change',()=>setDinaCapitalDefinition(select.value));box.append(label,select);anchor.after(box);
    }
    syncDinaControls();
  }
  function syncDinaControls(){for(const [name,selected] of [['results',resultsSurveys()],['biv',selectedSurveys(b)]]){const select=$('dina-capital-'+name),box=$('dina-capital-'+name+'-control');if(select)select.value=dina.capitalDefinition;if(box)box.hidden=!selected.has('SAEZ_ZUCMAN')||(name==='biv'&&!['wealth_capital','income_capital'].includes(b.pair));}}
  function initializeQuantileComparison(){
    const referenceSurveys=[...new Set(referenceController?.profileCurves().map(row=>row.survey)||[])];
    const scopedCurvePromises=new Map();
    function loadScopedCurves(key){
      if(!scopedCurvePromises.has(key))scopedCurvePromises.set(key,loadBlock(key).then(table=>{
        blockPromises.delete(key);
        return unpack(table);
      }).catch(error=>{scopedCurvePromises.delete(key);throw error;}));
      return scopedCurvePromises.get(key);
    }
    quantileComparison=createUSQuantileComparison({
      host:$('us-quantile-comparison'),
      surveys:[...VISIBLE_US_SURVEYS,...referenceSurveys],
      showRawByDefault: !isOnlineBuild || !phoneLayout.matches,
      metadata:META,spendingOptions,surveyName,surveyTooltip,
      getHousingMethod:()=>housing.method,
      onHousingChange:checked=>{$('constant-housing-service').checked=checked;applyHousingMethod();},
      getWeightingMethod:()=>weighting.method,
      onWeightingChange:method=>{weighting.method=method;applySpecificationSelection();},
      getCapitalDefinition:()=>META.saez_zucman_reference?.capital_income_definitions?.[dina.capitalDefinition]?.author_variant,
      onCapitalDefinitionChange:setDinaCapitalDefinition,
      getCEXIncome:()=>s.cexIncome,
      onCEXIncomeChange:checked=>{s.cexIncome=checked;fillOverlays('overlay-controls',s,mainOverlayChoices());fillSeries();schedule();},
      async loadCurves(options){
        const stages=new Map();
        for(const {survey,variant} of options){
          if(!stages.has(survey))stages.set(survey,new Set());
          stages.get(survey).add(variant);
        }
        const fallback=[],scoped=[];
        for(const [survey,variants] of stages){
          const keys=[...variants].map(variant=>{
            const weights=survey==='CEX_BM_RECON'?'scf_housing':survey==='PSID'&&variant==='full'?weighting.method:'scf_income';
            return ['quantile_curves',survey,variant,housingSource(survey),weights].join('_');
          });
          if(loadedCurveSurveys.has(survey)||!keys.every(key=>$('explorer-block-'+key)))fallback.push(survey);
          else for(const key of keys)scoped.push(loadScopedCurves(key));
        }
        const includeCEXIncome=s.cexIncome&&stages.has('CEX_BM_RECON');
        const [selectedCurves]=await Promise.all([
          Promise.all(scoped),ensureFullCurves(fallback),includeCEXIncome?ensureCEXIncome():null,
        ]);
        const curves=ALL_CURVES.filter(row=>fallback.includes(row.survey)&&specificationMatches(row)).concat(...selectedCurves);
        if(includeCEXIncome)curves.push(...cexIncomeCurves.filter(specificationMatches));
        return curves.concat((referenceController?.profileCurves()||[]).filter(row=>stages.has(row.survey)));
      },
    });
  }
  function initializeAdjustmentController(){if(!adjustmentController&&typeof initAdjustments==='function')adjustmentController=initAdjustments(DATA.adjustments||{},{getHousingMethod:()=>housing.method,getWeightingMethod:()=>weighting.method,housingMatches,loadComposition:async survey=>{const key='composition_'+survey,value=await loadBlock(key);blockPromises.delete(key);return value;}});}
  const createEyeballing=(host,international=false)=>Eyeballing.create({host,international,metadata:META,loadBlock,getHousingMethod:()=>housing.method,onHousingChange:method=>{housing.method=method;applySpecificationSelection();},getWeightingMethod:()=>weighting.method,onWeightingChange:method=>{weighting.method=method;applySpecificationSelection();},getDinaCapitalDefinition:()=>dina.capitalDefinition,onDinaCapitalDefinitionChange:setDinaCapitalDefinition,surveyTooltip,appendParetoEstimationLink});
  eyeController=createEyeballing($('us-eyeballing'));
  if(typeof initDataAndCorrespondence==='function')dataController=initDataAndCorrespondence(META,{loadParetoIllustration:()=>loadBlock('illustration_ks')});
  window.addEventListener('adjustments-procedure-visible',()=>{if(adjustmentsVisible())adjustmentController?.render();});
  function filterSpecificationData(){SUMMARY=ALL_SUMMARY.filter(specificationMatches);CURVES=ALL_CURVES.filter(specificationMatches);BINS=ALL_BINS.filter(specificationMatches);}
  function syncWeightingControls(){
    const chosen=selectedSurveys(s),onlyCEX=chosen.size===1&&chosen.has('CEX_BM_RECON'),available=s.adjustment==='full'&&chosen.has('PSID')&&!!META.weighting_sensitivity;
    const standardOptions=document.querySelector('.weighting-control>.weighting-options:not(.cex-weighting-options)'),cexOptions=document.querySelector('.cex-weighting-options');if(standardOptions)standardOptions.hidden=onlyCEX;if(cexOptions)cexOptions.hidden=!onlyCEX;
    $('weight-scf-income').checked=weighting.method==='scf_income';$('weight-irs-income').checked=weighting.method==='irs_income';$('weight-scf-wealth').checked=weighting.method==='scf_wealth';
    $('weight-scf-income').disabled=!available;$('weight-irs-income').disabled=!available;$('weight-scf-wealth').disabled=!available;
    ['weight-scf-income','weight-irs-income','weight-scf-wealth'].forEach(id=>$(id).closest('.weighting-choice')?.classList.toggle('unavailable-option',!available));document.querySelector('.weighting-control')?.classList.toggle('weighting-unavailable',!available&&!(onlyCEX&&s.adjustment==='full'));
  }
  function applySpecificationSelection(shouldSchedule=true){
    filterSpecificationData();syncWeightingControls();fillSpendingSelect('measure-select',selectedSurveys(s),s,SUMMARY);fillSpendingSelect('biv-measure-select',selectedSurveys(b),b,BINS);fillResultsVariables();fillSeries();fillOverlays('overlay-controls',s,mainOverlayChoices());if(shouldSchedule)schedule();
  }
  function syncHousingAvailability(){
    const input=$('constant-housing-service'),mainSelection=selectedSurveys(s),supports=survey=>ALL_SUMMARY.some(row=>row.survey===survey&&housingMethod(row)==='bp'),unavailable=mainVisible()?![...mainSelection].some(supports):resultsVisible()?![...resultsSurveys()].some(supports):bivVisible()?!supports(b.primary.toUpperCase()):false;
    if(unavailable&&housing.method==='bp'){housing.method='benchmark';applySpecificationSelection(false);}input.disabled=unavailable;input.closest('.weighting-choice')?.classList.toggle('unavailable-option',unavailable);input.title=unavailable?'The selected dataset has no constant-rate homeowner-service alternative.':'Use the source constant-rate homeowner-service construction, retaining its documented component factors and representation weights.';
    input.checked=housing.method==='bp';
    ['biv-constant-housing-service'].forEach(id=>{const localInput=$(id);if(localInput){localInput.checked=housing.method==='bp';localInput.disabled=unavailable;localInput.title=input.title;localInput.closest('.local-housing-control')?.classList.toggle('unavailable-option',unavailable);}});
    syncWeightingControls();
  }
  function applyHousingMethod(){
    housing.method=$('constant-housing-service').checked?'bp':'benchmark';
    applySpecificationSelection();
  }
  function initDetailHelp(){
    const controls=META.weighting_sensitivity?.controls||{},fallback={irs_income:{tooltip:['Reweights PSID to the IRS/SOI income distribution using median-normalized income brackets and the corresponding reporting correction.','Available for fully adjusted PSID results.']},scf_wealth:{tooltip:['Reweights PSID to the SCF wealth distribution using median-normalized wealth brackets and the corresponding reporting correction.','Available for fully adjusted PSID results.']},scf_income:{tooltip:['Benchmark: reweight PSID units to the SCF income distribution using median-normalized income brackets.','This is the default representation correction in the fully adjusted specification. Yodlee bank-transaction data always use SCF income weights for representativeness.']},scf_housing:{tooltip:['Matches CEX consumer-unit shares to the latest observed SCF at or before each year, using separate nonowner and gross primary-residence value cells in common prices.','SCF target shares average five imputations. The correction preserves the CEX consumer-unit total, then recomputes reporting factors. It targets housing wealth, not comprehensive net worth.']},ks_threshold:{tooltip:['KS selects the tail threshold that minimizes the maximum distance between the empirical upper tail and its fitted Pareto distribution.','The threshold is selected separately for each dataset, wave, variable and estimator.']}};
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
  window.addEventListener('resize',()=>{if(mainVisible())timeChart?.resize();if(quantilesVisible())quantileComparison?.resize();if(bivVisible())bivChart?.resize();if(s.tab==='eyeballing')eyeController?.resize();if(otherVisible())otherController?.resize();if(adjustmentsVisible()&&(!dataController||dataController.isProcedureVisible()))adjustmentController?.resize();if(dataVisible()||adjustmentsVisible())dataController?.resize();if(paretoVisible())paretoController?.resize();});
})().catch(error=>{document.querySelector('main')?.removeAttribute('inert');document.querySelector('main')?.removeAttribute('aria-busy');document.getElementById('primary-nav')?.removeAttribute('inert');console.error(error);const target=document.getElementById('page-error');if(target){target.hidden=false;target.textContent='The results could not be loaded. Please reload the page in a current browser.';}});
