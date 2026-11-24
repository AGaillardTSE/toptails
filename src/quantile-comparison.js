const US_TOTAL_INCOME_NOTE = 'Total income is only partly comparable across surveys. The series differ in whether and how they count realized capital gains, pensions, government transfers, and other income. '
  + 'Standard SCF income weights use a common income definition for reweighting and the plots show reported total income. '
  + 'For a closer comparison, DINA income aligns the market-income ranking used to reweight PSID with DINA. The displayed totals still follow each source’s definition. '
  + 'SCF broad income uses a common measure for adjusted PSID and SCF totals, including net imputed owner rent.';

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
  host, surveys, loadCurves, metadata, spendingOptions, surveyName, surveyTooltip, appendParetoEstimationLink,
  showRawByDefault = true,
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
  const referenceColors = {consumption:'#315f87',total_labor_income:'#923d3d',total_income:'#834a31',networth_val:'#356448',total_capital_income:'#785d1b'};
  const referenceFont = '600 12px Arial, sans-serif';
  const axisTitleFont = {size:13,lineHeight:1.2};
  const axisTitlePadding = 4;
  const selected = new Set(surveys.includes('PSID') ? ['PSID'] : []);
  const household = survey => ['PSID','SCF','CEX_BM_RECON'].includes(survey);
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const percentile = value => 'P' + number.format(value);
  const chartSurveyName = survey => survey === 'SAEZ_ZUCMAN' ? 'SZ' : surveyName(survey);
  const xMin = 70;
  const xMax = 99.25;
  const markerPercentiles = [70, 75, 80, 85, 90, 95];
  const markerRadius = survey => survey === 'PSID' ? 3 : 4;

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
      <div><h2>Pareto tail coefficients by quantile</h2><p class="plot-subtitle"></p></div>
      <div class="chart-actions"><button class="text-button" data-action="csv" type="button">Profile CSV</button><button class="text-button" data-action="png" type="button">Figure PNG</button></div>
    </header>
    <div class="plot-series-controls">
      <span class="control-label series-label">Variables:</span>
      <fieldset class="series-bar" aria-label="Variables to display"></fieldset>
    </div>
    <div class="quantile-comparison-body">
      <p class="quantile-comparison-status" role="status" hidden></p>
      <p class="quantile-comparison-finding" hidden></p>
      <div class="quantile-comparison-panels"></div>
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
  const legendKeyWidth = 52;
  const legendSwatches = Object.fromEntries(Object.entries(style).map(([survey,[pointStyle,dash]]) => {
    const swatch = make('canvas');
    swatch.width = legendKeyWidth;
    swatch.height = 14;
    const context = swatch.getContext('2d');
    const center = swatch.width / 2;
    const y = swatch.height / 2;
    context.strokeStyle = context.fillStyle = '#59677a';
    context.lineWidth = 2.2;
    context.setLineDash(dash);
    context.beginPath();
    context.moveTo(1,y);
    context.lineTo(swatch.width-1,y);
    context.stroke();
    context.clearRect(center-6,0,12,swatch.height);
    context.setLineDash([]);
    context.lineWidth = 1.8;
    Chart.helpers.drawPoint(context,{pointStyle,radius:markerRadius(survey),borderWidth:1.8},center,y);
    return [survey,swatch];
  }));
  const sidebar = find('.quantile-comparison-sidebar');
  const adjustments = find('.adjustment-block');
  const indicators = find('.indicator-block');
  const paretoOptions = find('.quantile-v2-pareto-options');
  const options = find('.quantile-comparison-options');
  const datasetChoices = find('.dataset-controls');
  const status = find('.quantile-comparison-status');
  const finding = find('.quantile-comparison-finding');
  const plotHeading = find('.quantile-comparison-header h2');
  const subtitle = find('.plot-subtitle');
  const csvButton = find('[data-action="csv"]');
  const pngButton = find('[data-action="png"]');
  const note = find('.quantile-comparison-note span');
  const panelGrid = find('.quantile-comparison-panels');
  const panels = ['raw','current'].map(key => {
    const section = make('section','quantile-comparison-panel');
    section.id = 'quantile-v2-'+key+'-panel';
    section.hidden = true;
    section.dataset.panel = key;
    const header = make('header','quantile-panel-header');
    const heading = make('h3','quantile-panel-heading');
    const toggle = make('button','text-button quantile-panel-toggle',key==='raw'?'Hide raw data':'Show raw data');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls','quantile-v2-raw-panel');
    toggle.setAttribute('aria-expanded',String(key==='raw'));
    header.append(heading,toggle);
    const wrap = make('div','quantile-comparison-chart');
    const canvas = make('canvas');
    canvas.setAttribute('role','img');
    const summary = make('p','quantile-panel-accessible-summary');
    summary.id = 'quantile-v2-'+key+'-ks';
    canvas.setAttribute('aria-describedby',summary.id);
    const empty = make('p','quantile-comparison-status','No estimates are available in this window for these selections.');
    wrap.append(canvas);
    section.append(header,wrap,summary,empty);
    panelGrid.append(section);
    return {key,section,header,heading,toggle,wrap,canvas,summary,empty,groups:[],chart:null};
  });
  const [rawPanel,currentPanel] = panels;
  let request = 0, pending, lastFilter, period, showRawPanel = showRawByDefault;
  for (const panel of panels) {
    panel.toggle.addEventListener('click', async () => {
      const hadFocus = document.activeElement===panel.toggle;
      showRawPanel = panel===currentPanel;
      await render();
      const next = showRawPanel ? rawPanel : currentPanel;
      if (hadFocus && !next.section.hidden && !next.toggle.hidden &&
        (document.activeElement===panel.toggle || document.activeElement===document.body)) next.toggle.focus();
    });
  }

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

  const windowControls = make('div','quantile-window-controls');
  sidebar.insertBefore(windowControls,adjustments);
  const startWave = select(windowControls,'start-wave','Start wave',[['2005','2005']]);
  const timeWindow = select(windowControls,'time-window','Time window',
    [5,10,15,20,25,30].map(years=>[String(years),years+' years']));
  timeWindow.value = '20';
  const adjustment = select(adjustments,'adjustment','Reporting and Representation Adjustments (PSID, CEX, SCF)',[
    ['full','Reporting + representation'], ['adj','Adjusted for reporting only'], ['raw','Raw data'],
  ]);
  const weightingBox = make('div','control weighting-control');
  weightingBox.append(make('span','control-label weighting-title','Weighting correction for PSID'));
  adjustments.append(weightingBox);
  const weighting = radioGroup(weightingBox,'weighting','Weighting correction for PSID',[
    ['scf_income','SCF income'],['irs_income','IRS income'],['scf_wealth','SCF wealth'],
    ...(metadata.weighting_sensitivity?.controls?.dina_income?[['dina_income','DINA income']]:[]),
    ...(metadata.weighting_sensitivity?.controls?.scf_broad_income?[['scf_broad_income','SCF broad income']]:[]),
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
    ['pareto','Pareto coefficient (ζ)'],['wealth_ratio','Relative to that of wealth (ζₓ / ζₐ)'],['income_ratio','Relative to total income (ζₓ / ζᵧ)'],
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
    const name = survey === 'SAEZ_ZUCMAN' ? 'Saez–Zucman - SZ (DINA)' : surveyName(survey);
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
      if (survey==='SCF') marker.dataset.tooltip += ' Select an expenditure measure to compare SCF spending. Total expenditure estimates are available only for the 2025 wave.';
      wrapper.append(marker);
    }
  }
  const scfInput = datasetChoices.querySelector('input[value="SCF"]');

  const seriesBar = find('.series-bar');
  const totalIncomeHelp = createUSTotalIncomeHelp();
  const variableInputs = variables.map(([value,label,color]) => {
    const item = make('span','us-total-income-choice');
    const {wrapper,input} = choice(item,'checkbox','variable',value,label,render);
    wrapper.className = 'series-choice';
    wrapper.style.setProperty('--series',color);
    const swatch = make('span','series-swatch');
    swatch.setAttribute('aria-hidden','true');
    input.after(swatch);
    input.checked = value !== 'total_income';
    if (value === 'total_income') item.append(totalIncomeHelp);
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

  function plotAnnotations(groups, labels) {
    return {
      id:'usQuantileReferencesAndBands',
      beforeDatasetsDraw({ctx,scales,chartArea}) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);
        ctx.clip();
        ctx.globalAlpha = .12;
        for (const {color,points} of groups) {
          ctx.fillStyle = ctx.strokeStyle = color;
          drawStandardErrors(ctx,scales,points);
        }
        ctx.globalAlpha = .85;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8,5]);
        for (const {color,mean} of labels) {
          const y = scales.y.getPixelForValue(mean);
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(chartArea.left,y);
          ctx.lineTo(chartArea.right,y);
          ctx.stroke();
        }
        ctx.restore();
      },
      afterDraw({ctx,scales,chartArea}) {
        if (!labels.length) return;
        // Stack labels where KS estimates are close, with a short leader to each estimate.
        const positions = labels.map(label=>({...label,anchor:scales.y.getPixelForValue(label.mean)}))
          .sort((a,b)=>a.anchor-b.anchor);
        const spacing = Math.min(16,Math.max(1,(chartArea.height-14)/Math.max(1,positions.length-1)));
        let lower = chartArea.top+7;
        for (const label of positions) {
          label.y = Math.max(lower,label.anchor);
          lower = label.y+spacing;
        }
        let upper = chartArea.bottom-7;
        for (let i=positions.length-1; i>=0; i--) {
          positions[i].y = Math.min(positions[i].y,upper);
          upper = positions[i].y-spacing;
        }
        const edge = chartArea.left+13;
        ctx.save();
        ctx.font = referenceFont;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;
        for (const {text,color,y,anchor} of positions) {
          ctx.fillStyle = 'rgba(255,254,250,.94)';
          ctx.fillRect(edge-2,y-7,ctx.measureText(text).width+4,14);
          ctx.fillStyle = ctx.strokeStyle = color;
          ctx.fillText(text,edge,y);
          ctx.beginPath();
          ctx.moveTo(edge-3,y);
          ctx.lineTo(edge-8,anchor);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  }

  function referenceLabels(groups) {
    return groups.filter(group=>group.reference?.n).map(({survey,key,label,reference})=>({
      mean:reference.mean,
      text:(survey==='YODLEE'?'Yodlee':chartSurveyName(survey))+' '+reference.mean.toFixed(2),
      detail:label+' · '+surveyName(survey)+' '+reference.mean.toFixed(2)+' over '+waveLabel(survey,reference.n),
      color:referenceColors[key],
    }));
  }

  function renderPSIDHeadline(adjustedGroups) {
    const adjusted = new Map(adjustedGroups
      .filter(group=>group.survey==='PSID' && group.reference?.n)
      .map(({key,reference})=>[key,reference.mean]));
    const measures = [
      ['consumption','c',spending.selectedOptions[0].textContent.toLowerCase()],
      ['total_capital_income','ra','capital income'],
      ['networth_val','a','wealth'],
    ].filter(([key])=>adjusted.has(key));
    finding.hidden = measures.length===0;
    if (finding.hidden) return;

    function zeta(key, subscript) {
      const symbol = make('var','','ζ');
      symbol.style.color = referenceColors[key];
      symbol.append(make('sub','',subscript));
      return symbol;
    }
    function expression(key, subscript, value, ratio = false) {
      const term = make('span','quantile-finding-expression');
      const estimate = make('strong','',value.toFixed(2));
      estimate.style.color = referenceColors[key];
      term.append(zeta(key,subscript));
      if (ratio) term.append('/',zeta('networth_val','a'));
      term.append(' = ',estimate);
      return term;
    }
    function appendList(items) {
      items.forEach((item,index)=>{
        if (index) finding.append(index===items.length-1 ? (items.length===2?' and ':', and ') : ', ');
        finding.append(...item);
      });
    }

    finding.replaceChildren(make('strong','','Headline result:'),
      ' At the KS-selected thresholds');
    appendParetoEstimationLink(finding);
    finding.append(', the adjusted PSID Pareto '
      +(measures.length===1?'coefficient is ':'coefficients are '));
    appendList(measures.map(([key,subscript,label])=>[
      expression(key,subscript,adjusted.get(key)), ' for '+label,
    ]));
    const adjustedWealth = adjusted.get('networth_val');
    const ratios = measures.filter(([key])=>key!=='networth_val');
    if (ratios.length && adjustedWealth>0) {
      finding.append(', implying ');
      appendList(ratios.map(([key,subscript])=>[
        expression(key,subscript,adjusted.get(key)/adjustedWealth,true),
      ]));
    }
    finding.append('.');
  }

  function resizePlots() {
    for (const panel of panels) panel.chart?.resize();
  }

  function drawPlots(title, activeVariables, indicator, canCompare, includeRaw) {
    const shares = indicator === 'share';
    const yTitle = {
      pareto:'Pareto tail coefficient (ζ)',
      wealth_ratio:'Relative to wealth (ζₓ / ζₐ)',
      income_ratio:'Relative to total income (ζₓ / ζᵧ)',
    }[indicator]||title;
    const visiblePanels = includeRaw ? panels : [currentPanel];
    const titlePanel = visiblePanels.find(panel=>panel.groups.length);
    const groups = visiblePanels.flatMap(panel=>panel.groups);
    const visible = groups.length>0;
    panelGrid.classList.toggle('has-raw-panel',includeRaw);
    panelGrid.classList.toggle('single-reporting-panel',!includeRaw&&adjustment.value==='adj');
    csvButton.disabled = pngButton.disabled = !visible;
    status.hidden = visible;
    note.parentElement.hidden = !visible;
    if (!visible) status.textContent = !selected.size ? 'Choose a dataset to see its estimates.'
      : !activeVariables.length ? 'Choose a variable to see its estimates.'
      : 'No estimates are available in this window for these selections.';
    const limits = groups.flatMap(({points,reference}) => [
      ...points.flatMap(({mean,se})=>[mean-(se??0),mean+(se??0)]),
      ...(reference?.n ? [reference.mean] : []),
    ]);
    const hasReference = groups.some(group=>group.reference?.n);
    const shownSurveys = new Set(groups.map(({survey})=>survey));
    const unavailable = [...selected].filter(survey=>!shownSurveys.has(survey)).map(surveyName);
    const ratio = ['wealth_ratio','income_ratio'].includes(indicator);
    note.textContent = 'Shaded bands show ±1 standard error across available waves or years at each percentile. A standard error requires at least two estimates.'
      +(hasReference?' Labels inside each plot identify the dashed lines for mean KS-selected estimates.':'')
      +(ratio?' Ratios pair coefficients within each dataset and wave or year. Each variable uses its own KS cutoff for the dashed lines.':'')
      +(unavailable.length?' No estimates for '+unavailable.join(', ')+' in this selection.':'');

    const yRange = {suggestedMin:Math.min(...limits),suggestedMax:Math.max(...limits)};
    for (const panel of panels) {
      panel.chart?.destroy();
      panel.chart = null;
      const show = visible && visiblePanels.includes(panel);
      panel.section.hidden = !show;
      if (!show) continue;
      panel.toggle.hidden = panel===currentPanel && (!canCompare || includeRaw);
      panel.header.hidden = !includeRaw && panel.toggle.hidden;
      panel.heading.textContent = panel.key==='raw' ? 'Raw data'
        : adjustment.value==='full' ? 'Adjusted for reporting + representation' : adjustment.selectedOptions[0].textContent;
      panel.wrap.hidden = !panel.groups.length;
      panel.empty.hidden = !!panel.groups.length;
      if (!panel.groups.length) continue;
      const labels = referenceLabels(panel.groups);
      panel.canvas.setAttribute('aria-label',yTitle+' by percentile, '+period.replace('-',' to '));
      panel.summary.textContent = labels.length ? 'Mean KS-selected estimates. '+labels.map(label=>label.detail).join('. ')+'.' : '';
      const datasets = panel.groups.map(({survey,label,color,points}) => {
        const [pointStyle,borderDash] = style[survey];
        return {
          label:label+' · '+chartSurveyName(survey),survey,
          data:points.map(({q,mean,n,se})=>({x:q*100,y:mean,n,se})),
          borderColor:color,backgroundColor:color,pointStyle,borderDash,
          pointRadius:({raw})=>points.length===1||markerPercentiles.some(p=>Math.abs(raw?.x-p)<1e-6)?markerRadius(survey):0,
          pointHoverRadius:5,borderWidth:2.2,
        };
      });
      const panelSurveys = new Set(panel.groups.map(({survey})=>survey));
      panel.chart = new Chart(panel.canvas,{
        type:'line',data:{datasets},plugins:[plotAnnotations(panel.groups,labels)],
        options:{
          responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
          interaction:{mode:'nearest',intersect:false},
          layout:{padding:{right:8}},
          plugins:{
            legend:{position:'top',onClick:()=>{},labels:{usePointStyle:true,pointStyleWidth:legendKeyWidth,padding:12,font:{size:12},
              generateLabels:()=>[...panelSurveys].map(survey=>({
                text:chartSurveyName(survey),pointStyle:legendSwatches[survey],hidden:false,fontColor:'#425367',
              })),
            }},
            tooltip:{callbacks:{
              title:items=>percentile(items[0].parsed.x),
              label:item=>item.dataset.label+': '+displayValue(item.parsed.y,shares)
                +(Number.isFinite(item.raw.se)?' ± '+displayValue(item.raw.se,shares)+' SE':'')
                +' · '+waveLabel(item.dataset.survey,item.raw.n),
            }},
          },
          scales:{
            x:{type:'linear',min:xMin,max:xMax,
              afterBuildTicks:scale=>{scale.ticks=(includeRaw?[70,80,90,99]:[70,75,80,85,90,95,99]).map(value=>({value}));},
              ticks:{callback:percentile,maxRotation:0,font:{size:13}},grid:{display:false},
              title:{display:true,text:shares?'Distribution percentile':'Percentile where the upper tail begins',font:{size:13}}},
            y:{...yRange,grid:{color:'#e8e8ed'},
              title:{display:panel===titlePanel,text:yTitle,font:axisTitleFont,
                padding:axisTitlePadding},
              ticks:{font:{size:13},callback:value=>shares?number.format(value*100)+'%':number.format(value)}},
          },
        },
      });
    }
  }

  async function render() {
    const activeVariables = variables.filter((_,index)=>variableInputs[index].checked);
    const showsConsumption = activeVariables.some(([key])=>key==='consumption');
    const activeKeys = activeVariables.map(([key])=>key);
    const shares = kind.value === 'share';
    const indicator = shares ? 'share' : paretoMeasure.value;
    const method = estimator.value;
    const title = {
      share:'Share above percentile',pareto:'Pareto coefficient',
      wealth_ratio:'Pareto coefficient relative to wealth',income_ratio:'Pareto coefficient relative to total income',
    }[indicator];
    plotHeading.textContent = {
      share:'Shares above quantile',pareto:'Pareto tail coefficients by quantile',
      wealth_ratio:'Pareto tail coefficients relative to wealth by quantile',
      income_ratio:'Pareto tail coefficients relative to total income by quantile',
    }[indicator];
    const spendingLabel = spending.selectedOptions[0].textContent;
    const ids = surveys.filter(survey=>selected.has(survey));
    const hasSurvey = ids.some(household);
    paretoOptions.hidden = shares;
    adjustment.disabled = !hasSurvey;
    const canCompare = hasSurvey && adjustment.value!=='raw';
    const includeRaw = showRawPanel && canCompare;
    const compareCommonIncome = selected.has('PSID') && adjustment.value==='full' && getWeightingMethod()==='scf_broad_income';
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
    capital.closest('.control').hidden = !selected.has('SAEZ_ZUCMAN') ||
      (indicator!=='income_ratio'&&!activeKeys.some(key=>['total_capital_income','total_income'].includes(key)));
    capital.value = Object.keys(capitalDefinitions).find(key=>capitalDefinitions[key].author_variant===getCapitalDefinition()) || '';

    const firstYear = Number(startWave.value);
    const windowYears = Number(timeWindow.value);
    // The 20-year span includes both endpoints, such as 2005 through 2025.
    const lastYear = firstYear + windowYears - (windowYears === 20 ? 0 : 1);
    const filter = JSON.stringify([ids,activeKeys,spending.value,indicator,method,adjustment.value,includeRaw,firstYear,lastYear,
      getHousingMethod(),getWeightingMethod(),getCapitalDefinition(),getCEXIncome()]);
    if (filter === lastFilter && !pending) { resizePlots(); return; }
    if (filter === pending) return;
    pending = filter;
    const sequence = ++request;
    status.textContent = 'Loading selected estimates…';
    status.hidden = false;
    finding.hidden = true;
    csvButton.disabled = pngButton.disabled = true;
    try {
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
        const incomeAuthorVariant = survey==='SAEZ_ZUCMAN'?getCapitalDefinition()
          : survey==='YODLEE'?'active_basic_cleaning':authorVariant;
        return [{survey,variant,variable:measure,key,label,color,authorVariant,contract,incomeAuthorVariant,
          wealthAuthorVariant:survey==='SAEZ_ZUCMAN'?'dina_2022':authorVariant,indicator,method}];
      }));
      const rawOptions = includeRaw ? curveOptions.map(config =>
        household(config.survey) ? {...config,variant:'raw'} : config) : [];
      const supported = (row, config) => row.survey===config.survey && row.variant===config.variant &&
        row.variable===config.variable && (!config.authorVariant||row.author_variant===config.authorVariant);
      const availableOptions = [...curveOptions,...rawOptions].map(config=>({
        ...config, commonSCFIncome:compareCommonIncome&&config.survey==='SCF'&&config.variant==='adj'&&(config.variable==='total_income'||config.indicator==='income_ratio'),
      }));
      const curves = await loadCurves(availableOptions);
      if (sequence !== request) return;
      const years = new Set(curves.filter(row=>availableOptions.some(config=>supported(row,config)))
        .map(row=>row.year).filter(Number.isFinite));
      years.add(firstYear);
      years.add(2005);
      startWave.replaceChildren(...[...years].sort((a,b)=>a-b).map(year=>new Option(String(year),String(year))));
      startWave.value = String(firstYear);
      period = firstYear+'-'+lastYear;
      const profileCurves = curves.filter(row=>row.year>=firstYear&&row.year<=lastYear);
      const commonIncomeShown=compareCommonIncome&&(activeKeys.includes('total_income')||indicator==='income_ratio');
      const dinaWeightsShown = selected.has('PSID') && adjustment.value==='full' && getWeightingMethod()==='dina_income';
      subtitle.textContent = firstYear+'–'+lastYear+' average · '+title+(commonIncomeShown?' · Common total income including net imputed rent':'')+(dinaWeightsShown?' · DINA income weights, PSID waves 2005–2019':'');
      const plotGroups = configs=>configs.map(config=>({...config,
        points:ThresholdProfiles.profiles(profileCurves,config),
        reference:shares ? null : ThresholdProfiles.reference(profileCurves,config),
      })).filter(group=>group.points.length||group.reference?.n);
      currentPanel.groups = plotGroups(curveOptions).map(group=>({...group,
        weightingMethod:group.survey==='PSID'&&group.variant==='full'?getWeightingMethod()
          :compareCommonIncome&&group.survey==='SCF'&&(group.variable==='total_income'||group.indicator==='income_ratio')?'scf_broad_income':'',
      }));
      rawPanel.groups = plotGroups(rawOptions);
      if (canCompare && indicator==='pareto') renderPSIDHeadline(currentPanel.groups);
      drawPlots(title,activeVariables,indicator,canCompare,includeRaw);
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
    const rows = ['dataset,measure,adjustment,period,indicator,estimator,threshold_percentile,estimate,waves,years_used,standard_error,ks_mean,ks_standard_error,ks_waves,panel,weighting_method'];
    for (const panel of panels) {
      for (const {survey,variable,variant,indicator,method,points,reference,weightingMethod} of panel.groups) {
        const prefix = [survey,variable,variant,period,indicator,indicator==='share'?'':method];
        const ks = [reference?.mean,reference?.se,reference?.n||''];
        for (const p of points) rows.push([...prefix,Math.round(p.q*1000000)/10000,
          p.mean,p.n,p.years_used,p.se,...ks,panel.key,weightingMethod||''].join(','));
        if (!points.length && reference?.n) rows.push([...prefix,'','','','','',...ks,panel.key,weightingMethod||''].join(','));
      }
    }
    const url = URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    save(url,'US_quantile_comparison_'+period+'.csv');
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  pngButton.addEventListener('click', () => {
    const charts = panels.filter(panel=>panel.chart);
    const name = 'US_quantile_comparison_'+period+'.png';
    withFigureYAxisTitles(charts.map(panel=>panel.chart), () => {
      if (charts.length===1) {
        save(charts[0].chart.toBase64Image(),name);
      } else if (charts.length>1) {
        const output = make('canvas');
        const scale = charts[0].chart.currentDevicePixelRatio;
        const header = 30*scale;
        const gap = 14*scale;
        output.width = charts.reduce((sum,panel)=>sum+panel.canvas.width,0)+gap;
        output.height = Math.max(...charts.map(panel=>panel.canvas.height))+header;
        const context = output.getContext('2d');
        context.fillStyle = '#fffefa';
        context.fillRect(0,0,output.width,output.height);
        context.fillStyle = '#425367';
        context.font = '600 '+(14*scale)+'px Arial, sans-serif';
        let x = 0;
        for (const panel of charts) {
          context.fillText(panel.heading.textContent,x+10*scale,20*scale);
          context.drawImage(panel.canvas,x,header);
          x += panel.canvas.width+gap;
        }
        save(output.toDataURL('image/png'),name);
      }
    });
  });
  csvButton.disabled = pngButton.disabled = true;
  return {render,resize:resizePlots};
}
