const US_TOTAL_INCOME_NOTE = 'Total income is only partly comparable across surveys. The series differ in whether and how they count realized capital gains, pensions, government transfers, and other income.';

function createUSTotalIncomeHelp() {
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'help-marker detail-help hover-help';
  help.dataset.tooltip = US_TOTAL_INCOME_NOTE;
  help.dataset.helpToggle = 'true';
  help.setAttribute('aria-label', 'About total-income comparability');
  help.setAttribute('aria-expanded', 'false');
  help.textContent = '?';
  return help;
}

function createUSQuantileComparison({
  host, surveys, loadCurves, metadata, spendingOptions, surveyName, surveyTooltip,
  getHousingMethod, onHousingChange, getWeightingMethod, onWeightingChange,
  getCapitalDefinition, onCapitalDefinitionChange, getCEXIncome, onCEXIncomeChange
}) {
  const style = {
    PSID: ['circle', []],
    SCF: ['rectRot', [7, 4]],
    CEX_BM_RECON: ['crossRot', [3, 4]],
    YODLEE: ['cross', [9, 4, 2, 4]],
    FORBES: ['rect', [11, 5]],
    SAEZ_ZUCMAN: ['triangle', [5, 3]],
  };
  const variables = [
    ['consumption','Consumption','#477eac'],
    ['total_labor_income','Labor income','#bf5555'],
    ['total_income','Total income','#a96f4b'],
    ['networth_val','Net worth','#4d8b69'],
    ['total_capital_income','Capital income','#a88421'],
  ];
  const selected = new Set(surveys.filter(survey => ['PSID','CEX_BM_RECON'].includes(survey)));
  const household = survey => ['PSID','SCF','CEX_BM_RECON'].includes(survey);
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const percentile = value => 'P' + number.format(value);
  const xMin = 70;
  const xMax = 99.25;

  host.classList.remove('quantile-profile-card');
  host.classList.add('explorer-grid');
  host.innerHTML = `<aside class="sidebar quantile-comparison-sidebar" aria-label="Quantile comparison controls">
    <div class="control dataset-control">
      <span class="control-label" id="quantile-v2-datasets-label">Datasets</span>
      <fieldset class="overlay-controls dataset-controls" aria-labelledby="quantile-v2-datasets-label"></fieldset>
    </div>
    <div class="adjustment-block"></div>
    <section class="indicator-block" aria-labelledby="quantile-v2-indicator-heading">
      <span class="control-label indicator-heading" id="quantile-v2-indicator-heading">Tail and concentration indicator</span>
      <div class="indicator-detail quantile-v2-pareto-options"></div>
    </section>
    <div class="quantile-comparison-options"></div>
  </aside>
  <div class="plot-surface quantile-comparison-plot">
    <header class="plot-top quantile-comparison-header">
      <div><h2>Compare estimates by quantile</h2><p class="plot-subtitle">Ten-year averages</p></div>
      <div class="chart-actions"><button class="text-button" data-action="csv" type="button">Profile CSV</button><button class="text-button" data-action="png" type="button">Figure PNG</button></div>
    </header>
    <div class="plot-series-controls">
      <span class="control-label series-label">Variables</span>
      <fieldset class="series-bar" aria-label="Variables to display"></fieldset>
    </div>
    <div class="quantile-comparison-body">
      <p class="quantile-comparison-status" role="status" hidden></p>
      <div class="quantile-comparison-chart"><canvas role="img" aria-label="Estimates by quantile for the selected U.S. datasets"></canvas></div>
      <div class="quantile-ks-summary" aria-live="polite" hidden></div>
      <p class="quantile-comparison-note"><em>Notes:</em> <span></span></p>
    </div>
  </div>`;

  const find = selector => host.querySelector(selector);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const sidebar = find('.quantile-comparison-sidebar');
  const adjustments = find('.adjustment-block');
  const indicators = find('.indicator-block');
  const paretoOptions = find('.quantile-v2-pareto-options');
  const options = find('.quantile-comparison-options');
  const datasetChoices = find('.dataset-controls');
  const status = find('.quantile-comparison-status');
  const subtitle = find('.plot-subtitle');
  const canvas = find('canvas');
  const csvButton = find('[data-action="csv"]');
  const pngButton = find('[data-action="png"]');
  const ksSummary = find('.quantile-ks-summary');
  const note = find('.quantile-comparison-note span');
  let chart, comparison = [], request = 0, pending, lastFilter, period;
  let selectedPeriod = '';

  function select(parent, key, title, values, onChange = render) {
    const box = make('div','control');
    const label = make('label','',title);
    const input = make('select');
    input.id = label.htmlFor = 'quantile-v2-' + key;
    input.append(...values.map(([value,text]) => new Option(text,value)));
    box.append(label,input);
    parent.append(box);
    input.addEventListener('change', () => onChange(input.value));
    return input;
  }

  function choice(parent, type, name, value, label, onChange) {
    const wrapper = make('label','small-check');
    const input = make('input');
    input.type = type;
    input.name = 'quantile-v2-' + name;
    input.value = value;
    input.addEventListener('change', () => onChange(input));
    wrapper.append(input,label);
    parent.append(wrapper);
    return {wrapper,input};
  }

  function radioGroup(parent, name, label, values, classes, onChange = render) {
    const fieldset = make('fieldset',classes);
    fieldset.setAttribute('aria-label',label);
    parent.append(fieldset);
    const inputs = values.map(([value,text]) => choice(fieldset,'radio',name,value,text,input => onChange(input.value)).input);
    inputs[0].checked = true;
    return {fieldset, inputs, get value(){return inputs.find(input=>input.checked).value;}};
  }

  function help(key, label) {
    const button = make('button','help-marker detail-help','?');
    button.type = 'button';
    button.dataset.helpControl = key;
    button.setAttribute('aria-label',label);
    button.setAttribute('aria-expanded','false');
    return button;
  }

  const range = select(sidebar,'year','Ten-year window',[],value => {
    selectedPeriod = value;
    render();
  });
  sidebar.insertBefore(range.closest('.control'),adjustments);
  const adjustment = select(adjustments,'adjustment','Reporting and Representation Adjustments (PSID, CEX, SCF)',[
    ['full','Reporting + representation'], ['adj','Reporting only'], ['raw','Raw data'],
  ]);
  const weightingBox = make('div','control weighting-control');
  weightingBox.append(make('span','control-label weighting-title','Weighting correction for PSID'));
  adjustments.append(weightingBox);
  const weighting = radioGroup(weightingBox,'weighting','Weighting correction for PSID',[
    ['scf_income','SCF income'],['irs_income','IRS income'],['scf_wealth','SCF wealth'],
  ],'weighting-options',onWeightingChange);
  for (const input of weighting.inputs) {
    const label = input.parentElement;
    const wrapper = make('span','weighting-choice');
    label.replaceWith(wrapper);
    wrapper.append(label,help(input.value,'About '+label.textContent+' weights'));
  }

  const kind = radioGroup(indicators,'indicator','Tail and concentration indicator',
    [['pareto','Pareto coefficient'],['share','Top shares']],'indicator-kind-options choice-row');
  indicators.insertBefore(kind.fieldset,paretoOptions);
  paretoOptions.append(make('span','subcontrol-label','Pareto measure'));
  const paretoMeasure = radioGroup(paretoOptions,'pareto','Pareto measure',[
    ['pareto','Pareto coefficient'],['wealth_ratio','Relative to that of wealth'],
  ],'compact-choice-row');
  paretoOptions.append(make('span','subcontrol-label','Pareto estimator'));
  const estimator = radioGroup(paretoOptions,'estimator','Pareto estimator',[['MLE','MLE'],['OLS','OLS']],'compact-choice-row');
  const spending = select(options,'measure','Variable for consumption',[
    ['consump_def1','Consumption'],
    ...spendingOptions.filter(item => item.key !== 'consump_def1').map(item => [item.key,item.label]),
  ]);
  spending.closest('.control').append(make('p','consumption-variable-note',
    'Consumption includes imputed housing and durable services. Expenditure records purchases.'));
  const housingRow = make('div','sidebar-inline-check weighting-choice');
  options.append(housingRow);
  const housing = choice(housingRow,'checkbox','housing','bp','Constant imputed rent rate',input=>onHousingChange(input.checked));
  housingRow.append(help('constant_imputed_rent','About constant imputed rent'));
  const capitalDefinitions = metadata.saez_zucman_reference?.capital_income_definitions || {};
  const capital = select(options,'capital','DINA capital gains',
    Object.entries(capitalDefinitions).map(([key,value])=>[key,value.label]),onCapitalDefinitionChange);

  const surveyOrder = ['PSID','CEX_BM_RECON','SCF','YODLEE','FORBES','SAEZ_ZUCMAN'];
  let cexIncome;
  for (const survey of [...surveys].sort((a,b) => surveyOrder.indexOf(a)-surveyOrder.indexOf(b))) {
    const name = surveyName(survey);
    const row = survey==='CEX_BM_RECON' ? make('div','cex-dataset-row') : datasetChoices;
    const {wrapper,input} = choice(row,'checkbox','dataset',survey,make('span','',name),input => {
      if (input.checked) selected.add(survey);
      else selected.delete(survey);
      render();
    });
    wrapper.className = 'overlay-choice small-check overlay-choice-'+survey.toLowerCase();
    input.checked = selected.has(survey);
    const marker = make('span','help-marker hover-help','?');
    marker.tabIndex = 0;
    marker.dataset.tooltip = surveyTooltip(survey);
    marker.setAttribute('aria-label','About '+name);
    if (survey==='CEX_BM_RECON') {
      cexIncome = choice(row,'checkbox','cex-income','cex_income',make('span','','Show income'),
        input=>onCEXIncomeChange(input.checked)).input;
      cexIncome.parentElement.classList.add('cex-income-option');
      cexIncome.setAttribute('aria-label','Show CEX topcoded income');
      marker.setAttribute('aria-label','About CEX topcoded income');
      marker.dataset.tooltip = metadata.cex_optional_income?.warning || 'Topcoding distorts CEX income estimates at the top.';
      row.append(marker);
      datasetChoices.append(row);
    } else {
      if (survey==='SCF') marker.dataset.tooltip += ' Select an expenditure measure to compare SCF spending.';
      wrapper.append(marker);
    }
  }
  const scfInput = datasetChoices.querySelector('input[value="SCF"]');

  const seriesBar = find('.series-bar');
  const variableInputs = variables.map(([value,label,color]) => {
    const item = make('span','us-total-income-choice');
    const {wrapper,input} = choice(item,'checkbox','variable',value,label,render);
    wrapper.className = 'series-choice';
    wrapper.style.setProperty('--series',color);
    const swatch = make('span','series-swatch');
    swatch.setAttribute('aria-hidden','true');
    input.after(swatch);
    input.checked = value !== 'total_income';
    if (value === 'total_income') item.append(createUSTotalIncomeHelp());
    seriesBar.append(item);
    return input;
  });

  function displayValue(value, shares) {
    return shares ? (value * 100).toFixed(1) + '%' : value.toFixed(3);
  }

  function waveLabel(survey, n) {
    const unit = ['PSID','SCF'].includes(survey) ? 'wave' : 'year';
    return n+' '+unit+(n===1?'':'s');
  }

  function drawStandardErrors(ctx, scales, points) {
    // End each band where there are too few waves to estimate a standard error.
    let segment = [];
    function drawSegment() {
      if (!segment.length) return;
      const x = point => scales.x.getPixelForValue(point.q * 100);
      const y = (point, direction) => scales.y.getPixelForValue(point.mean + direction * point.se);
      ctx.beginPath();
      if (segment.length === 1) {
        const [point] = segment;
        ctx.moveTo(x(point),y(point,1));
        ctx.lineTo(x(point),y(point,-1));
        ctx.stroke();
      } else {
        for (const point of segment) ctx.lineTo(x(point),y(point,1));
        for (let i=segment.length-1; i>=0; i--) ctx.lineTo(x(segment[i]),y(segment[i],-1));
        ctx.closePath();
        ctx.fill();
      }
      segment = [];
    }
    for (const point of points) {
      if (Number.isFinite(point.se)) segment.push(point);
      else drawSegment();
    }
    drawSegment();
  }

  const referencesAndBands = {
    id:'usQuantileReferencesAndBands',
    beforeDatasetsDraw({ctx, scales, chartArea}) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);
      ctx.clip();
      ctx.globalAlpha = .12;
      for (const {color,points} of comparison) {
        ctx.fillStyle = ctx.strokeStyle = color;
        drawStandardErrors(ctx,scales,points);
      }
      ctx.globalAlpha = .85;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8,5]);
      for (const {color,reference} of comparison) {
        if (!reference?.n) continue;
        const y = scales.y.getPixelForValue(reference.mean);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(chartArea.left,y);
        ctx.lineTo(chartArea.right,y);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

  function drawPlot(title, activeVariables, shares) {
    chart?.destroy();
    chart = null;
    const groups = comparison.filter(({points,reference}) => points.length || reference?.n);
    const datasets = groups.map(({survey,label,color,points}) => {
      const [pointStyle,borderDash] = style[survey];
      return {
        label:label+' · '+surveyName(survey), survey,
        data:points.map(({q,mean,n,se}) => ({x:q*100,y:mean,n,se})),
        borderColor:color, backgroundColor:color, pointStyle, borderDash,
        pointRadius:({raw})=>points.length === 1 || [80,90,95].some(p=>Math.abs(raw?.x-p)<1e-6) ? 4 : 0,
        pointHoverRadius:5, borderWidth:2.2,
      };
    });
    const visible = groups.length > 0;
    canvas.parentElement.hidden = !visible;
    csvButton.disabled = pngButton.disabled = !visible;
    status.hidden = visible;
    ksSummary.replaceChildren();
    ksSummary.hidden = !groups.some(group => group.reference?.n);
    note.parentElement.hidden = !visible;
    if (!visible) {
      status.textContent = !selected.size ? 'Choose a dataset to see its estimates.'
        : !activeVariables.length ? 'Choose a variable to see its estimates.'
        : 'No estimates are available in this window for these selections.';
      return;
    }
    const limits = groups.flatMap(({points,reference}) => [
      ...points.flatMap(({mean,se})=>[mean-(se??0),mean+(se??0)]),
      ...(reference?.n ? [reference.mean] : []),
    ]);
    const shownSurveys = new Set(groups.map(({survey})=>survey));
    const unavailable = [...selected].filter(survey=>!shownSurveys.has(survey)).map(surveyName);
    note.textContent = 'Shaded bands show ±1 standard error across available waves or years at each percentile. A standard error requires at least two estimates.'
      +(ksSummary.hidden?'':' Dashed horizontal lines show the mean of the wave- or year-specific KS-selected estimates.')
      +(unavailable.length?' No estimates for '+unavailable.join(', ')+' in this selection.':'');
    if (!ksSummary.hidden) {
      ksSummary.append(make('strong','','Mean KS-selected estimates'));
      for (const [key,label,color] of activeVariables) {
        const references = groups.filter(group=>group.key===key&&group.reference?.n);
        if (!references.length) continue;
        const row = make('div','quantile-ks-row');
        const variable = make('strong','quantile-ks-variable',references[0].label || label);
        row.style.setProperty('--series-color',color);
        row.append(variable);
        for (const {survey,reference} of references) {
          const estimate = make('span','quantile-ks-value',surveyName(survey)+' '+displayValue(reference.mean,false));
          estimate.title = waveLabel(survey,reference.n)
            +(Number.isFinite(reference.se)?' · SE '+displayValue(reference.se,false):'');
          row.append(estimate);
        }
        ksSummary.append(row);
      }
    }
    canvas.setAttribute('aria-label',title+' by percentile, '+period.replace('-',' to '));
    chart = new Chart(canvas, {
      type:'line', data:{datasets}, plugins:[referencesAndBands],
      options:{
        responsive:true, maintainAspectRatio:false, animation:false, parsing:false,
        interaction:{mode:'nearest',intersect:false},
        layout:{padding:{right:10}},
        plugins:{
          legend:{position:'top',onClick:()=>{},labels:{usePointStyle:true,padding:18,font:{size:13},
            generateLabels:()=>[...shownSurveys].map(survey=>{
              const [pointStyle,lineDash] = style[survey];
              return {text:surveyName(survey),pointStyle,lineDash,lineWidth:1.5,hidden:false,
                fontColor:'#425367',fillStyle:'#59677a',strokeStyle:'#59677a'};
            }),
          }},
          tooltip:{callbacks:{
            title:items => percentile(items[0].parsed.x),
            label:item => item.dataset.label+': '+displayValue(item.parsed.y,shares)
              +(Number.isFinite(item.raw.se)?' ± '+displayValue(item.raw.se,shares)+' SE':'')
              +' · '+waveLabel(item.dataset.survey,item.raw.n),
          }},
        },
        scales:{
          x:{type:'linear',min:xMin,max:xMax,
            afterBuildTicks:scale=>{scale.ticks=[70,75,80,85,90,95,99].map(value=>({value}));},
            ticks:{callback:percentile,maxRotation:0,font:{size:13}},grid:{display:false},
            title:{display:true,text:shares?'Distribution percentile':'Tail cutoff percentile',font:{size:13}}},
          y:{suggestedMin:Math.min(...limits),suggestedMax:Math.max(...limits),
            title:{display:true,text:title,font:{size:13}},grid:{color:'#e8e8ed'},
            ticks:{font:{size:13},callback:value=>shares?number.format(value*100)+'%':number.format(value)}},
        },
      },
    });
  }

  function tenYearWindows(years) {
    const windows = new Map();
    const latest = years[0];
    const earliestEnd = Math.min(latest,years.at(-1)+7);
    for (let end=latest; end>=earliestEnd; end-=3) {
      const start = end-9;
      if (years.some(year=>year>=start&&year<=end)) windows.set(start+'-'+end,[start,end]);
    }
    if (selectedPeriod && !windows.has(selectedPeriod)) {
      windows.set(selectedPeriod,selectedPeriod.split('-').map(Number));
    }
    return windows;
  }

  async function render() {
    const activeVariables = variables.filter((_,index)=>variableInputs[index].checked);
    const showsConsumption = activeVariables.some(([key])=>key==='consumption');
    const activeKeys = activeVariables.map(([key])=>key);
    const shares = kind.value === 'share';
    const indicator = shares ? 'share' : paretoMeasure.value;
    const method = estimator.value;
    const title = shares ? 'Share above percentile'
      : indicator === 'wealth_ratio' ? 'Pareto coefficient relative to wealth' : 'Pareto coefficient';
    const spendingLabel = spending.selectedOptions[0].textContent;
    const ids = surveys.filter(survey=>selected.has(survey));
    const hasSurvey = ids.some(household);
    paretoOptions.hidden = shares;
    adjustment.disabled = !hasSurvey;
    adjustments.classList.toggle('adjustment-unavailable',!hasSurvey);
    weightingBox.hidden = !selected.has('PSID') || adjustment.value !== 'full';
    for (const input of weighting.inputs) input.checked = input.value === getWeightingMethod();
    spending.disabled = !showsConsumption;
    housing.input.checked = getHousingMethod() === 'bp';
    housingRow.hidden = !hasSurvey;
    if (cexIncome) {
      cexIncome.checked = getCEXIncome();
      cexIncome.disabled = !selected.has('CEX_BM_RECON');
    }
    if (scfInput) {
      scfInput.disabled = activeVariables.length === 1 && showsConsumption && spending.value === 'consump_def1';
      scfInput.parentElement.classList.toggle('unavailable-option',scfInput.disabled);
      scfInput.title = scfInput.disabled ? 'Select an expenditure measure to compare SCF spending.' : '';
    }
    capital.closest('.control').hidden = !selected.has('SAEZ_ZUCMAN') || !activeKeys.some(key=>['total_capital_income','total_income'].includes(key));
    capital.value = Object.keys(capitalDefinitions).find(key=>capitalDefinitions[key].author_variant===getCapitalDefinition()) || '';

    const filter = JSON.stringify([ids,activeKeys,spending.value,indicator,method,adjustment.value,selectedPeriod,
      getHousingMethod(),getWeightingMethod(),getCapitalDefinition(),getCEXIncome()]);
    if (filter === lastFilter && !pending) { chart?.resize(); return; }
    if (filter === pending) return;
    pending = filter;
    const sequence = ++request;
    status.textContent = 'Loading selected estimates…';
    status.hidden = false;
    csvButton.disabled = pngButton.disabled = true;
    try {
      const curves = await loadCurves(ids);
      if (sequence !== request) return;
      const curveOptions = ids.flatMap(survey => activeVariables.flatMap(([key,variableLabel,color]) => {
        const measure = key === 'consumption' ? spending.value : key;
        if (survey==='SCF'&&measure==='consump_def1') return [];
        const label = key==='consumption' ? spendingLabel : variableLabel;
        const variant = survey === 'SCF' && adjustment.value === 'full' ? 'adj'
          : household(survey) ? adjustment.value : survey === 'YODLEE' ? 'raw' : 'reference';
        const authorVariant = survey === 'SAEZ_ZUCMAN'
          ? (['total_income','total_capital_income'].includes(measure) ? getCapitalDefinition() : 'dina_2022')
          : survey === 'YODLEE' ? ({
            consump_def1:'durables_4_with_carry',expenditure:'active_unadjusted_same_sample',
            food_total:'enriched_raw',vacation:'active_basic_cleaning',total_income:'active_basic_cleaning',
          })[measure] : null;
        const source = ThresholdProfiles.contractFor(survey,metadata);
        const contract = survey === 'FORBES' ? {...source,profile_window:[.70,.90]} : source;
        return [{survey,variant,variable:measure,key,label,color,authorVariant,contract,
          wealthAuthorVariant:survey==='SAEZ_ZUCMAN'?'dina_2022':authorVariant,indicator,method}];
      }));
      const supported = (row, config) => row.survey===config.survey && row.variant===config.variant &&
        row.variable===config.variable && (!config.authorVariant||row.author_variant===config.authorVariant);
      const years = [...new Set(curves.filter(row=>curveOptions.some(config=>supported(row,config)))
        .map(row=>row.year).filter(Number.isFinite))].sort((a,b)=>b-a);
      const windows = tenYearWindows(years);
      period = selectedPeriod || windows.keys().next().value || '';
      range.replaceChildren(...[...windows].map(([key,years])=>new Option(years.join('–'),key)));
      range.disabled = !windows.size;
      range.value = period;
      const span = windows.get(period);
      const profileCurves = span ? curves.filter(row=>row.year>=span[0]&&row.year<=span[1]) : [];
      subtitle.textContent = span ? span.join('–')+' average' : 'Ten-year averages';
      comparison = curveOptions.map(config=>({...config,
        points:ThresholdProfiles.profiles(profileCurves,config),
        reference:shares ? null : ThresholdProfiles.reference(profileCurves,config),
      }));
      drawPlot(title,activeVariables,shares);
      lastFilter = filter;
    } catch (error) {
      if (sequence !== request) return;
      status.textContent = 'These estimates could not be loaded. Change a selection to try again.';
      console.error(error);
    } finally {
      if (sequence === request) pending = null;
    }
  }

  function save(url, name) {
    const link = make('a');
    link.href = url;
    link.download = name;
    link.click();
  }
  csvButton.addEventListener('click', () => {
    const rows = ['dataset,measure,adjustment,period,indicator,estimator,threshold_percentile,estimate,waves,years_used,standard_error,ks_mean,ks_standard_error,ks_waves'];
    for (const {survey,variable,variant,indicator,method,points,reference} of comparison) {
      const prefix = [survey,variable,variant,period,indicator,indicator==='share'?'':method];
      const ks = [reference?.mean,reference?.se,reference?.n||''];
      for (const p of points) rows.push([...prefix,Math.round(p.q*1000000)/10000,
        p.mean,p.n,p.years_used,p.se,...ks].join(','));
      if (!points.length && reference?.n) rows.push([...prefix,'','','','','',...ks].join(','));
    }
    const url = URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    save(url,'US_quantile_comparison_'+period+'.csv');
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  pngButton.addEventListener('click', () => {
    if (chart) save(chart.toBase64Image(),'US_quantile_comparison_'+period+'.png');
  });
  csvButton.disabled = pngButton.disabled = true;
  return {render,resize:()=>chart?.resize()};
}
