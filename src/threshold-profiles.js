/* Inputs are released wave-level estimates and source-specific figure contracts. */
const ThresholdProfiles = (() => {
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x),mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  const number=(x,d=2)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const colors={consumption:'#477EAD',total_labor_income:'#BF5555',total_income:'#A96F4B',networth_val:'#4D8B69',total_capital_income:'#C4A12A'};
  const fourSeries=[['consumption','Consumption'],['total_labor_income','Labor income'],['networth_val','Wealth'],['total_capital_income','Capital income']];
  const fiveSeries=[fourSeries[0],fourSeries[1],['total_income','Total income'],fourSeries[2],fourSeries[3]];
  const variants=[['raw','Raw data'],['adj','Reporting adjustment'],['full','Reporting + representation adjustments'],['original','Original B&M construction'],['reference','Standalone reference']];

  // Invert the Student t CDF, including fractional effective degrees of freedom for HFCS.
  function logGamma(z){
    const p=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z-=1;let x=.99999999999980993;for(let i=0;i<p.length;i++)x+=p[i]/(z+i+1);const t=z+p.length-.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function betaFraction(a,b,x){
    const tiny=1e-300;let c=1,d=1-(a+b)*x/(a+1);if(Math.abs(d)<tiny)d=tiny;d=1/d;let h=d;
    for(let m=1;m<=300;m++){
      const m2=2*m;let aa=m*(b-m)*x/((a+m2-1)*(a+m2));d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;h*=d*c;
      aa=-(a+m)*(a+b+m)*x/((a+m2)*(a+m2+1));d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-14)break;
    }return h;
  }
  function regularizedBeta(x,a,b){
    if(x<=0)return 0;if(x>=1)return 1;
    const front=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    return x<(a+1)/(a+b+2)?front*betaFraction(a,b,x)/a:1-front*betaFraction(b,a,1-x)/b;
  }
  const tCache=new Map();
  function tCritical(p,df){
    if(!finite(df)||df<=0||!finite(p)||p<=.5||p>=1)return null;
    const key=p+'|'+df;if(tCache.has(key))return tCache.get(key);
    const cdf=t=>1-.5*regularizedBeta(df/(df+t*t),df/2,.5);let lo=0,hi=1;
    while(cdf(hi)<p&&hi<1e12)hi*=2;
    for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid;}
    const value=(lo+hi)/2;tCache.set(key,value);return value;
  }
  const t975=df=>tCritical(.975,df);
  function summarize(values,{weights=null,confidence=.90}={}){
    const kept=values.map((value,i)=>({value,w:weights?weights[i]:1})).filter(c=>finite(c.value)&&finite(c.w)&&c.w>0),n=kept.length;
    if(!n)return{mean:null,n:0,n_eff:0,se:null,lo:null,hi:null};
    const sw=kept.reduce((s,c)=>s+c.w,0),sw2=kept.reduce((s,c)=>s+c.w*c.w,0),m=kept.reduce((s,c)=>s+c.value*c.w,0)/sw,nEff=sw*sw/sw2,den=sw-sw2/sw;
    if(n<2||den<=0)return{mean:m,n,n_eff:nEff,se:null,lo:null,hi:null};
    const sd=Math.sqrt(kept.reduce((s,c)=>s+c.w*(c.value-m)**2,0)/den),se=sd/Math.sqrt(nEff),half=tCritical(1-(1-confidence)/2,nEff-1)*se;
    return{mean:m,n,n_eff:nEff,se,lo:m-half,hi:m+half};
  }
  function contractFor(survey,metadata={}){
    return {aggregation:survey==='HFCS'?'population':'equal_wave',ci_level:.90,reference:'mean_ks_optimum',stage_coverage:'available',...(survey==='HFCS'?{weight_field:'population_weight',exclude_countries:['LU'],exclude_countries_when:'all'}:{}),...(metadata.quantile_profile_contracts?.[survey]||{})};
  }
  function yearFilter(selection){
    if(selection==='all')return ()=>true;
    const [start,end=start]=String(selection).split('-').map(Number);
    return year=>year>=start&&year<=end;
  }
  function selectedCells(curves,{survey,variant,country='all',year='all',variable,contract={},authorVariant=null}){
    const cells=new Map(),excluded=country==='all'?new Set(contract.exclude_countries||[]):new Set(),inYear=yearFilter(year);
    curves.forEach(c=>{
      if(c.survey!==survey||(c.variant||c.specification)!==variant||c.variable!==variable||(authorVariant&&c.author_variant!==authorVariant)||!finite(c.year)||(country!=='all'&&c.country!==country)||!inYear(c.year)||excluded.has(c.country))return;
      cells.set([c.country||'US',c.year].join('|'),c);
    });return [...cells.values()];
  }
  const weightFor=(c,contract)=>contract.aggregation==='population'?c[contract.weight_field||'population_weight']:1;
  const cellKey=c=>[c.country||'US',c.year].join('|');
  function ratioCells(curves,{survey,variant,country,year,indicator,contract,wealthAuthorVariant,incomeAuthorVariant}){
    const variable={wealth_ratio:'networth_val',income_ratio:'total_income'}[indicator];
    if(!variable)return null;
    const authorVariant=variable==='networth_val'?wealthAuthorVariant:incomeAuthorVariant;
    return new Map(selectedCells(curves,{survey,variant,country,year,variable,contract,authorVariant}).map(c=>[cellKey(c),c]));
  }
  function profiles(curves,{survey,variant,country='all',year='all',variable,method='MLE',indicator='pareto',minQ=.70,maxQ=.99,contract={},authorVariant=null,wealthAuthorVariant=authorVariant,incomeAuthorVariant=authorVariant}){
    const window=indicator==='share'?(contract.share_profile_window||contract.profile_window):contract.profile_window;minQ=Math.max(minQ,window?.[0]??minQ);maxQ=Math.min(maxQ,window?.[1]??maxQ);
    const groups=new Map(),share=indicator==='share',denominators=ratioCells(curves,{survey,variant,country,year,indicator,contract,wealthAuthorVariant,incomeAuthorVariant}),ratio=!!denominators;
    selectedCells(curves,{survey,variant,country,year,variable,contract,authorVariant}).forEach(c=>(share&&c.share_qs?c.share_qs:c.qs||[]).forEach((q,i)=>{
      const denominator=denominators?.get(cellKey(c)),j=ratio?(denominator?.qs||[]).findIndex(value=>Math.abs(value-q)<1e-8):-1,numerator=c[method.toLowerCase()]?.[i],denominatorValue=ratio&&j>=0?denominator?.[method.toLowerCase()]?.[j]:null,value=share?(c.share_values||c.top_share)?.[i]:ratio?(finite(numerator)&&finite(denominatorValue)&&denominatorValue>0?numerator/denominatorValue:null):numerator,n=share?(c.share_n_tail||c.n_tail_share)?.[i]:ratio&&j>=0&&finite(denominator?.n_tail?.[j])?Math.min(c.n_tail?.[i]??Infinity,denominator.n_tail[j]):c.n_tail?.[i],w=weightFor(c,contract);
      if(q<minQ-1e-8||q>maxQ+1e-8||!finite(w)||w<=0)return;
      const key=Math.round(q*1e8),reliability=c.reliability_by_threshold?.[i];
      if(finite(value)||c.survey==='HBS'&&reliability==='suppressed'){
        if(!groups.has(key))groups.set(key,[]);
        if(finite(value))groups.get(key).push({value,w,n,year:c.year,reference_year:c.reference_year,country:c.country||'US',reliability});
      }
    }));
    return [...groups].sort((a,b)=>a[0]-b[0]).map(([q,cells])=>({q:q/1e8,...summarize(cells.map(c=>c.value),{weights:cells.map(c=>c.w),confidence:contract.ci_level||.90}),n_flagged:cells.filter(c=>c.reliability==='low_support').length,min_tail_units:cells.some(c=>finite(c.n))?Math.min(...cells.map(c=>c.n).filter(finite)):null,years_used:[...new Set(cells.map(c=>c.year))].sort((a,b)=>a-b).join(';'),reference_years_used:[...new Set(cells.map(c=>c.reference_year).filter(finite))].sort((a,b)=>a-b).join(';'),countries_used:[...new Set(cells.map(c=>c.country))].sort().join(';'),cells_used:cells.map(c=>[c.country,c.year].join('|')).sort().join(';')}));
  }
  function reference(curves,{survey,variant,country='all',year='all',variable,method='MLE',indicator='pareto',contract={},authorVariant=null,wealthAuthorVariant=authorVariant,incomeAuthorVariant=authorVariant}){
    const denominators=ratioCells(curves,{survey,variant,country,year,indicator,contract,wealthAuthorVariant,incomeAuthorVariant});
    const cells=selectedCells(curves,{survey,variant,country,year,variable,contract,authorVariant}).map(c=>{const numerator=c['ks_'+method.toLowerCase()]?.estimate,denominator=denominators?.get(cellKey(c))?.['ks_'+method.toLowerCase()]?.estimate;return{value:denominators?(finite(numerator)&&finite(denominator)&&denominator>0?numerator/denominator:null):numerator,w:weightFor(c,contract),reliability:c['ks_'+method.toLowerCase()]?.reliability};});
    return {...summarize(cells.map(c=>c.value),{weights:cells.map(c=>c.w),confidence:contract.ci_level||.90}),n_flagged:cells.filter(c=>finite(c.value)&&finite(c.w)&&c.w>0&&c.reliability==='low_support').length};
  }
  // Kept for callers of the former API; figure profiles intentionally use stage-specific available cells.
  function commonCells(){return null;}
  function create({host,curves,surveys,international=false,spendingOptions=[],metadata={},getHousingMethod=()=> 'benchmark',getSpecificationSignature=getHousingMethod,housingMatches=row=>(row.housing_method||'benchmark')==='benchmark',onSurveyChange=null,getDinaCapitalDefinition=()=> 'including_fiscal_gains',onDinaCapitalDefinitionChange=null,getCEXIncome=()=>false,onCEXIncomeChange=null,loadCEXIncome=null,onOpenComparison=null}){
    const allCurves=curves;
    const isCEX=survey=>['CEX','CEX_BM','CEX_BM_RECON'].includes(survey),sourceDisplay=survey=>survey==='CEX_BM_RECON'?(metadata.cex_bm_recon_display||metadata.cex_bm_display||metadata.cex_display):survey==='CEX_BM'?(metadata.cex_bm_display||metadata.cex_display):metadata.cex_display,curveMatches=row=>(!row.optional_income||getCEXIncome())&&(row.reference_only||housingMatches(row));
    const seriesFor=survey=>survey==='CEX_BM_RECON'&&getCEXIncome()?fiveSeries:metadata.surveys?.[survey]?.profile_variables?fiveSeries.filter(([key])=>metadata.surveys[survey].profile_variables.includes(key)||(international&&survey==='SAEZ_ZUCMAN'&&key==='total_income')):survey==='FORBES'?[['networth_val','Wealth']]:survey==='NIELSEN'?[['consumption','Retail purchases']]:fiveSeries;
    let charts=[],rows=[],signature='';
    const selectedVariables=new Set((international?fiveSeries:fourSeries).map(([key])=>key));
    const identity=c=>[c.survey,c.country,c.year,c.variant,c.variable,c.housing_method,c.weighting_method,c.author_variant].join('|'),knownCurves=new Set(allCurves.map(identity));
    function addCurves(incoming){let changed=false;incoming.forEach(c=>{const key=identity(c);if(!knownCurves.has(key)){knownCurves.add(key);allCurves.push(c);changed=true;}});if(changed)signature='';}
    const section=document.createElement('section');section.className='threshold-profiles';
    section.innerHTML='<div class="threshold-heading"><h2>Pareto tail coefficients by quantile</h2><button class="text-button" type="button">Profile CSV</button></div><div class="threshold-profile-controls"></div><div class="threshold-legend"></div><div class="threshold-profile-grid"></div><p class="threshold-note results-note"></p>';
    const exportButton=section.querySelector('.threshold-heading .text-button');
    const heading=section.querySelector('.threshold-heading h2');
    if(onOpenComparison){
      const preview=document.createElement('button');
      preview.type='button';
      preview.className='quantile-preview-button';
      preview.textContent='(v2)';
      preview.setAttribute('aria-label','Open experimental estimates by quantile (v2)');
      preview.setAttribute('aria-controls','panel-quantiles-v2');
      preview.addEventListener('click',onOpenComparison);
      const title=document.createElement('div');
      title.className='threshold-heading-title';
      heading.replaceWith(title);
      title.append(heading,preview);
    }
    host.append(section);
    const grid=section.querySelector('.threshold-profile-grid'),legend=section.querySelector('.threshold-legend'),controls=section.querySelector('.threshold-profile-controls'),note=section.querySelector('.threshold-note');
    const makeSelect=(labelText,items)=>{const label=document.createElement('label');label.className='control';const title=document.createElement('span');title.textContent=labelText;const select=document.createElement('select');items.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);});label.append(title,select);controls.append(label);return select;};
    const actualSurveys=surveys.filter(s=>curves.some(c=>c.survey===s)),surveyLabel=s=>s==='YODLEE'?'Yodlee (bank data)':s==='NIELSEN'?'NielsenIQ':metadata.surveys?.[s]?.label||(s==='CEX_BM'?'CEX B&M':s);
    const surveySelect=makeSelect('Survey',[...(international?[['all','All surveys']]:[]),...actualSurveys.map(s=>[s,surveyLabel(s)]),...(!international&&actualSurveys.length>1?[['all','All US surveys']]:[])]);
    const countrySelect=international?makeSelect('Country',[['all','All countries']]):null;
    const defaultYear=international?'2005-2025':'all';
    const yearSelect=makeSelect('Year',[['all','All waves']]);
    const incomeVariables=['total_labor_income','total_income','total_capital_income'];
    const cexIncomeYears=metadata.cex_optional_income?.years||[];
    yearSelect.closest('.control').classList.add('quantile-year-control');
    const spending=international&&!spendingOptions.length?null:makeSelect('Variable for consumption',[['auto','Consumption (SCF: expenditure incl. imputed rent)'],...spendingOptions.filter(o=>o.key!=='consump_def1'&&curves.some(c=>c.variable===o.key)).map(o=>[o.key,o.label])]);
    if(spending)spending.closest('.control').classList.add('consumption-variable-control');
    const benchmarkConsumption=survey=>survey==='SCF'?'expenditure_incl_rent':'consump_def1';
    const consumptionFor=survey=>!spending||spending.value==='auto'?benchmarkConsumption(survey)
      :survey==='NIELSEN'&&spending.value==='food_total'?'retail_expenditure':spending.value;
    const indicatorSelect=makeSelect('Indicator',[['pareto','Pareto coefficient'],['wealth_ratio','Pareto coefficient / wealth'],['share','Share above quantile']]);
    const methodSelect=makeSelect('Estimator',[['MLE','MLE'],['OLS','OLS']]);
    let cexIncomeBox,cexIncomeInput;
    if(actualSurveys.includes('CEX_BM_RECON')&&loadCEXIncome){
      cexIncomeBox=document.createElement('div');cexIncomeBox.className='quantile-cex-income';const label=document.createElement('label');label.className='small-check';cexIncomeInput=document.createElement('input');cexIncomeInput.type='checkbox';cexIncomeInput.setAttribute('aria-label','Show CEX topcoded income');label.append(cexIncomeInput,document.createTextNode('Show CEX income'));const help=document.createElement('span');help.className='help-marker hover-help';help.tabIndex=0;help.textContent='?';help.setAttribute('aria-label','About CEX topcoded income');help.dataset.tooltip=metadata.cex_optional_income?.warning||'CEX income is incompletely reported and topcoded, severely biasing upper-tail estimates.';cexIncomeBox.append(label,help);controls.append(cexIncomeBox);
      cexIncomeInput.addEventListener('change',async()=>{const checked=cexIncomeInput.checked;cexIncomeInput.disabled=true;try{if(checked)addCurves(await loadCEXIncome());onCEXIncomeChange?.(checked);signature='';render();}catch(error){cexIncomeInput.checked=false;note.textContent='Income estimates could not be loaded. Please try again.';}finally{cexIncomeInput.disabled=false;}});
    }

    methodSelect.closest('.control').classList.add('quantile-estimator-control');
    const dinaCapital=metadata.surveys?.SAEZ_ZUCMAN?makeSelect('Capital gains (DINA)',Object.entries(metadata.saez_zucman_reference.capital_income_definitions).map(([key,row])=>[key,row.label])):null;
    if(dinaCapital){dinaCapital.closest('.control').classList.add('dina-capital-control');dinaCapital.value=getDinaCapitalDefinition();dinaCapital.addEventListener('change',()=>{onDinaCapitalDefinitionChange?.(dinaCapital.value);signature='';render();});}
    const chosenAuthorVariant=(survey,variable,fallback)=>survey==='SAEZ_ZUCMAN'?(['total_capital_income','total_income'].includes(variable)?metadata.saez_zucman_reference.capital_income_definitions[getDinaCapitalDefinition()].author_variant:'dina_2022'):fallback;
    const referenceSurveys=new Set(allCurves.filter(c=>c.reference_only).map(c=>c.survey));
    const canonicalStage=(survey,variant)=>referenceSurveys.has(survey)||['YODLEE','FORBES'].includes(survey)?'reference':survey==='SCF'&&variant==='full'?'adj':variant;
    function updateCountries(){if(!countrySelect)return;const old=countrySelect.value,map=new Map();curves.filter(c=>surveySelect.value==='all'||c.survey===surveySelect.value).forEach(c=>{if(c.country)map.set(c.country,c.country_name||c.country);});countrySelect.replaceChildren();[['all','All countries'],...[...map.entries()].sort((a,b)=>a[1].localeCompare(b[1]))].forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;countrySelect.append(o);});if([...countrySelect.options].some(o=>o.value===old))countrySelect.value=old;}
    function updateYears(){
      yearSelect.closest('.control').querySelector('span').textContent=['PSID','SCF','HFCS'].includes(surveySelect.value)?'Wave':'Year';
      const old=yearSelect.value,available=allCurves.filter(curveMatches).filter(c=>(surveySelect.value==='all'||c.survey===surveySelect.value)&&(!countrySelect||countrySelect.value==='all'||c.country===countrySelect.value)),years=[...new Set(available.map(c=>c.year).filter(finite))].sort((a,b)=>a-b);
      yearSelect.replaceChildren(new Option('All waves','all'));
      if(international&&years.length){
        const windows=document.createElement('optgroup');
        windows.label='20-year windows';
        const first=Math.floor(Math.min(years[0],2005)/5)*5;
        const last=Math.max(2005,Math.ceil((years.at(-1)-20)/5)*5);
        for(let start=first;start<=last;start+=5){
          const end=start+20;
          if(years.some(y=>y>=start&&y<=end))windows.append(new Option(start+'–'+end,start+'-'+end));
        }
        if(windows.children.length)yearSelect.append(windows);
        const singleWaves=document.createElement('optgroup');
        singleWaves.label='Individual waves';
        singleWaves.append(...years.map(y=>new Option(String(y),String(y))));
        yearSelect.append(singleWaves);
      }else yearSelect.append(...years.map(y=>new Option(String(y),String(y))));
      const values=new Set([...yearSelect.options].map(o=>o.value));
      const preferred=yearSelect.dataset.initialized?old:defaultYear;
      yearSelect.value=values.has(preferred)?preferred:values.has(defaultYear)?defaultYear:'all';
      yearSelect.dataset.initialized='true';
    }
    function updateSpending(){
      if(!spending)return;const old=spending.value,survey=surveySelect.value,country=countrySelect?.value||'all',inYear=yearFilter(yearSelect.value);
      const available=allCurves.filter(curveMatches).filter(c=>(survey==='all'||c.survey===survey)&&(country==='all'||c.country===country)&&inYear(c.year)),options=[];
      if(available.some(c=>c.variable===benchmarkConsumption(c.survey)))options.push(['auto',survey==='SCF'?'Expenditure including imputed rent':survey==='all'?'Survey benchmark':survey==='HBS'?'Consumption including in-kind benefits':'Consumption']);
      spendingOptions.filter(o=>o.key!=='consump_def1'&&available.some(c=>c.variable===o.key||o.key==='food_total'&&c.survey==='NIELSEN'&&c.variable==='retail_expenditure')).forEach(o=>options.push([o.key,o.label]));
      spending.replaceChildren();options.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;spending.append(option);});spending.disabled=!options.length;
      spending.value=options.some(o=>o[0]===old)?old:(options.some(o=>o[0]==='auto')?'auto':options[0]?.[0]||'');
    }
    updateCountries();updateYears();updateSpending();
    [surveySelect,countrySelect,yearSelect,spending,indicatorSelect,methodSelect].filter(Boolean).forEach(select=>select.addEventListener('change',()=>{if(select===surveySelect){onSurveyChange?.(surveySelect.value);updateCountries();}if(select===surveySelect||select===countrySelect)updateYears();signature='';render();}));
    exportButton.addEventListener('click',()=>{if(!rows.length)return;const fields=Object.keys(rows[0]),escape=x=>x===null||x===undefined?'':'"'+String(x).replace(/"/g,'""')+'"';const csv=[fields.join(','),...rows.map(r=>fields.map(k=>escape(r[k])).join(','))].join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=(international?'international':'US')+'_estimates_by_quantile.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    function render(){
      curves=allCurves.filter(curveMatches);updateYears();updateSpending();
      const year=yearSelect.value,inYear=yearFilter(year);
      const chosen=curves.filter(c=>(surveySelect.value==='all'||c.survey===surveySelect.value)&&(!countrySelect||countrySelect.value==='all'||c.country===countrySelect.value)&&inYear(c.year));
      if(cexIncomeBox){
        const cexIncomeRelevant=incomeVariables.some(variable=>selectedVariables.has(variable))&&
          chosen.some(c=>c.survey==='CEX_BM_RECON')&&
          (!cexIncomeYears.length||cexIncomeYears.some(inYear));
        cexIncomeBox.hidden=international?!cexIncomeRelevant:!['all','CEX_BM_RECON'].includes(surveySelect.value);
        cexIncomeInput.checked=getCEXIncome();
      }
      [...indicatorSelect.options].forEach(option=>{option.disabled=option.value==='wealth_ratio'&&!chosen.some(c=>c.variable==='networth_val')||option.value==='share'&&chosen.length>0&&chosen.every(c=>c.survey==='HBS')&&!chosen.some(c=>(c.share_values||c.top_share)?.some(finite))||chosen.length>0&&!chosen.some(c=>!referenceSurveys.has(c.survey)||(metadata.surveys?.[c.survey]?.available_profile_indicators||['pareto']).includes(option.value));option.title=option.disabled?(option.value==='wealth_ratio'&&!chosen.some(c=>c.variable==='networth_val')?'A matching wealth coefficient is unavailable.':'This dataset provides Pareto coefficients only.'):'';});if(indicatorSelect.selectedOptions[0]?.disabled)indicatorSelect.value='pareto';
      const relevant=chosen.filter(c=>c.variable===consumptionFor(c.survey)||c.variable!=='consump_def1'&&['networth_val','total_labor_income','total_income','total_capital_income'].includes(c.variable));
      [...methodSelect.options].forEach(option=>{option.disabled=!relevant.some(c=>c[option.value.toLowerCase()]?.some(finite));option.title=option.disabled?'No stored estimates for this method and selection.':'';});if(methodSelect.selectedOptions[0]?.disabled)methodSelect.value=[...methodSelect.options].find(option=>!option.disabled)?.value||'MLE';methodSelect.disabled=indicatorSelect.value==='share';
      const share=indicatorSelect.value==='share',ratio=indicatorSelect.value==='wealth_ratio',method=methodSelect.value,indicator=indicatorSelect.value,country=countrySelect?.value||'all';
      if(dinaCapital){
        dinaCapital.value=getDinaCapitalDefinition();
        const dinaCurves=chosen.filter(c=>c.survey==='SAEZ_ZUCMAN');
        const hasGainsSensitiveCurve=dinaCurves.some(c=>['total_capital_income','total_income'].includes(c.variable)&&
          selectedVariables.has(c.variable)&&c[method.toLowerCase()]?.some(finite));
        dinaCapital.closest('.control').hidden=international?share||!hasGainsSensitiveCurve:!dinaCurves.length;
      }
      const periodLabel=year.replace('-','–');
      const yTitle=share?'Share above percentile':ratio?'Relative to wealth (ζₓ / ζₐ)':'Pareto tail coefficient (ζ)';
      heading.textContent=share?'Shares above quantile':ratio?'Pareto tail coefficients relative to wealth by quantile':'Pareto tail coefficients by quantile';
      methodSelect.disabled=share;methodSelect.title=share?'Distribution shares do not use a Pareto estimator.':'';
      const sig=JSON.stringify([getSpecificationSignature(),surveySelect.value,country,year,spending?.value,indicator,method,getDinaCapitalDefinition(),[...selectedVariables].sort(),getCEXIncome()]);if(sig===signature){charts.forEach(c=>c.resize());return;}signature=sig;
      charts.forEach(c=>c.destroy());charts=[];rows=[];grid.replaceChildren();
      const selected=surveySelect.value==='all'?actualSurveys:[surveySelect.value],format=x=>share?number(100*x,1)+'%':number(x,3),legendSeries=fiveSeries.filter(([key])=>selected.some(survey=>curves.some(c=>c.survey===survey&&(country==='all'||c.country===country)&&inYear(c.year)&&c.variable===(key==='consumption'?consumptionFor(survey):key))));
      legend.replaceChildren();legendSeries.forEach(([key,label])=>{const item=document.createElement('label'),swatch=document.createElement('i');{item.className='threshold-variable-choice';const input=document.createElement('input');input.type='checkbox';input.style.accentColor=colors[key];input.checked=selectedVariables.has(key);input.setAttribute('aria-label','Show '+label);input.addEventListener('change',()=>{input.checked?selectedVariables.add(key):selectedVariables.delete(key);signature='';render();});item.append(input);}swatch.style.background=colors[key];const variable=key==='consumption'?(spending?.value==='auto'?'consump_def1':spending?.value):key,chosenName=key==='consumption'&&selected.length===1&&selected[0]==='NIELSEN'?'Retail purchases':key==='consumption'&&spending?.value!=='auto'?(spendingOptions.find(o=>o.key===variable)?.label||label):label,name=selected.length===1&&isCEX(selected[0])?(sourceDisplay(selected[0])?.labels?.[variable]||chosenName):chosenName;item.append(swatch,document.createTextNode(name));
        if(!international&&key==='total_income'){
          const group=document.createElement('span');
          group.className='us-total-income-choice';
          group.append(item,createUSTotalIncomeHelp());
          legend.append(group);
        }else legend.append(item);});
      let any=false,scfShown=false,hfcsShown=false;
      for(const survey of selected){
        const supported=metadata.surveys?.[survey]?.profile_indicators||(referenceSurveys.has(survey)?metadata.surveys?.[survey]?.available_profile_indicators||['pareto']:null);
        if(supported&&!supported.includes(indicator))continue;
        const sourceContract=contractFor(survey,metadata),contract=survey==='FORBES'?{...sourceContract,profile_window:[.01,.90]}:share&&sourceContract.share_profile_window?{...sourceContract,profile_window:sourceContract.share_profile_window}:sourceContract,xMinimum=100*(contract.profile_window?.[0]??.70),xMaximum=100*(contract.profile_window?.[1]??.99),available=curves.filter(c=>c.survey===survey&&(country==='all'||c.country===country)&&inYear(c.year));if(!available.length)continue;
        const consumption=consumptionFor(survey);
        const consumptionLabel=survey==='NIELSEN'?'Retail purchases':(isCEX(survey)?sourceDisplay(survey)?.labels?.[consumption]:null)||(consumption==='consump_def1'?(survey==='HBS'?'Consumption including in-kind benefits':'Consumption'):spendingOptions.find(o=>o.key===consumption)?.label||'Expenditure');
        const cached=new Map(),referencesBySeries=new Map(),limits=[],series=seriesFor(survey).filter(([key])=>selectedVariables.has(key)),confidence=contract.ci_level||.90;
        let shownVariants=variants.filter(([variant])=>available.some(c=>canonicalStage(survey,c.variant||c.specification)===variant)).map(([variant,name])=>{const source=available.find(c=>(c.variant||c.specification)===variant)||available.find(c=>canonicalStage(survey,c.variant||c.specification)===variant),sourceVariant=source.variant||source.specification;return[sourceVariant,metadata.surveys?.[survey]?.profile_variant_labels?.[sourceVariant]||name];});
        let bankComparison=survey==='YODLEE'&&['consump_def1','expenditure'].includes(consumption);
        if(bankComparison){const comparisonVariants=[['raw','Expenditure before durable correction','active_unadjusted_same_sample','expenditure'],['raw','Durable correction: all categories','durables_all_with_carry','consump_def1'],['raw','Durable correction: four categories (paper)','durables_4_with_carry','consump_def1']].filter(([, ,authorVariant,variable])=>available.some(c=>c.author_variant===authorVariant&&c.variable===variable));if(comparisonVariants.length)shownVariants=comparisonVariants;else bankComparison=false;}
        if(!shownVariants.length)continue;
        for(const [key] of series){
          for(const [variant,,authorVariant,panelVariable] of shownVariants){
            const variable=key==='consumption'?(panelVariable||consumption):key;
            const options={survey,variant,country,year,variable,method,indicator,contract,authorVariant:chosenAuthorVariant(survey,variable,authorVariant),wealthAuthorVariant:survey==='SAEZ_ZUCMAN'?'dina_2022':authorVariant,minQ:contract.profile_window?.[0]??.70,maxQ:contract.profile_window?.[1]??.99},points=profiles(curves,options),ref=share?{mean:null,n:0}:reference(curves,options);
            cached.set(variant+'|'+(authorVariant||'')+'|'+key,points);referencesBySeries.set(variant+'|'+(authorVariant||'')+'|'+key,ref);points.forEach(p=>limits.push(p.lo??p.mean,p.hi??p.mean));if(finite(ref.mean))limits.push(ref.mean);
          }
        }
        const finiteLimits=limits.filter(finite);if(!finiteLimits.length)continue;
        const minimum=Math.min(...finiteLimits),maximum=Math.max(...finiteLimits),pad=Math.max((maximum-minimum)*.04,share?.01:ratio?.03:.05),step=share?(maximum-minimum<=.7?.05:.1):ratio?.25:.5,ymin=Math.floor((minimum-pad)/step)*step,ymax=Math.ceil((maximum+pad)/step)*step;
        const group=document.createElement('div');group.className='threshold-survey-group';
        const title=document.createElement('h3');title.textContent=surveyLabel(survey)+(international&&country!=='all'?' · '+(available[0].country_name||country):'')+(year!=='all'?' · '+periodLabel:'');group.append(title);
        const panels=document.createElement('div');panels.className='threshold-adjustment-panels';panels.style.setProperty('--profile-panels',shownVariants.length);group.append(panels);grid.append(group);
        if(survey==='SCF')scfShown=true;if(survey==='HFCS')hfcsShown=true;
        let showYTitle=true;
        for(const [variant,variantName,authorVariant,panelVariable] of shownVariants){
          const panel=document.createElement('div');panel.className='threshold-profile-panel';const heading=document.createElement('h4');heading.textContent=variantName;if(bankComparison){const help=document.createElement('span');help.className='help-marker hover-help';help.tabIndex=0;help.textContent='?';help.setAttribute('aria-label','About '+variantName);help.dataset.tooltip=authorVariant==='durables_4_with_carry'?'Paper benchmark: ATM/cash withdrawals, check payments, loans and other expenses. Large transactions contribute 20% annual service flows; the remaining stock carries forward.':authorVariant==='durables_all_with_carry'?'The saved durable-service conversion applies across all transaction categories, with carry-over.':'The same active sample before converting unusually large spending to durable-service flows.';heading.append(' ',help);}panel.append(heading);
          const wrap=document.createElement('div');wrap.className='threshold-chart-wrap';const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',surveyLabel(survey)+' '+variantName+' '+(share||ratio?yTitle:method+' '+yTitle)+' by quantile'+(year==='all'?' averaged across available waves':periodLabel.includes('–')?' averaged across available waves in '+periodLabel:' in '+periodLabel));wrap.append(canvas);panel.append(wrap);
          const references=document.createElement('div');references.className='threshold-references';panel.append(references);panels.append(panel);
          const datasets=[];let hasData=false;
          for(const [key,label] of series){
            const variable=key==='consumption'?(panelVariable||consumption):key,name=key==='consumption'?(bankComparison?(variable==='expenditure'?'Expenditure':'Consumption'):consumptionLabel):(isCEX(survey)?sourceDisplay(survey)?.labels?.[variable]:null)||(survey==='HBS'&&key==='total_income'?'Net monetary household income':label),color=colors[key],points=cached.get(variant+'|'+(authorVariant||'')+'|'+key),ref=referencesBySeries.get(variant+'|'+(authorVariant||'')+'|'+key);if(!points.some(point=>finite(point.mean)))continue;hasData=true;any=true;
            if(!share&&finite(ref.mean)){const chip=document.createElement('span');chip.style.color=color;chip.textContent=name+' KS '+format(ref.mean)+(ref.n_flagged?' †':'');chip.title='Mean of '+ref.n+' source-selected '+(ratio?'KS coefficient ratios':'KS coefficients')+(ref.n_flagged?' including '+ref.n_flagged+' estimates with low statistical reliability under Eurostat HBS guidance':'');references.append(chip);}
            const cells=selectedCells(curves,{survey,variant,country,year,variable,contract,authorVariant:chosenAuthorVariant(survey,variable,authorVariant)}),years=[...new Set(cells.map(c=>c.year))].sort((a,b)=>a-b),sourceVariants=[...new Set(cells.map(c=>c.author_variant).filter(Boolean))].join(';'),sourceDatasets=[...new Set(cells.map(c=>c.source_dataset).filter(Boolean))].join(';');
            points.forEach(p=>rows.push({survey,housing_method:referenceSurveys.has(survey)?'not_applicable':getHousingMethod(),source_housing_method:referenceSurveys.has(survey)?'not_applicable':metadata.housing_method_aliases?.[survey]?.[getHousingMethod()]||getHousingMethod(),country,year_selection:year,adjustment_selection:'all',adjustment_stage:canonicalStage(survey,variant),variant,author_variants:sourceVariants,capital_income_definition:survey==='SAEZ_ZUCMAN'&&['total_capital_income','total_income'].includes(variable)?getDinaCapitalDefinition():'',tail_unit_type:metadata.surveys?.[survey]?.tail_unit||'',source_datasets:sourceDatasets,comparison_construction:authorVariant||'',construction_label:bankComparison?variantName:'',variable,indicator,method:share?'not applicable':method,quantile:p.q,threshold_percentile:100*p.q,mean_estimate:p.mean,standard_error:p.se,ci_lower:p.lo,ci_upper:p.hi,confidence_level:confidence,n_cells:p.n,n_effective:p.n_eff,minimum_tail_units_per_cell:p.min_tail_units,low_reliability_cells:p.n_flagged,reliability:p.n_flagged?'low_support':null,cell_unit:survey==='FORBES'?'listed-country-year':international?'country-wave':survey==='SAEZ_ZUCMAN'?'year':'wave',cell_weighting:contract.aggregation,ks_selected_mean:share?null:ref.mean,ks_reference_cells:share?null:ref.n,ks_reference_reliability:ref.n_flagged?'low_support':null,years_used_at_quantile:p.years_used,reference_years_used_at_quantile:p.reference_years_used,countries_used_at_quantile:p.countries_used,source_years_available:years.join(';'),cells_used_at_quantile:p.cells_used,stage_comparison:referenceSurveys.has(survey)?'Source reference only; no survey adjustment stages':'stage-specific available cells, following source figure'}));
            const xy=field=>points.map(p=>({x:100*p.q,y:p[field]??null,...p}));
            datasets.push({label:name+' lower interval',data:xy('lo'),borderWidth:0,pointRadius:0,backgroundColor:color+'17',isAuxiliary:true,order:3});
            datasets.push({label:name+' upper interval',data:xy('hi'),borderWidth:0,pointRadius:0,backgroundColor:color+'17',fill:'-1',isAuxiliary:true,order:3});
            datasets.push({label:name,data:xy('mean'),borderColor:color,backgroundColor:color,borderWidth:2,pointRadius:point=>point.raw?.n_flagged?3:0,pointHitRadius:8,isProfile:true,order:1,spanGaps:false});
            if(!share&&finite(ref.mean))datasets.push({label:name+' mean KS optimum',data:[{x:xMinimum,y:ref.mean},{x:xMaximum,y:ref.mean}],borderColor:color+'c0',borderDash:[6,5],borderWidth:1.2,pointRadius:0,isAuxiliary:true,order:2});
          }
          if(!hasData){wrap.classList.add('threshold-chart-empty');wrap.textContent='No '+(share?'shares':ratio?'wealth-normalized estimates':'estimates')+' are available for this selection.';continue;}
          charts.push(new Chart(canvas,{type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{display:false},tooltip:{filter:item=>item.dataset.isProfile,callbacks:{title:items=>items.length?(share?'Above P':'Threshold P')+number(items[0].raw.x,2):'',label:ctx=>ctx.dataset.label+': '+format(ctx.raw.y),afterLabel:ctx=>['N = '+ctx.raw.n+' '+(international?'country-wave cells':referenceSurveys.has(survey)?'years':'waves')+(contract.aggregation==='population'?' · effective N = '+number(ctx.raw.n_eff,2):''),finite(ctx.raw.lo)?number(100*confidence,0)+'% t interval: '+format(ctx.raw.lo)+' to '+format(ctx.raw.hi):'Across-cell interval unavailable (one cell)',...(finite(ctx.raw.min_tail_units)?['Minimum tail units per cell: '+number(ctx.raw.min_tail_units,0)]:[]),...(ctx.raw.n_flagged?[ctx.raw.n_flagged+' low-reliability country-wave cell(s)']:[])]}}},scales:{x:{type:'linear',min:xMinimum,max:xMaximum,title:{display:true,text:share?'Distribution percentile':'Threshold percentile',font:{size:13}},ticks:{font:{size:13},stepSize:5,maxRotation:0},grid:{display:false}},y:{min:ymin,max:ymax,title:{display:showYTitle,text:yTitle,font:{size:13}},ticks:{font:{size:13},stepSize:step,autoSkip:false,callback:value=>share?number(100*value,0)+'%':ratio?number(value,2):number(value,1)},grid:{color:'#eeece7'},border:{display:false}}}}}));
          showYTitle=false;
        }
      }
      exportButton.disabled=!rows.length;
      if(!any){if(!selectedVariables.size){note.textContent='Select at least one variable to display.';return;}note.textContent=surveySelect.value==='CEX_BM'&&getHousingMethod()==='bp'?'CEX B&M retains its original homeowner-service construction. Turn off the constant-housing option to view the original B&M results.':'No '+(share?'share curves':'threshold profiles')+' are available for these filters. Uncomputed series are not substituted.';return;}
      const referenceOnly=selected.every(survey=>referenceSurveys.has(survey)),cells=international?'country–wave cells':referenceOnly?'years':'waves';
      note.textContent=(year.includes('-')?'Results average the available waves from '+periodLabel+'. ':'')+'Shaded bands are pointwise 90% Student-t intervals for the mean at each percentile, based on variation across the available '+cells+'. '+(share?'':ratio?'Dashed lines and labels average within-cell ratios of the variable’s and wealth’s separately KS-selected coefficients. ':'Dashed lines and labels average the coefficients selected separately by the KS criterion in each '+(international?'country–wave cell':referenceOnly?'year':'wave')+'. ')+(scfShown?'SCF estimates are first averaged across its five imputations. ':'')+(hfcsShown?'HFCS estimates are first averaged across its five imputations; country–wave summaries use population weights.':'')+(rows.some(row=>row.reliability==='low_support'||row.ks_reference_reliability==='low_support')?' Dots and † mark HBS estimates using at least one country-wave with low statistical reliability.':'')+(getCEXIncome()&&selected.includes('CEX_BM_RECON')?' CEX income estimates from 2004 onward average five imputations within each wave.':'');
    }
    if(typeof initializeMobileFilters==='function')initializeMobileFilters(host);
    return{render,addCurves,resize:()=>charts.forEach(c=>c.resize())};
  }
  return{summarize,t975,tCritical,profiles,reference,contractFor,commonCells,create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ThresholdProfiles;
