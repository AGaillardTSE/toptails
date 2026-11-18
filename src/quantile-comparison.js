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
    PSID: ['#315f87', 'circle', []],
    SCF: ['#7e5687', 'rectRot', [7, 4]],
    CEX_BM_RECON: ['#ad572b', 'crossRot', [5, 4]],
    YODLEE: ['#267c86', 'cross', [9, 4, 2, 4]],
    FORBES: ['#00815a', 'rect', [9, 5]],
    SAEZ_ZUCMAN: ['#a04662', 'triangle', [3, 3]],
  };
  const selected = new Set(surveys.filter(s => ['PSID','CEX_BM_RECON'].includes(s)));
  const household = survey => ['PSID','SCF','CEX_BM_RECON'].includes(survey);
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const percentile = value => 'P' + number.format(value);
  const measureOptions = [
    ['consump_def1','Consumption'], ['total_labor_income','Labor income'],
    ['total_income','Total income'], ['networth_val','Net worth'], ['total_capital_income','Capital income'],
    ...spendingOptions.filter(item => item.key !== 'consump_def1').map(item => [item.key,item.label]),
  ];

  host.classList.remove('quantile-profile-card');
  host.classList.add('explorer-grid');
  host.innerHTML = `<aside class="sidebar quantile-comparison-sidebar" aria-label="Quantile comparison controls">
    <div class="control dataset-control">
      <span class="control-label" id="quantile-v2-datasets-label">Datasets</span>
      <fieldset class="overlay-controls quantile-comparison-datasets" aria-labelledby="quantile-v2-datasets-label"></fieldset>
    </div>
    <section class="quantile-cutoff" aria-labelledby="quantile-v2-cutoff-label">
      <span class="control-label" id="quantile-v2-cutoff-label">Highlight a cutoff</span>
      <div class="quantile-cutoff-presets" role="group" aria-label="Cutoff presets"></div>
      <div class="quantile-custom-cutoff">
        <label for="quantile-v2-percentile">Percentile</label>
        <input id="quantile-v2-percentile" type="number" min="70" max="99" step="0.05" value="95">
      </div>
    </section>
    <div class="quantile-comparison-controls"></div>
    <div class="quantile-comparison-options"></div>
  </aside>
  <div class="plot-surface quantile-comparison-plot">
    <header class="plot-top quantile-comparison-header">
      <div><h2>Compare estimates by quantile</h2><p class="plot-subtitle">Overlay U.S. datasets and compare estimates at the same tail cutoff.</p></div>
      <div class="chart-actions"><button class="text-button" data-action="csv" type="button">Profile CSV</button><button class="text-button" data-action="png" type="button">Figure PNG</button></div>
    </header>
    <div class="quantile-comparison-body">
      <p class="quantile-comparison-status" role="status" hidden></p>
      <div class="quantile-comparison-chart"><canvas role="img" aria-label="Estimates by quantile for the selected U.S. datasets"></canvas></div>
      <div class="quantile-cutoff-readout" aria-live="polite"></div>
      <p class="quantile-comparison-note">Across-wave curves average available estimates separately at each percentile. Coverage can differ across datasets. Click the plot or choose a cutoff in the controls to compare stored estimates.</p>
    </div>
  </div>`;

  const find = selector => host.querySelector(selector);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const controls = find('.quantile-comparison-controls');
  const options = find('.quantile-comparison-options');
  const status = find('.quantile-comparison-status');
  const canvas = find('canvas');
  const csvButton = find('[data-action="csv"]');
  const pngButton = find('[data-action="png"]');
  const cutoffInput = find('#quantile-v2-percentile');
  const presets = new Map();
  let chart, comparison = [], cutoff = 95, request = 0, pending, lastFilter;
  let period = 'all';

  function select(key, title, values) {
    const box = make('div','control');
    const label = make('label','',title);
    const input = make('select');
    input.id = label.htmlFor = 'quantile-v2-' + key;
    box.dataset.field = key;
    input.append(...values.map(([value,text]) => new Option(text,value)));
    box.append(label,input);
    controls.append(box);
    input.addEventListener('change', () => render());
    return input;
  }
  const measure = select('measure','Measure',measureOptions);
  const incomeHelp = createUSTotalIncomeHelp();
  const measureLabel=measure.previousElementSibling;
  const measureTitle=make('span','us-total-income-choice');
  measureLabel.replaceWith(measureTitle);
  measureTitle.append(measureLabel,incomeHelp);
  const indicator = select('indicator','Indicator',[
    ['pareto','Pareto coefficient'], ['wealth_ratio','Relative to that of wealth'],
    ['share','Share above percentile'],
  ]);
  const estimator = select('estimator','Estimator',[['MLE','MLE'],['OLS','OLS']]);
  const year = select('year','Wave / year',[['all','Across-wave average']]);
  const adjustment = select('adjustment','Adjustment',[
    ['full','Reporting + representation'], ['adj','Reporting only'], ['raw','Raw data'],
  ]);
  const weighting = select('weighting','PSID weighting',[
    ['scf_income','SCF income'],['irs_income','IRS income'],['scf_wealth','SCF wealth'],
  ]);
  weighting.addEventListener('change', () => onWeightingChange(weighting.value));
  const capitalDefinitions = metadata.saez_zucman_reference?.capital_income_definitions || {};
  const capital = select('capital','DINA capital gains',Object.entries(capitalDefinitions).map(([key,value])=>[key,value.label]));
  capital.addEventListener('change',()=>onCapitalDefinitionChange(capital.value));

  function checkbox(parent, label, name, onChange) {
    const wrapper = make('label','small-check');
    const input = make('input');
    input.type = 'checkbox';
    input.value = name;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.append(input,label);
    parent.append(wrapper);
    return {wrapper,input};
  }

  const housing = checkbox(options,'Constant imputed rent rate','bp',onHousingChange);
  const cexIncome = checkbox(options,'Show CEX topcoded income','cex_income',onCEXIncomeChange);
  cexIncome.wrapper.title = metadata.cex_optional_income?.warning || 'Topcoding distorts CEX income estimates at the top.';
  const surveyOrder = ['PSID','CEX_BM_RECON','SCF','YODLEE','NIELSEN','FORBES','SAEZ_ZUCMAN'];
  for (const survey of [...surveys].sort((a,b) => surveyOrder.indexOf(a)-surveyOrder.indexOf(b))) {
    const item = make('span','quantile-survey-choice');
    item.dataset.survey = survey;
    const control = checkbox(item,surveyName(survey),survey,checked => {
      if (checked) selected.add(survey);
      else selected.delete(survey);
      render();
    });
    control.input.checked = selected.has(survey);
    const marker = make('span','help-marker hover-help','?');
    marker.tabIndex = 0;
    marker.dataset.tooltip = surveyTooltip(survey);
    marker.setAttribute('aria-label','About '+surveyName(survey));
    item.append(marker);
    find('.quantile-comparison-datasets').append(item);
  }

  for (const value of [70,80,90,95,98,99]) {
    const button = make('button','text-button',percentile(value));
    button.type = 'button';
    button.addEventListener('click', () => setCutoff(value));
    presets.set(value,button);
    find('.quantile-cutoff-presets').append(button);
  }
  cutoffInput.addEventListener('change', () => setCutoff(cutoffInput.valueAsNumber));

  function atCutoff(points) {
    return points.find(point => Math.abs(point.q * 100 - cutoff) < 1e-6);
  }
  const displayValue = value => indicator.value === 'share'
    ? (value * 100).toFixed(1) + '%' : value.toFixed(3);
  function setCutoff(value) {
    if (Number.isFinite(value)) cutoff = Math.round(Math.max(70,Math.min(99,value))*100)/100;
    cutoffInput.value = String(cutoff);
    for (const [key,button] of presets) button.setAttribute('aria-pressed', String(key === cutoff));
    if (chart) chart.draw();
    updateReadout();
  }
  function updateReadout() {
    const readout = find('.quantile-cutoff-readout');
    readout.replaceChildren();
    if (!comparison.length) return;
    readout.append(make('h3','', 'Estimates at '+percentile(cutoff)));
    const list = make('div','quantile-cutoff-values');
    for (const {survey,points,variable} of comparison) {
      const point = atCutoff(points);
      const item = make('div','quantile-cutoff-value');
      item.style.setProperty('--dataset-color',style[survey][0]);
      item.append(make('strong','',surveyName(survey)),make('span','quantile-value',point ? displayValue(point.mean) : '—'));
      const years = point?.years_used.split(';') || [];
      const coverage = years.length > 1 ? years[0] + '–' + years.at(-1) : years[0];
      const unit = ['PSID','SCF'].includes(survey) ? 'wave' : 'year';
      const comment = point
        ? point.n + ' ' + unit + (point.n === 1 ? '' : 's') + ' · ' + coverage +
          (survey === 'CEX_BM_RECON' && variable === 'networth_val' ? ' · Partial net worth' : '')
        : points.length ? 'No stored estimate at ' + percentile(cutoff) : 'Unavailable for this selection';
      item.append(make('span','quantile-value-context',comment));
      list.append(item);
    }
    readout.append(list);
  }

  const highlight = {
    id:'usQuantileHighlight',
    afterDatasetsDraw({ctx, scales, chartArea}) {
      const x = scales.x.getPixelForValue(cutoff);
      ctx.save();
      ctx.strokeStyle = '#283d51';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5,4]);
      ctx.beginPath();
      ctx.moveTo(x,chartArea.top);
      ctx.lineTo(x,chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const {survey,points} of comparison) {
        const point = atCutoff(points);
        if (!point) continue;
        ctx.beginPath();
        ctx.arc(x,scales.y.getPixelForValue(point.mean),4.25,0,2*Math.PI);
        ctx.fillStyle = style[survey][0];
        ctx.fill();
        ctx.strokeStyle = '#fffefa';
        ctx.stroke();
      }
      ctx.font = '600 13px Arial';
      ctx.textAlign = cutoff >= 96 ? 'right' : 'left';
      ctx.fillStyle = '#283d51';
      ctx.fillText(percentile(cutoff),x + (cutoff >= 96 ? -7 : 7),chartArea.top - 7);
      ctx.restore();
    },
  };

  function drawPlot() {
    chart?.destroy();
    chart = null;
    const datasets = comparison.filter(group => group.points.length).map(({survey,points}) => {
      const [color,pointStyle,borderDash] = style[survey];
      return {
        label:surveyName(survey), data:points.map(p => ({x:p.q*100,y:p.mean,n:p.n})),
        borderColor:color, backgroundColor:color, pointStyle, borderDash,
        pointRadius:points.length === 1 ? 4 : 0, pointHoverRadius:5, borderWidth:2.4,
      };
    });
    const visible = datasets.length > 0;
    canvas.parentElement.hidden = !visible;
    csvButton.disabled = pngButton.disabled = !visible;
    status.hidden = visible;
    if (!visible) {
      status.textContent = selected.size ? 'No estimates are available for these selections.' : 'Choose a dataset to see its estimates.';
      setCutoff(cutoff);
      return;
    }
    const title = indicator.selectedOptions[0].textContent;
    canvas.setAttribute('aria-label', title+' for '+measure.selectedOptions[0].textContent+' by tail percentile');
    chart = new Chart(canvas, {
      type:'line', data:{datasets}, plugins:[highlight],
      options:{
        responsive:true, maintainAspectRatio:false, animation:false, parsing:false,
        interaction:{axis:'x',mode:'nearest',intersect:false},
        layout:{padding:{top:20,right:10}},
        onClick(event, elements, activeChart) {
          if (!activeChart.isPointInArea(event)) return;
          const x = activeChart.scales.x.getValueForPixel(event.x);
          const points = datasets.flatMap(dataset => dataset.data);
          const nearest = points.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best);
          setCutoff(nearest.x);
        },
        plugins:{
          legend:{position:'top',onClick:()=>{},labels:{usePointStyle:true,padding:18,font:{size:13}}},
          tooltip:{callbacks:{
            title:items => percentile(items[0].parsed.x),
            label:item => item.dataset.label+': '+displayValue(item.parsed.y)+' · '+item.raw.n+(item.raw.n===1?' estimate':' estimates'),
          }},
        },
        scales:{
          x:{type:'linear',min:70,max:99.25,
            afterBuildTicks:scale=>{scale.ticks=[70,75,80,85,90,95,99].map(value=>({value}));},
            ticks:{callback:percentile,maxRotation:0,font:{size:13}},grid:{display:false},
            title:{display:true,text:'Tail cutoff percentile',font:{size:13}}},
          y:{title:{display:true,text:title,font:{size:13}},grid:{color:'#e8e8ed'},
            ticks:{font:{size:13},callback:value=>indicator.value==='share'?number.format(value*100)+'%':number.format(value)}},
        },
      },
    });
    setCutoff(cutoff);
  }

  async function render() {
    period = year.value || period;
    incomeHelp.hidden = measure.value !== 'total_income';
    capital.closest('.control').hidden = !selected.has('SAEZ_ZUCMAN') || !['total_capital_income','total_income'].includes(measure.value);
    capital.value = Object.keys(capitalDefinitions).find(key => capitalDefinitions[key].author_variant === getCapitalDefinition()) || '';
    estimator.disabled = indicator.value === 'share';
    adjustment.disabled = ![...selected].some(household);
    housing.input.checked = getHousingMethod() === 'bp';
    housing.wrapper.hidden = ![...selected].some(household);
    cexIncome.input.checked = getCEXIncome();
    cexIncome.wrapper.hidden = !selected.has('CEX_BM_RECON');
    weighting.value = getWeightingMethod();
    weighting.closest('.control').hidden = !selected.has('PSID') || adjustment.value !== 'full';
    const ids = surveys.filter(survey => selected.has(survey));
    const filter = JSON.stringify([ids,measure.value,indicator.value,estimator.value,adjustment.value,period,
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
      const curveOptions = ids.map(survey => {
        const variable = measure.value;
        const variant = survey === 'SCF' && adjustment.value === 'full' ? 'adj'
          : household(survey) ? adjustment.value : survey === 'YODLEE' ? 'raw' : 'reference';
        const authorVariant = survey === 'SAEZ_ZUCMAN'
          ? (['total_income','total_capital_income'].includes(variable) ? getCapitalDefinition() : 'dina_2022')
          : survey === 'YODLEE' ? ({
            consump_def1:'durables_4_with_carry',expenditure:'active_unadjusted_same_sample',
            food_total:'enriched_raw',vacation:'active_basic_cleaning',total_income:'active_basic_cleaning',
          })[variable] : null;
        const source = ThresholdProfiles.contractFor(survey,metadata);
        const contract = survey === 'FORBES' ? {...source,profile_window:[.70,.90]} : source;
        return {survey,variant,variable,authorVariant,contract,
          wealthAuthorVariant:survey==='SAEZ_ZUCMAN'?'dina_2022':authorVariant,
          indicator:indicator.value,method:estimator.value};
      });
      const supported = (row, config) => row.survey===config.survey && row.variant===config.variant &&
        row.variable===config.variable && (!config.authorVariant||row.author_variant===config.authorVariant);
      const years = [...new Set(curves.filter(row => curveOptions.some(config=>supported(row,config)))
        .map(row=>row.year).filter(Number.isFinite))].sort((a,b)=>b-a);
      year.replaceChildren(new Option('Across-wave average','all'),...years.map(y=>new Option(String(y),String(y))));
      year.value = years.includes(Number(period)) ? period : 'all';
      period = year.value;
      comparison = curveOptions.map(config => ({...config,points:ThresholdProfiles.profiles(curves,{...config,year:period})}));
      drawPlot();
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
    const rows = ['dataset,measure,adjustment,period,indicator,estimator,threshold_percentile,estimate,waves,years_used'];
    for (const group of comparison) {
      for (const p of group.points) rows.push([group.survey,group.variable,group.variant,period,
        group.indicator,group.indicator==='share'?'':group.method,Math.round(p.q*1000000)/10000,
        p.mean,p.n,p.years_used].join(','));
    }
    const url = URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    save(url,'US_quantile_comparison.csv');
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  pngButton.addEventListener('click', () => { if (chart) save(chart.toBase64Image(),'US_quantile_comparison.png'); });
  csvButton.disabled = pngButton.disabled = true;
  setCutoff(cutoff);
  return {render,resize:()=>chart?.resize()};
}
