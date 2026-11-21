function initParetoEstimation({host,loadData}){
  const doc=document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;},charts=[];let ready=false,pending;
  host.classList.add('pareto-method');
  host.innerHTML=`<header class="pareto-method-heading"><h2>Pareto estimation</h2><p>Choosing where the tail starts involves a tradeoff. Starting very high leaves few observations and noisy estimates. Starting lower gives more observations, but some may not follow a Pareto pattern. To choose where the Pareto tail begins, we use the KS-based approach of <a href="https://doi.org/10.1137/070710111" target="_blank" rel="noopener noreferrer">Clauset, Shalizi and Newman (2009)</a>, “Power-Law Distributions in Empirical Data,” <i>SIAM Review</i>, 51(4), 661–703.</p></header>
<div class="pareto-method-explanation"><section class="pareto-fit-section"><h3>The two Pareto parameters</h3><p>A Pareto tail is described by its <strong class="pareto-shape">shape <math class="pareto-shape" display="inline" aria-label="shape coefficient zeta"><mi class="pareto-shape">ζ</mi></math></strong> and <strong class="pareto-scale">scale <math class="pareto-scale" display="inline" aria-label="scale, lower cutoff x underline"><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></math></strong>:</p><div class="pareto-method-math"><math display="block" aria-label="Pareto conditional cumulative distribution above x underline"><mrow><msub><mi>F</mi><mtext>P</mtext></msub><mrow><mo stretchy="true">(</mo><mi>x</mi><mo>;</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>,</mo><mi class="pareto-shape">ζ</mi><mo stretchy="true">)</mo></mrow><mo>=</mo><mn>1</mn><mo>−</mo><msup><mrow><mrow><mo stretchy="true">(</mo><mfrac><mi>x</mi><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></mfrac><mo stretchy="true">)</mo></mrow></mrow><mrow><mo>−</mo><mi class="pareto-shape">ζ</mi></mrow></msup><mo>,</mo><mspace width="1em" /><mi>x</mi><mo>≥</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></mrow></math></div>
<div class="pareto-parameters"><p><strong class="pareto-shape">Shape <math class="pareto-shape" display="inline" aria-label="shape coefficient zeta"><mi class="pareto-shape">ζ</mi></math>.</strong> This determines how quickly the tail falls. A lower coefficient means a heavier tail. For a given cutoff, it can be estimated by maximum likelihood (MLE) or from the slope of a log–log survival plot (OLS).</p><p><strong class="pareto-scale">Scale <math class="pareto-scale" display="inline" aria-label="scale, lower cutoff x underline"><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></math>.</strong> This is the lower cutoff where the fitted Pareto tail begins. We try different cutoffs and use the KS criterion to choose the best-fitting tail.</p></div><p class="pareto-paper-reference">See <a href="https://www.dropbox.com/scl/fi/zl65lsrvzd8yrr2kic24n/GHWW_2026.pdf?rlkey=lymccj7wbuqr91rimf39802f5&amp;e=2&amp;dl=0" target="_blank" rel="noopener noreferrer">Section 2.1 of the paper</a>, equations (1)–(2), for the full estimation procedure.</p></section>
<section><h3>Select the scale and shape with KS</h3><p>For each candidate <strong class="pareto-scale">cutoff <math class="pareto-scale" display="inline" aria-label="scale, lower cutoff x underline"><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></math></strong>, estimate the <strong class="pareto-shape">shape <math class="pareto-shape" display="inline" aria-label="shape coefficient zeta"><mi class="pareto-shape">ζ</mi></math></strong> using observations above it. Compare their weighted empirical cumulative distribution with the fitted Pareto distribution. The Kolmogorov–Smirnov (KS) distance is the largest vertical gap between the two:</p><div class="pareto-method-math"><math display="block" aria-label="Kolmogorov–Smirnov distance at the lower cutoff"><mrow><mi>D</mi><mrow><mo stretchy="true">(</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo stretchy="true">)</mo></mrow><mo>=</mo><munder><mi mathvariant="normal">sup</mi><mrow><mi>x</mi><mo>≥</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></mrow></munder><mo stretchy="true">|</mo><msub><mover><mi>F</mi><mo>^</mo></mover><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></msub><mrow><mo stretchy="true">(</mo><mi>x</mi><mo stretchy="true">)</mo></mrow><mo>−</mo><msub><mi>F</mi><mtext>P</mtext></msub><mrow><mo stretchy="true">(</mo><mi>x</mi><mo>;</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>,</mo><mover><mi class="pareto-shape">ζ</mi><mo>^</mo></mover><mrow><mo stretchy="true">(</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo stretchy="true">)</mo></mrow><mo stretchy="true">)</mo></mrow><mo stretchy="true">|</mo></mrow></math></div><p>Repeat this fit across the allowed cutoffs <i>U</i>. Choose the <strong class="pareto-scale">scale <math class="pareto-scale" display="inline" aria-label="scale, lower cutoff x underline"><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder></math></strong> with the smallest KS distance, then retain the <strong class="pareto-shape">shape estimate</strong> fitted at that cutoff.</p><div class="pareto-method-math"><math display="block" aria-label="Choose the lower cutoff that minimizes the KS distance"><mrow><msup><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>*</mo></msup><mo>=</mo><munder><mi mathvariant="normal">arg min</mi><mrow><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>∈</mo><mi>U</mi></mrow></munder><mspace width="0.3em" /><mi>D</mi><mrow><mo stretchy="true">(</mo><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo stretchy="true">)</mo></mrow></mrow></math></div><p>The selected pair is the <strong class="pareto-scale">cutoff <math display="inline"><msup><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>*</mo></msup></math></strong> and its <strong class="pareto-shape">estimated shape <math display="inline"><mover><mi class="pareto-shape">ζ</mi><mo>^</mo></mover><mrow><mo stretchy="true">(</mo><msup><munder class="pareto-scale" accentunder="true"><mi>x</mi><mo stretchy="true">_</mo></munder><mo>*</mo></msup><mo stretchy="true">)</mo></mrow></math></strong>.</p></section></div><section class="pareto-illustration"><h3>Illustration: moving the lower bound</h3><p><span class="pareto-simulation-parameters"></span> The first two panels show the full distribution. The log–log panel compares fits starting at P70, the KS-selected cutoff and P99.5. The KS search runs from P55 to P99.5. The shape panel shows maximum-likelihood estimates in 0.1-percentile steps from P70 to P99. The conditional CDF panels below show the corresponding KS gaps.</p><div class="pareto-overview-grid"></div><h4>Conditional tail fits and KS distances</h4><p>Each step in the empirical CDF represents one observation. At P99.5, only <span class="pareto-high-tail-count"></span> observations remain, so each step is large and the estimate is noisy. At P70, the cutoff reaches into the body of the distribution, where the empirical curve departs from the Pareto fit. The KS criterion selects the cutoff with the smallest maximum vertical gap.</p><div class="pareto-illustration-legend"><span><i class="ks-key-empirical"></i>Empirical CDF</span><span><i class="ks-key-pareto"></i>Fitted Pareto</span><span><i class="ks-key-gap"></i>Maximum KS gap</span></div><div class="pareto-illustration-grid"></div><p class="pareto-illustration-status" role="status">Loading illustration…</p></section>`;
  const grid=host.querySelector('.pareto-illustration-grid'),status=host.querySelector('.pareto-illustration-status'),number=(x,d=3)=>x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const overview=host.querySelector('.pareto-overview-grid'),rangeColors=['#477EAD','#3b8c75','#b94a75'];
  function overviewCard(title,note){const card=el('article','pareto-example-card'),wrap=el('div','pareto-example-chart'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title);wrap.append(canvas);card.append(el('h4','',title),wrap,el('p','pareto-example-readout',note));overview.append(card);return{card,wrap,canvas};}
  const percentileLabel = value => 'P' + value.toLocaleString('en-US', {maximumFractionDigits: 2});
  function cutoffLabels(data) {
    return data.cases.map((sample, i) => percentileLabel(100 * sample.percentile) + (i === 1 ? ' (KS)' : ''));
  }
  function addLogAmountTicks(scale) {
    const first = Math.ceil(Math.log10(scale.min));
    const last = Math.floor(Math.log10(scale.max));
    const step = Math.max(1, Math.ceil((last - first) / 5));
    const ticks = [];
    for (let exponent = last; exponent >= first; exponent -= step) {
      ticks.unshift({value: 10 ** exponent});
    }
    scale.ticks = ticks;
  }
  const logAmountTick = value => value < 0.01 || value >= 1000
    ? value.toExponential(0).replace('e+', 'e')
    : String(value);
  function addCutoffKey({card,wrap},labels){
    const key=el('div','pareto-range-key');
    labels.forEach((label,i)=>{
      const item=el('span','',label);
      item.style.color=rangeColors[i];
      item.prepend(el('i'));
      key.append(item);
    });
    card.insertBefore(key,wrap);
  }
  function cdfCutoffAreas(cases){
    return {
      id:'cdfCutoffAreas',
      beforeDatasetsDraw({ctx,chartArea,scales}){
        const {top,bottom,right}=chartArea;
        const boundaries=[...cases.map(row=>scales.x.getPixelForValue(row.cutoff)),right];
        ctx.save();
        cases.forEach((_,i)=>{
          const left=boundaries[i];
          ctx.fillStyle=rangeColors[i]+'20';
          ctx.fillRect(left,top,boundaries[i+1]-left,bottom-top);
          ctx.strokeStyle=rangeColors[i];
          ctx.setLineDash([4,4]);
          ctx.beginPath();
          ctx.moveTo(left,top);
          ctx.lineTo(left,bottom);
          ctx.stroke();
        });
        ctx.restore();
      }
    };
  }
  function renderOverview(data){
    const labels=cutoffLabels(data);
    const first=overviewCard('The full simulated CDF','The CDF shows all ' + number(data.simulation.n, 0) + ' simulated observations. The shading marks where each cutoff starts.');
    first.canvas.setAttribute('aria-label','The full simulated CDF with cutoffs at '+labels.join(', '));
    addCutoffKey(first,labels);
    charts.push(new Chart(first.canvas,{type:'line',plugins:[cdfCutoffAreas(data.cases)],data:{datasets:[{label:'Empirical CDF',data:data.full_cdf,borderColor:'#4c5664',borderWidth:1.6,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'Cumulative probability: '+number(c.parsed.y)}}},scales:{x:{type:'logarithmic',afterBuildTicks:addLogAmountTicks,title:{display:true,text:'Amount / median (log scale)',font:{size:13}},ticks:{font:{size:13},maxRotation:0,callback:logAmountTick},grid:{display:false}},y:{min:0,max:1,title:{display:true,text:'Cumulative probability',font:{size:13}},ticks:{stepSize:.2,font:{size:13}},grid:{color:'#e9e9ee'}}}}}));
    renderDensity(data);
    const sampleSize = number(data.simulation.n, 0);
    const second = overviewCard('Log–log tail fits',
      'The dots show all ' + sampleSize + ' simulated observations. Dashed lines show the Pareto fits above the three marked cutoffs. A Pareto tail follows a straight line on these log–log axes.');
    second.canvas.setAttribute('aria-label', 'Log–log tail probabilities for all ' + sampleSize +
      ' simulated observations, with fitted Pareto tails at ' + labels.join(', '));
    addCutoffKey(second,labels);
    const tailRegions={id:'paretoTailRegions',beforeDatasetsDraw(chart){const {ctx,chartArea,scales}=chart;ctx.save();ctx.beginPath();ctx.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);ctx.clip();data.cases.forEach((sample,i)=>{const left=scales.x.getPixelForValue(sample.cutoff),top=scales.y.getPixelForValue(sample.tail_mass);ctx.fillStyle=rangeColors[i]+'14';ctx.fillRect(left,top,chartArea.right-left,chartArea.bottom-top);ctx.strokeStyle=rangeColors[i];ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.strokeRect(left,top,chartArea.right-left,chartArea.bottom-top);});ctx.restore();},afterDatasetsDraw(chart){const {ctx,chartArea,scales}=chart;ctx.save();ctx.font='12px Arial';ctx.textBaseline='top';data.cases.forEach((sample,i)=>{const text=i===1?'KS optimum':labels[i],left=Math.min(scales.x.getPixelForValue(sample.cutoff)+6,chartArea.right-ctx.measureText(text).width-5),top=Math.max(chartArea.top+4,scales.y.getPixelForValue(sample.tail_mass)-18);ctx.fillStyle='#fffefa';ctx.fillRect(left-2,top-1,ctx.measureText(text).width+4,15);ctx.fillStyle=rangeColors[i];ctx.fillText(text,left,top);});ctx.restore();}};
    const observed = {
      label: 'Empirical tail probability', data: data.survival, showLine: false,
      backgroundColor: '#4c5664', pointRadius: 1.35, pointHoverRadius: 3, pointHitRadius: 4, order: 1,
    };
    const fittedTails = data.cases.map((sample, i) => ({
      label: labels[i] + ' fit · ζ = ' + number(sample.coefficient, 2), data: sample.survival_fit,
      borderColor: rangeColors[i], borderDash: [6, 4], borderWidth: 2, pointRadius: 0,
    }));
    charts.push(new Chart(second.canvas, {
      type: 'line', plugins: [tailRegions], data: {datasets: [observed, ...fittedTails]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
        plugins: {legend: {display: false}, tooltip: {callbacks: {
          label: c => c.dataset.label + ': ' + number(c.parsed.y, 4),
        }}},
        scales: {
          x: {type: 'logarithmic', min: data.full_cdf[0].x, max: data.cases[0].xright,
            afterBuildTicks: addLogAmountTicks,
            title: {display: true, text: 'Amount / median (log scale)', font: {size: 13}},
            ticks: {font: {size: 13}, maxRotation: 0, callback: logAmountTick}, grid: {display: false}},
          y: {type: 'logarithmic', min: .8 / data.simulation.n, max: 1.08,
            title: {display: true, text: 'Tail probability (log scale)', font: {size: 13}},
            ticks: {font: {size: 13}, callback: v => [1, .1, .01, .001, .0001].includes(v) ? v : ''},
            grid: {color: '#e9e9ee'}},
        },
      },
    }));
  }
  function renderShapeByCutoff(data) {
    const [low, ks] = data.cases;
    const observations = data.survival.map(point => point.x);
    const firstPercentile = 100 * low.percentile;
    const axisEnd = 99;
    const estimates = [];
    for (let step = Math.round(10 * firstPercentile); step <= 10 * axisEnd; step++) {
      const percentile = step / 10;
      const tail = observations.slice(Math.round(percentile * observations.length / 100));
      if (tail.length < 2) break;
      const cutoff = tail[0];
      const logRatios = tail.reduce((sum, value) => sum + Math.log(value / cutoff), 0);
      estimates.push({x: percentile, y: tail.length / logRatios, cutoff, count: tail.length});
    }
    const ksPoint = {x: 100 * (observations.length - ks.n_tail) / observations.length,
      y: ks.coefficient, cutoff: ks.cutoff, count: ks.n_tail};
    const trueShape = data.simulation.shape_upper;
    const trueColor = '#8c572b';
    const ksLabel = 'KS estimate at ' + percentileLabel(ksPoint.x) + ' · ζ = ' + number(ksPoint.y, 2);
    const trueLabel = 'True upper-tail shape · ζ = ' + number(trueShape, 2);
    const shape = overviewCard('Estimated Pareto shape by cutoff',
      'Within a Pareto tail, raising the cutoff changes the scale while the tail falls at the same rate. Because the shape is independent of the scale, the estimates tend to form a plateau when plotted against the cutoff percentile. The KS criterion automatically selects the cutoff with the closest Pareto fit, giving an estimate of where the plateau begins. At the highest cutoffs, estimates get noisy because few observations remain.');
    shape.card.classList.add('pareto-shape-card');
    shape.canvas.setAttribute('aria-label', 'Maximum-likelihood Pareto shape every 0.1 percentile from ' +
      percentileLabel(firstPercentile) + ' to ' + percentileLabel(axisEnd) + '. ' + ksLabel + '. ' + trueLabel + '.');
    const key = el('div', 'pareto-range-key');
    for (const [label, color, className] of [[ksLabel, rangeColors[1], 'pareto-ks-key'], [trueLabel, trueColor, 'pareto-true-key']]) {
      const item = el('span', '', label);
      item.style.color = color;
      item.prepend(el('i', className));
      key.append(item);
    }
    shape.card.insertBefore(key, shape.wrap);

    const guides = {
      id: 'paretoShapeGuides',
      beforeDatasetsDraw({ctx, chartArea, scales}) {
        const {left, right, top, bottom} = chartArea;
        const ksX = scales.x.getPixelForValue(ksPoint.x);
        const ksY = scales.y.getPixelForValue(ksPoint.y);
        const trueY = scales.y.getPixelForValue(trueShape);
        ctx.save();
        ctx.strokeStyle = rangeColors[1];
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(ksX, top);
        ctx.lineTo(ksX, bottom);
        ctx.moveTo(left, ksY);
        ctx.lineTo(right, ksY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = trueColor;
        ctx.beginPath();
        ctx.moveTo(left, trueY);
        ctx.lineTo(right, trueY);
        ctx.stroke();
        ctx.restore();
      },
    };
    charts.push(new Chart(shape.canvas, {
      type: 'scatter', plugins: [guides],
      data: {datasets: [
        {label: 'Estimated shape (MLE)', data: estimates, backgroundColor: '#477EAD', borderWidth: 0,
          pointRadius: 1.35, pointHoverRadius: 4, clip: 5},
        {label: 'KS minimum', data: [ksPoint], backgroundColor: rangeColors[1], borderColor: '#fffefa',
          borderWidth: 1.5, pointRadius: 5, pointHoverRadius: 7, showLine: false, order: -1},
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
        interaction: {mode: 'nearest', axis: 'x', intersect: false},
        plugins: {legend: {display: false}, tooltip: {
          filter: item => item.datasetIndex === 1 || item.raw.count !== ksPoint.count,
          callbacks: {
            title: ([{raw}]) => percentileLabel(raw.x) + ' · ' + number(raw.cutoff, 2) + ' × median',
            label: ({raw}) => 'ζ = ' + number(raw.y, 2) + ' · ' + raw.count + ' observations',
          },
        }},
        scales: {
          x: {type: 'linear', min: firstPercentile, max: axisEnd,
            title: {display: true, text: 'Cutoff percentile', font: {size: 13}},
            ticks: {stepSize: 5, font: {size: 13}, maxRotation: 0, callback: percentileLabel}, grid: {display: false}},
          y: {suggestedMin: trueShape, suggestedMax: trueShape,
            title: {display: true, text: 'Estimated Pareto coefficient (ζ)', font: {size: 13}},
            ticks: {font: {size: 13}, maxTicksLimit: 6}, grid: {color: '#e9e9ee'}},
        },
      },
    }));
  }
  function renderDensity(data){
    const densityLimit = percentileLabel(data.simulation.density_max_percentile);
    const density = overviewCard('Density of the full distribution',
      'Amounts are on a linear scale through ' + densityLimit + '. Shading marks values above each cutoff.');
    const labels=cutoffLabels(data);
    addCutoffKey(density,labels);
    const cutoffs={id:'densityCutoffs',beforeDatasetsDraw(chart){const {ctx,chartArea,scales}=chart;ctx.save();ctx.beginPath();ctx.rect(chartArea.left,chartArea.top,chartArea.width,chartArea.height);ctx.clip();data.cases.forEach((sample,i)=>{const x=scales.x.getPixelForValue(sample.cutoff);ctx.strokeStyle=rangeColors[i];ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,chartArea.top);ctx.lineTo(x,chartArea.bottom);ctx.stroke();});ctx.restore();}};
    charts.push(new Chart(density.canvas,{type:'line',plugins:[cutoffs],data:{datasets:[...data.cases.map((sample,i)=>({label:labels[i]+' tail',data:data.density.filter(p=>p.x>=sample.cutoff),fill:'origin',backgroundColor:rangeColors[i]+'28',borderColor:rangeColors[i],borderWidth:1,pointRadius:0})),{label:'Density',data:data.density,borderColor:'#4c5664',borderWidth:1.6,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+number(c.parsed.y,4)}}},scales:{x:{type:'linear',min:0,max:data.density[data.density.length-1].x,title:{display:true,text:'Amount / median',font:{size:13}},ticks:{font:{size:13},maxRotation:0,maxTicksLimit:7,callback:v=>v.toLocaleString('en-US',{maximumFractionDigits:1})},grid:{display:false}},y:{min:0,title:{display:true,text:'Density',font:{size:13}},ticks:{font:{size:13},maxTicksLimit:6},grid:{color:'#e9e9ee'}}}}}));
  }
  async function render(){if(ready){charts.forEach(c=>c.resize());return;}if(pending)return pending;pending=(async()=>{const data=await loadData();if(!data)throw Error('Missing KS illustration');
    const simulation = data.simulation;
    host.querySelector('.pareto-simulation-parameters').textContent =
      'We draw ' + number(simulation.n, 0) + ' observations from a double-Pareto–lognormal distribution, with upper-tail shape ' +
      simulation.shape_upper + ', lower-tail shape ' + simulation.shape_lower + ', log-scale mean ' +
      String(simulation.meanlog).replace('-', '−') + ' and standard deviation ' + simulation.sdlog + '.';
    host.querySelector('.pareto-high-tail-count').textContent = number(data.cases[2].n_tail, 0);
    renderOverview(data);renderShapeByCutoff(data);
    [data.cases[0],data.cases[2],data.cases[1]].forEach((sample,index)=>{const title=sample===data.cases[1]?'KS-selected cutoff: '+percentileLabel(100*sample.percentile):sample.title;const card=el('article','pareto-example-card'),heading=el('h4','',title),wrap=el('div','pareto-example-chart'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title+': empirical and fitted Pareto CDF with the maximum KS gap');wrap.append(canvas);card.append(heading,wrap,el('p','pareto-example-readout',percentileLabel(100*sample.percentile)+' · Cutoff '+number(sample.cutoff,2)+' × median · '+sample.n_tail+' observations · ζ = '+number(sample.coefficient,2)+' · KS = '+number(sample.KS)));grid.append(card);
      charts.push(new Chart(canvas,{type:'line',data:{datasets:[{label:'Empirical CDF',data:sample.empirical,borderColor:'#4c5664',borderWidth:1.4,pointRadius:0},{label:'Fitted Pareto',data:sample.pareto,borderColor:'#477EAD',borderDash:[6,4],borderWidth:1.8,pointRadius:0},{label:'Maximum KS gap',data:sample.gap,borderColor:'#bd4056',backgroundColor:'#bd4056',borderWidth:3,pointRadius:3,pointHitRadius:8}]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+number(c.parsed.y)}}},scales:{x:{type:'logarithmic',min:sample.xleft,max:sample.xright,title:{display:true,text:'Amount / median (log scale)',font:{size:13}},ticks:{font:{size:13},maxRotation:0,maxTicksLimit:6},grid:{display:false}},y:{min:0,max:1,title:{display:index===0,text:'Cumulative probability',font:{size:13}},ticks:{stepSize:.2,font:{size:13}},grid:{color:'#e9e9ee'}}}}}));
    });
    const ksCurve = data.KS_curve;
    const firstCutoff = ksCurve[0].x;
    const lastCutoff = ksCurve.at(-1).x;
    const card=el('article','pareto-example-card'),wrap=el('div','pareto-example-chart'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','KS distance from '+percentileLabel(firstCutoff)+' to '+percentileLabel(lastCutoff)+', with fits marked at '+cutoffLabels(data).join(', '));wrap.append(canvas);card.append(el('h4','','KS criterion across cutoffs'),wrap,el('p','pareto-example-readout','Minimum at '+percentileLabel(100*data.cases[1].percentile)+' · KS = '+number(data.cases[1].KS)));grid.append(card);
    charts.push(new Chart(canvas,{type:'line',data:{datasets:[{label:'KS distance',data:ksCurve,borderColor:'#4c5664',borderWidth:1.5,pointRadius:0},{label:'Selected cutoffs',data:data.cases.map(c=>({x:100*c.percentile,y:c.KS,case:c.title})),borderColor:'#bd4056',backgroundColor:'#bd4056',pointRadius:5,pointHoverRadius:7,showLine:false,clip:5}]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0]?.raw.case||'Cutoff '+percentileLabel(items[0].parsed.x),label:c=>'KS = '+number(c.parsed.y)}}},scales:{x:{type:'linear',min:firstCutoff,max:lastCutoff,title:{display:true,text:'Lower-bound percentile',font:{size:13}},ticks:{stepSize:5,font:{size:13},maxRotation:0,callback:percentileLabel},grid:{display:false}},y:{min:0,title:{display:true,text:'KS distance',font:{size:13}},ticks:{font:{size:13}},grid:{color:'#e9e9ee'}}}}}));
    status.textContent='';status.hidden=true;status.classList.add('loaded');ready=true;
  })().catch(error=>{pending=null;status.textContent='The illustration could not be loaded. Please reload and try again.';console.error(error);});return pending;}
  return{render,resize:()=>charts.forEach(c=>c.resize())};
}
