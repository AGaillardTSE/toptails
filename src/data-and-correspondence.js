function initDataAndCorrespondence(metadata) {
  const doc=document,byId=id=>doc.getElementById(id),dataRoot=byId('panel-data'),adjustmentsRoot=byId('panel-adjustments');
  const correspondences=Array.isArray(metadata?.account_correspondences)?metadata.account_correspondences:[],datasets=Array.isArray(metadata?.dataset_limitations)?metadata.dataset_limitations:[];
  const archivedSurveys=new Set(['CEX','CEX_BM']);
  const essentialNotes={
    PSID:{label:'PSID',coverage:'Biennial waves, 2005–2023.',unit:'Family unit.',limitations:['Longitudinal panel with broad consumption, income and wealth coverage; construction includes imputations and modeled housing and durable services.','Mapped wealth excludes employer pension entitlements.']},
    SCF:{label:'SCF',coverage:'Triennial survey; spending detail varies by wave.',unit:'Primary economic unit (family).',limitations:['Strong wealth coverage; consumption coverage is limited.','Five imputed datasets are averaged. Original survey weights are retained.']},
    CEX_BM_RECON:{label:'CEX',coverage:'1996–2024.',unit:'Consumer unit; partial wealth uses final-interview records.',limitations:['Detailed spending data; income and wealth coverage is limited.','Retains the Meyer–Sullivan equivalence scale and person weights.']},
    HFCS:{label:'HFCS',coverage:'Available waves vary by country.',unit:'Household.',limitations:['Harmonized European survey with country-specific account definitions and coverage.','Labor income includes pensions and transfers; wealth uses three broad matched groups.']},
    HILDA:{label:'HILDA',coverage:'2006–2022; wealth is observed in five waves.',unit:'Household.',limitations:['Australian household panel; spending combines expenditure with durable-service proxies.','Labor income includes government transfers; wealth uses four broad groups.']},
    SHIW:{label:'SHIW',coverage:'1998–2022.',unit:'Household.',limitations:['Italian household survey with a net-of-tax income construction.','Health and financial services are omitted from the selected consumption control basket.']},
    YODLEE:{label:'Yodlee (bank data)',coverage:'2014–2019; coverage varies by spending measure.',unit:'Bank–individual account.',limitations:['Observes each person’s account within the sampled banking system, rather than a complete household.','Spending outside observed accounts is missing; SCF income weights improve representativeness.']},
    NIELSEN:{label:'NielsenIQ',coverage:'2004–2023.',unit:'Household retail-purchase panel.',limitations:['Retail purchases have limited consumption coverage. Available only with “Food” under “Variable for consumption”.']}
  };
  const visibleDatasets=datasets.filter(row=>!archivedSurveys.has(row.survey)).map(row=>({...row,...essentialNotes[row.survey]}));
  if(metadata.forbes_reference)visibleDatasets.push({survey:'FORBES',label:'Forbes',coverage:'United States, 1982–2024.',unit:'Distinct listed person or family fortune.',limitations:['Combines World’s Billionaires and Forbes 400; overlapping fortunes are counted once.','Rich-list wealth only. Valuation dates and historical coverage differ.']});
  const datasetCountries=new Map(),dataCountries=new Map();correspondences.forEach(row=>{if(!row.country||archivedSurveys.has(row.survey))return;const country=String(row.country);dataCountries.set(country,row.country_name||country);if(!datasetCountries.has(row.survey))datasetCountries.set(row.survey,new Set());datasetCountries.get(row.survey).add(country);});datasetCountries.set('FORBES',new Set(['US']));visibleDatasets.forEach(row=>{if(row.country&&!datasetCountries.has(row.survey)){datasetCountries.set(row.survey,new Set([row.country]));dataCountries.set(row.country,row.country_name||row.country);}});
  const domainNames={consumption:'Consumption',income:'Income',wealth:'Wealth'},state={view:'procedure',dataCountry:'US',consumption:{country:'US',survey:'PSID'},income:{country:'US',survey:'PSID'},wealth:{country:'US',survey:'PSID'}};
  const nodes={},el=(tag,className,text)=>{const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
  const strings=x=>Array.isArray(x)?x.filter(v=>v!==undefined&&v!==null).map(v=>typeof v==='string'?v:v.label||v.description||v.name||v.code||String(v)):x?[String(x)]:[];
  const surveyName=survey=>datasets.find(r=>r.survey===survey)?.label||metadata?.surveys?.[survey]?.label||survey;
  const choices=(select,rows,current)=>{select.replaceChildren();rows.forEach(([value,label])=>{const o=el('option','',label);o.value=value;select.append(o);});const next=rows.some(r=>r[0]===current)?current:rows[0]?.[0]||'';select.value=next;return next;};
  const control=(label,id)=>{const box=el('label','dc-control');box.htmlFor=id;box.append(el('span','dc-control-label',label));const select=el('select');select.id=id;box.append(select);return {box,select};};
  const bullets=(items,className='dc-limit-list')=>{const list=el('ul',className);strings(items).forEach(value=>list.append(el('li','',value)));return list;};
  function renderData(){
    if(!dataRoot)return;const rows=visibleDatasets.filter(row=>datasetCountries.get(row.survey)?.has(state.dataCountry)),grid=nodes.datasetGrid;grid.replaceChildren();
    rows.forEach(row=>{const card=el('article','dc-dataset-card');card.dataset.survey=row.survey;card.append(el('h3','',row.label||surveyName(row.survey)));const facts=el('dl','dc-data-facts');[['Coverage',row.coverage],['Unit',row.unit]].forEach(([label,value])=>{if(!value)return;facts.append(el('dt','',label),el('dd','',strings(value).join(' ')));});if(facts.childNodes.length)card.append(facts);if(strings(row.limitations).length)card.append(bullets(row.limitations));grid.append(card);});
    if(!rows.length)grid.append(el('p','dc-empty','No data description is available for this selection.'));
  }
  function sourceVariable(value,row){
    const item=el('div','dc-source-variable'),object=value&&typeof value==='object'?value:null,raw=object?.code||object?.name||String(value),description=object?.description||object?.label||row.source_descriptions?.[raw];
    if(description){item.append(el('code','',raw),el('span','dc-variable-meaning',description));}
    else if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)){item.append(el('code','',raw));if((row.source_variables||[]).length===1&&row.title&&row.title.toLowerCase()!==raw.toLowerCase())item.append(el('span','dc-variable-meaning',row.title));}
    else item.append(el('span','dc-variable-meaning',raw));
    return item;
  }
  function mappingRows(row){
    const main=el('tr','dc-mapping-row'),label=el('th','dc-row-component',row.title||''),source=el('td','dc-row-source'),connection=el('td','dc-row-link'),target=el('td','dc-row-target');label.scope='row';
    (row.source_variables||[]).forEach(value=>source.append(sourceVariable(value,row)));if(!source.childNodes.length)source.append(el('span','dc-unmatched','Not separately identified'));
    const line=el('span','dc-row-connector');line.setAttribute('aria-hidden','true');connection.append(line);
    strings(row.aggregate_targets).forEach(value=>target.append(el('div','dc-account-item',value)));if(!target.childNodes.length)target.append(el('span','dc-unmatched','No separate aggregate target'));
    main.append(label,source,connection,target);const result=[main];
    if(row.rule||strings(row.limitations).length){const detail=el('tr','dc-map-detail-row'),cell=el('td','dc-row-detail');cell.colSpan=4;const contents=el('div','dc-row-notes');if(row.rule)contents.append(el('p','dc-map-rule',row.rule));if(strings(row.limitations).length){const scope=el('details','dc-scope-notes'),summary=el('summary','','Scope and limitations');scope.append(summary,bullets(row.limitations,'dc-map-limitations'));contents.append(scope);}cell.append(contents);detail.append(cell);result.push(detail);}
    return result;
  }
  function renderDomain(domain){
    const n=nodes[domain];if(!n)return;const rows=correspondences.filter(r=>r.domain===domain&&!archivedSurveys.has(r.survey)),countries=new Map();rows.forEach(r=>countries.set(String(r.country),r.country_name||r.country));const countryOptions=[...countries].sort((a,b)=>a[1].localeCompare(b[1]));if(countries.has('US')){const i=countryOptions.findIndex(r=>r[0]==='US');countryOptions.unshift(...countryOptions.splice(i,1));}
    state[domain].country=choices(n.country,countryOptions,state[domain].country);const inCountry=rows.filter(r=>String(r.country)===state[domain].country),surveys=[...new Set(inCountry.map(r=>r.survey))].sort((a,b)=>surveyName(a).localeCompare(surveyName(b)));
    state[domain].survey=choices(n.survey,surveys.map(s=>[s,surveyName(s)]),state[domain].survey);n.country.disabled=!countryOptions.length;n.survey.disabled=!surveys.length;n.body.replaceChildren();
    const selected=inCountry.filter(r=>r.survey===state[domain].survey);n.table.hidden=!selected.length;n.empty.hidden=!!selected.length;n.sourceHeading.textContent=(metadata?.surveys?.[state[domain].survey]?.label||state[domain].survey||'Survey')+' variables';selected.forEach(r=>n.body.append(...mappingRows(r)));
  }
  function enhanceProcedure(panel){
    panel.classList.add('dc-visual-procedure');const operations=panel.querySelectorAll('.fixed-point-operation');
    operations.forEach((operation,index)=>{const number=el('span','dc-operation-step',index===0?'Rescaling by matching national accounts':'Reweighting: match a benchmark income or wealth distribution');operation.prepend(number);const visual=operation.querySelector('.operation-visual');if(!visual)return;visual.replaceChildren();visual.className='dc-step-visual '+(index===0?'dc-reporting-visual':'dc-representation-visual');
      if(index===0){const legend=el('div','dc-mini-legend');legend.append(el('span','','Weighted survey totals'),el('span','','Account targets'));visual.append(legend);[42,66,52].forEach((width,j)=>{const row=el('div','dc-rescale-row');row.append(el('span','dc-mini-label',['Category k','Category ℓ','Category m'][j]));const track=el('span','dc-rescale-track'),bar=el('i','dc-rescale-bar'),target=el('i','dc-rescale-target');bar.style.width=width+'%';track.append(bar,target);row.append(track,el('span','dc-mini-factor',['λk','λℓ','λm'][j]+' →'));visual.append(row);});}
      else {const legend=el('div','dc-mini-legend dc-reweight-legend');legend.append(el('span','','Original weights'),el('span','','Matched bin mass of a benchmark distribution (IRS, SCF, WID data)'));visual.append(legend);const people=el('div','dc-people-comparison');for(const side of ['before','after']){const group=el('div','dc-people-group '+side);for(let j=0;j<12;j++){const person=el('i','dc-person');person.style.setProperty('--person-weight',side==='before'?'1':[.7,.8,1.1,1.5][Math.floor(j/3)]);group.append(person);}people.append(group);if(side==='before')people.append(el('span','dc-people-arrow','→'));}visual.append(people);}
    });
    const detail=panel.querySelector('.fixed-point-detail');if(detail){const notes=el('details','dc-procedure-notes'),summary=el('summary','','Normalization and survey-specific implementation');notes.append(summary);detail.parentNode.insertBefore(notes,detail);notes.append(detail);}
  }
  function activate(view,focus=false){
    state.view=view;Object.entries(nodes.tabs||{}).forEach(([key,button])=>{const active=key===view;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('active',active);if(focus&&active)button.focus();});Object.entries(nodes.panels||{}).forEach(([key,panel])=>{panel.hidden=key!==view;});
    if(domainNames[view])renderDomain(view);if(['figures','distribution'].includes(view))requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new CustomEvent('adjustments-procedure-visible'));});
  }
  if(dataRoot){
    dataRoot.classList.add('dc-data-root');dataRoot.replaceChildren();const toolbar=el('div','dc-toolbar'),selector=control('Country','dc-data-country'),countryOptions=[...dataCountries].sort((a,b)=>a[0]==='US'?-1:b[0]==='US'?1:a[1].localeCompare(b[1]));state.dataCountry=choices(selector.select,countryOptions,state.dataCountry);selector.select.addEventListener('change',event=>{state.dataCountry=event.target.value;renderData();});toolbar.append(selector.box);nodes.datasetGrid=el('div','dc-dataset-grid');dataRoot.append(toolbar,nodes.datasetGrid);renderData();
    const noteElements=[toolbar,nodes.datasetGrid];
    if(typeof initSourceCatalogue==='function')initSourceCatalogue(dataRoot,noteElements);
  }
  if(adjustmentsRoot&&!byId('adjustment-procedure-panel')){
    const existing=[...adjustmentsRoot.childNodes],procedure=el('section','dc-procedure-panel');procedure.id='adjustment-procedure-panel';procedure.setAttribute('role','tabpanel');procedure.setAttribute('aria-labelledby','dc-tab-procedure');existing.forEach(n=>procedure.append(n));procedure.querySelector('.adjustment-results')?.remove();
    const figures=el('section','dc-figures-panel');figures.id='adjustment-figures-panel';figures.setAttribute('role','tabpanel');figures.setAttribute('aria-labelledby','dc-tab-figures');const figureSection=procedure.querySelector('#adjustment-figure-results');if(figureSection)figures.append(figureSection);
    const distribution=el('section','dc-distribution-panel');distribution.id='adjustment-distribution-panel';distribution.setAttribute('role','tabpanel');distribution.setAttribute('aria-labelledby','dc-tab-distribution');const distributionSection=procedure.querySelector('#adjustment-distribution-results');if(distributionSection)distribution.append(distributionSection);adjustmentsRoot.append(figures,distribution,procedure);enhanceProcedure(procedure);
    const nav=el('nav','secondary-nav cc-subnav dc-adjustment-nav');nav.setAttribute('aria-label','Methodology views');const navInner=el('div','secondary-nav-inner');navInner.id='dc-adjustments-nav-inner';navInner.setAttribute('role','tablist');navInner.setAttribute('aria-label','Methodology views');nav.append(navInner);nodes.tabs={};nodes.panels={figures,distribution,procedure};
    let navGroup;
    [['procedure','Procedure & Algorithm'],['figures','Over years'],['distribution','Along distributions'],...Object.entries(domainNames)].forEach(([domain,label])=>{
      if(domain==='figures'||domain==='consumption'||domain==='procedure'){
        navGroup=el('div','dc-nav-group'+(domain==='procedure'?' dc-nav-procedure':domain==='consumption'?' dc-nav-correspondence':''));navGroup.setAttribute('role','presentation');navInner.append(navGroup);
        if(domain!=='procedure')navGroup.append(el('strong','dc-nav-group-label',domain==='figures'?'Representation and reporting correction results:':'Correspondence tables:'));
      }
      const button=el('button','secondary-tab',label);button.type='button';button.id='dc-tab-'+domain;button.dataset.correspondenceTab=domain;button.setAttribute('role','tab');button.setAttribute('aria-controls',domain==='procedure'?procedure.id:domain==='figures'?figures.id:domain==='distribution'?distribution.id:'dc-panel-'+domain);button.addEventListener('click',()=>activate(domain));navGroup.append(button);nodes.tabs[domain]=button;
      if(!domainNames[domain])return;const panel=el('section','dc-domain-panel');panel.id='dc-panel-'+domain;panel.dataset.domain=domain;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.hidden=true;const toolbar=el('div','dc-toolbar'),country=control('Country','dc-country-'+domain),survey=control('Survey','dc-survey-'+domain);toolbar.append(country.box,survey.box);const scroll=el('div','dc-correspondence-scroll'),table=el('table','dc-correspondence-table'),head=el('thead'),headRow=el('tr'),sourceHeading=el('th','','Survey variables');headRow.append(el('th','','Component'),sourceHeading,el('th','dc-link-heading',''),el('th','','National accounts / controls'));head.append(headRow);const body=el('tbody');table.append(head,body);scroll.append(table);const empty=el('p','dc-empty','No source-verified correspondence is available for this selection.');empty.hidden=true;panel.append(toolbar,scroll,empty);adjustmentsRoot.append(panel);nodes.panels[domain]=panel;nodes[domain]={country:country.select,survey:survey.select,table,body,sourceHeading,empty};country.select.addEventListener('change',e=>{state[domain].country=e.target.value;renderDomain(domain);});survey.select.addEventListener('change',e=>{state[domain].survey=e.target.value;renderDomain(domain);});
    });
    nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...nav.querySelectorAll('button')];let index=buttons.indexOf(doc.activeElement);if(index<0)return;e.preventDefault();index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;activate(buttons[index].dataset.correspondenceTab,true);});
    adjustmentsRoot.prepend(nav);activate('procedure');
  }
  function render(){if(dataRoot&&!dataRoot.hidden)renderData();if(adjustmentsRoot&&!adjustmentsRoot.hidden&&domainNames[state.view])renderDomain(state.view);}
  return {render,resize:()=>{},isDecompositionVisible:()=>state.view==='figures',isProcedureVisible:()=>['figures','distribution'].includes(state.view),getView:()=>state.view};
}
