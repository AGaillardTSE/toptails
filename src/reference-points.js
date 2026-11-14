/* Published or author-routine aggregate references; no household data. */
function initUSReferencePoints(metadata) {
  const points=metadata.us_reference_points||[],curves=metadata.us_reference_curves||[],finite=x=>typeof x==='number'&&Number.isFinite(x),number=(x,d=3)=>finite(x)?x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const labels={YODLEE:'Yodlee (bank data)',NIELSEN:'NielsenIQ',FORBES:'Forbes'},sources=[...new Set(points.map(r=>r.survey))].filter(Boolean),exactKey=r=>[r.survey,r.year,r.variable,r.author_variant].join('|'),simpleKey=r=>[r.survey,r.year,r.variable].join('|'),index=new Map(curves.map(c=>[exactKey(c),c])),simpleIndex=new Map(curves.map(c=>[simpleKey(c),c])),curveFor=row=>index.get(exactKey(row))||(row.survey==='FORBES'?simpleIndex.get(simpleKey(row)):null);
  function at(row,method,rule,q) {
    if(String(rule).toLowerCase()==='ks')return row.method===method?{...row}:null;
    if(row.survey==='FORBES'&&q>.9000001)return null;
    const c=curveFor(row);if(!c)return null;
    let j=c.qs.findIndex(v=>Math.abs(v-q)<1e-7);const m=method.toLowerCase();if(j<0&&row.survey==='YODLEE'&&q>=.99)j=c.qs.reduce((best,value,i)=>value<=q&&(!finite(c.qs[best])||value>c.qs[best])?i:best,-1);if(j<0||!finite(c[m]?.[j]))return null;
    return {...row,method,estimate:c[m][j],threshold_rule:'fixed',threshold_quantile:c.qs[j],ks:c['maxks_'+m]?.[j]??null};
  }
  function selected(state,{defaults=true}={}) {
    const rule=state.threshold,q=rule==='custom'?state.customQ:Number(rule?.slice(1))/100,chosen=new Map();points.filter(p=>!defaults||p.default_reference).map(p=>at(p,state.method,rule,q)).filter(Boolean).forEach(p=>chosen.set([p.survey,p.year,p.variable,p.author_variant,p.method,p.threshold_rule,p.threshold_quantile].join('|'),p));return [...chosen.values()];
  }
  function plotted(state) {
    const variable={flow:'consump_def1',expenditure:'expenditure',expenditure_incl_rent:'expenditure',food_total:'food_total',vacation:'vacation'}[state.measure];
    if(state.metric!=='pareto')return [];
    return selected(state).filter(p=>state.overlays.has(p.survey.toLowerCase())).filter(p=>p.survey==='FORBES'?state.variables.has('networth_val')&&p.variable==='networth_val':state.variables.has('spending')&&variable&&((p.survey==='NIELSEN'&&state.measure==='food_total')||p.variable===variable));
  }
  const pointLabel=row=>[row.source_category,row.source_label].filter(Boolean).join(' · ');
  function datasets(state) {
    const chosen=plotted(state),groups=new Map();chosen.forEach(p=>{const key=[p.survey,p.variable,p.author_variant].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});
    return [...groups.values()].map(rows=>{const survey=rows[0].survey,forbes=survey==='FORBES',nielsen=survey==='NIELSEN',color=forbes?'#008F5A':'#477EAD';return{label:pointLabel(rows[0]),survey,key:forbes?'networth_val':'spending',variable:rows[0].variable,isReference:true,type:'line',order:forbes?-100:-20,showLine:true,spanGaps:false,data:rows.sort((a,b)=>a.year-b.year).map(r=>({x:r.year,y:r.estimate,q:r.threshold_quantile,maxks:r.ks,author_variant:r.author_variant})),borderColor:color,backgroundColor:color,borderDash:forbes?[8,4]:nielsen?[5,4]:[],borderWidth:1.8,pointBorderColor:forbes?'#fffefa':color,pointBackgroundColor:color,pointStyle:forbes?'rect':survey==='YODLEE'?'cross':'crossRot',pointRadius:forbes?6.5:7,pointHoverRadius:forbes?9.5:9,pointHitRadius:forbes?12:9,pointBorderWidth:forbes?2:1.7};});
  }
  function tableResults(state){return selected(state,{defaults:false}).filter(row=>state.datasets.has(row.survey)&&(row.survey!=='YODLEE'||state.yodleeVariant==='all'||row.author_variant===state.yodleeVariant)&&(state.variable==='all'||row.variable===state.variable));}
  function allResults(){
    const rows=[];points.forEach(row=>{rows.push({...row});const c=curveFor(row),m=row.method.toLowerCase();if(!c)return;c.qs.forEach((q,j)=>{if(row.survey==='FORBES'&&q>.9000001)return;if(finite(c[m]?.[j]))rows.push({...row,threshold_rule:'fixed',threshold_quantile:q,estimate:c[m][j],ks:c['maxks_'+m]?.[j]??null});});});return rows;
  }
  function profileCurves(){
    const chosen=new Map();
    points.filter(row=>['YODLEE','FORBES'].includes(row.survey)&&(row.default_reference||row.survey==='YODLEE'&&['active_unadjusted_same_sample','durables_all_with_carry','durables_4_with_carry'].includes(row.author_variant)&&['consump_def1','expenditure'].includes(row.variable))).forEach(row=>{
      const key=[row.survey,row.year,row.variable,row.author_variant].join('|'),source=curveFor(row);if(!source)return;
      if(!chosen.has(key))chosen.set(key,{...source,survey:row.survey,country:'US',year:row.year,variable:row.variable,variant:row.survey==='FORBES'?'reference':'raw',housing_method:'not_applicable',author_variant:row.author_variant,source_dataset:row.source_dataset||source.source_dataset,source_label:pointLabel(row),reference_only:true});
      chosen.get(key)['ks_'+row.method.toLowerCase()]={estimate:row.estimate,q:row.threshold_quantile,maxks:row.ks,n_tail:row.n_tail??null};
    });return [...chosen.values()];
  }
  return {sources,labels,datasets,plotted,tableResults,allResults,profileCurves,allPoints:()=>points};
}
