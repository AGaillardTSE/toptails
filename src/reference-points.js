/* Released aggregate references; no underlying observation records. */
function initUSReferencePoints(metadata,{getCapitalVariant=()=> 'dina_2022_incl_gains'}={}) {
  const points=metadata.us_reference_points||[],curves=[...(metadata.us_reference_curves||[])],finite=Number.isFinite;
  const labels={YODLEE:'Yodlee (bank data)',NIELSEN:'NielsenIQ',FORBES:'Forbes',SAEZ_ZUCMAN:'Saez–Zucman (DINA)'},sources=[...new Set(points.map(r=>r.survey))].filter(Boolean);
  const exactKey=r=>[r.survey,r.year,r.variable,r.author_variant].join('|'),simpleKey=r=>[r.survey,r.year,r.variable].join('|'),index=new Map(curves.map(c=>[exactKey(c),c])),simpleIndex=new Map(curves.map(c=>[simpleKey(c),c]));
  const curveFor=row=>index.get(exactKey(row))||(row.survey==='FORBES'?simpleIndex.get(simpleKey(row)):null);
  const selectedDefinitionFor=(row,variant)=>row.survey!=='SAEZ_ZUCMAN'||row.variable!=='total_capital_income'||row.author_variant===variant;
  const selectedDefinition=row=>selectedDefinitionFor(row,getCapitalVariant());
  const timeCapitalVariant=metadata.saez_zucman_reference?.capital_income_definitions?.including_fiscal_gains?.author_variant||'dina_2022_incl_gains';
  const supportsMetric=(survey,metric)=>(metadata.surveys?.[survey]?.available_metrics||['pareto']).includes(metric);
  const hasVariable=(survey,variable)=>points.some(row=>row.survey===survey&&row.variable===variable&&selectedDefinition(row));
  function addCurves(rows){rows.forEach(c=>{const key=exactKey(c),j=curves.findIndex(row=>exactKey(row)===key);if(j<0)curves.push(c);else curves[j]=c;index.set(key,c);simpleIndex.set(simpleKey(c),c);});}
  function at(row,method,rule,q) {
    if(String(rule).toLowerCase()==='ks')return row.method===method?{...row}:null;
    if(row.survey==='FORBES'&&q>.9000001)return null;
    const c=curveFor(row);if(!c)return null;
    let j=c.qs.findIndex(v=>Math.abs(v-q)<1e-7);const m=method.toLowerCase();
    if(j<0&&row.survey==='YODLEE'&&q>=.99)j=c.qs.reduce((best,value,i)=>value<=q&&(!finite(c.qs[best])||value>c.qs[best])?i:best,-1);
    if(j<0||!finite(c[m]?.[j]))return null;
    return {...row,method,estimate:c[m][j],threshold_rule:'fixed',threshold_quantile:c.qs[j],ks:c['maxks_'+m]?.[j]??null,n_tail:c.n_tail?.[j]??row.n_tail??null};
  }
  function hasThreshold(survey,method,rule,customQ=.95){
    const q=rule==='custom'?customQ:Number(rule?.slice(1))/100;
    return points.some(row=>{if(row.survey!==survey||row.method!==method||!selectedDefinition(row))return false;
      if(String(rule).toLowerCase()==='ks')return finite(row.estimate);
      if(survey==='FORBES'&&q>.9000001)return false;
      const c=curveFor(row);return !!at(row,method,rule,q)||!!(c?.curve_pending&&c.available_methods?.includes(method)&&c.qs?.some(value=>Math.abs(value-q)<1e-7));
    });
  }
  function withWealth(row,state){
    if(row.survey!=='SAEZ_ZUCMAN')return row;
    const seed=points.find(p=>p.survey===row.survey&&p.year===row.year&&p.variable==='networth_val'&&p.method===row.method&&p.author_variant==='dina_2022');
    const rule=state?.threshold||row.threshold_rule,q=state?state.threshold==='custom'?state.customQ:Number(state.threshold?.slice(1))/100:row.threshold_quantile;
    const wealth=seed?at(seed,row.method,rule,q):null,value=wealth?.estimate;
    return {...row,wealth_pareto_estimate:value??null,tail_to_wealth:finite(row.estimate)&&finite(value)&&value>0?row.estimate/value:null};
  }
  function selected(state,{defaults=true,capitalVariant=getCapitalVariant()}={}){
    const rule=state.threshold,q=rule==='custom'?state.customQ:Number(rule?.slice(1))/100,chosen=new Map();
    points.filter(p=>selectedDefinitionFor(p,capitalVariant)&&(p.survey==='SAEZ_ZUCMAN'||!defaults||p.default_reference)).map(p=>at(p,state.method,rule,q)||(!defaults&&p.survey==='SAEZ_ZUCMAN'&&p.method===state.method?{...p,estimate:null,threshold_rule:rule,threshold_quantile:q,ks:null,n_tail:null}:null)).filter(Boolean).forEach(p=>chosen.set([exactKey(p),p.method,p.threshold_rule,p.threshold_quantile].join('|'),withWealth(p,state)));
    return [...chosen.values()];
  }
  function plotted(state){
    const variable={flow:'consump_def1',expenditure:'expenditure',expenditure_incl_rent:'expenditure',food_total:'food_total',vacation:'vacation'}[state.measure];
    const annual=new Map();if(!['pareto','pareto_wealth_ratio'].includes(state.metric))points.filter(p=>selectedDefinitionFor(p,timeCapitalVariant)).forEach(p=>{if(finite(p[state.metric]))annual.set([p.survey,p.year,p.variable,p.author_variant].join('|'),{...p,estimate:p[state.metric],pareto_estimate:null,method:'not_applicable',threshold_rule:'not_applicable',threshold_quantile:null,ks:null,n_tail:null});});
    return (['pareto','pareto_wealth_ratio'].includes(state.metric)?selected(state,{capitalVariant:timeCapitalVariant}):[...annual.values()]).filter(p=>state.overlays.has(p.survey.toLowerCase())&&supportsMetric(p.survey,state.metric)).filter(p=>p.survey==='SAEZ_ZUCMAN'?state.variables.has(p.variable):p.survey==='FORBES'?state.variables.has('networth_val')&&p.variable==='networth_val':state.variables.has('spending')&&variable&&((p.survey==='NIELSEN'&&state.measure==='food_total')||p.variable===variable)).map(p=>state.metric==='pareto_wealth_ratio'?{...p,pareto_estimate:p.estimate,estimate:p.tail_to_wealth}:p).filter(p=>finite(p.estimate));
  }
  const pointLabel=row=>[row.source_category,row.source_label].filter(Boolean).join(' · ');
  function datasets(state){
    const groups=new Map();plotted(state).forEach(p=>{const key=[p.survey,p.variable,p.author_variant].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});
    return [...groups.values()].map(rows=>{const survey=rows[0].survey,forbes=survey==='FORBES',nielsen=survey==='NIELSEN',dina=survey==='SAEZ_ZUCMAN',color=dina?({total_labor_income:'#BF5555',total_capital_income:'#C4A12A',networth_val:'#4D8B69'})[rows[0].variable]:forbes?'#008F5A':'#477EAD';
      return {label:pointLabel(rows[0]),survey,key:dina?rows[0].variable:forbes?'networth_val':'spending',variable:rows[0].variable,isReference:true,type:'line',order:forbes?-100:-20,showLine:true,spanGaps:false,data:rows.sort((a,b)=>a.year-b.year).map(r=>({x:r.year,y:r.estimate,q:r.threshold_quantile,maxks:r.ks,n_tail:r.n_tail,author_variant:r.author_variant})),borderColor:color,backgroundColor:color,borderDash:dina?[10,3,2,3]:forbes?[8,4]:nielsen?[5,4]:[],borderWidth:1.8,pointBorderColor:forbes?'#fffefa':color,pointBackgroundColor:dina?'#fffefa':color,pointStyle:forbes||dina?'rect':survey==='YODLEE'?'cross':'crossRot',pointRadius:dina?4.5:forbes?6.5:7,pointHoverRadius:forbes?9.5:9,pointHitRadius:forbes?12:9,pointBorderWidth:forbes?2:1.7};
    });
  }
  function tableResults(state){return selected(state,{defaults:false}).filter(row=>state.datasets.has(row.survey)&&(row.survey!=='YODLEE'||state.yodleeVariant==='all'||row.author_variant===state.yodleeVariant)&&(state.variable==='all'||row.variable===state.variable));}
  function allResults(){const rows=[];points.filter(selectedDefinition).forEach(row=>{rows.push(withWealth({...row}));const c=curveFor(row);if(!c)return;c.qs.forEach(q=>{const fit=at(row,row.method,'fixed',q);if(fit)rows.push(withWealth(fit));});});return rows;}
  function profileCurves(){const chosen=new Map();points.filter(row=>row.survey==='SAEZ_ZUCMAN'||['YODLEE','FORBES'].includes(row.survey)&&(row.default_reference||row.survey==='YODLEE'&&['active_unadjusted_same_sample','durables_all_with_carry','durables_4_with_carry'].includes(row.author_variant)&&['consump_def1','expenditure'].includes(row.variable))).forEach(row=>{
      const key=exactKey(row),source=curveFor(row);if(!source)return;
      if(!chosen.has(key))chosen.set(key,{...source,survey:row.survey,country:'US',year:row.year,variable:row.variable,variant:row.survey==='YODLEE'?'raw':'reference',housing_method:'not_applicable',author_variant:row.author_variant,source_dataset:row.source_dataset||source.source_dataset,source_label:pointLabel(row),reference_only:true});
      chosen.get(key)['ks_'+row.method.toLowerCase()]={estimate:row.estimate,q:row.threshold_quantile,maxks:row.ks,n_tail:row.n_tail??null};
    });return [...chosen.values()];}
  return {sources,labels,datasets,plotted,tableResults,allResults,profileCurves,addCurves,hasThreshold,hasVariable,supportsMetric,allPoints:()=>points.filter(selectedDefinition)};
}
if(typeof module!=='undefined'&&module.exports)module.exports=initUSReferencePoints;
