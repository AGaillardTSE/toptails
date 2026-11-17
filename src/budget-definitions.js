function initBudgetDefinitions({host,metadata,summary,referencePoints,spendingOptions,getHousingMethod=()=> 'benchmark',getDinaCapitalDefinition=()=> 'including_fiscal_gains'}){
  const doc=document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const sources={
  "PSID": {
    "expenditureIngredients": "Food, out-of-pocket healthcare and health-insurance premiums, paid rent, utilities and communications, furniture and equipment purchases, vehicle purchases and running costs, other transport, education and childcare, recreation, computers, travel, clothing and charitable giving.",
    "name": "Panel Study of Income Dynamics (PSID)",
    "unit": "Family units",
    "consumption": "Food at home, meals out and deliveries, out-of-pocket healthcare and health-insurance premiums, paid rent and owner housing services, utilities and communications, furniture and equipment services, vehicle services and operating costs, other transport, education and childcare, recreation, computers, travel, clothing and charitable giving.",
    "labor": "Wages and salaries, bonuses, overtime, tips, commissions, professional-practice income, additional-job income and other labor receipts of the reference person, spouse and other family members, plus 67% of noncorporate business income.",
    "capital": "The remaining 33% of noncorporate business income, cash rents, interest and other family members’ undifferentiated asset income, dividends, incorporated-business receipts and trust income. Add imputed owner rent net of mortgage interest, property taxes, insurance, repairs and maintenance. Deduct interest on credit-card, student, vehicle and other personal debt.",
    "wealth": "Primary housing and other real estate, private businesses, stocks and funds, bank accounts, bonds and other financial assets, IRA balances, vehicles and modeled furniture and home-improvement stocks, less mortgages, vehicle loans and other personal debt.",
    "taxes": "Taxes paid minus transfers received. Transfers include Social Security, veterans’ pensions, welfare, food stamps, unemployment and workers’ compensation, and other government benefits. Household income taxes are estimated from household characteristics using NBER’s TAXSIM.",
    "housing": true,
    "financial": true,
    "timeCoverage": "Survey waves 2005–2023. Income and annual consumption refer to the previous calendar year. Wealth is measured at interview.",
    "selection": "Reference person aged 20–80 with positive reported food spending.",
    "representationCorrection": "Adjusted weights match the selected SCF income, IRS income or SCF wealth benchmark.",
    "details": "A longitudinal panel with broad consumption, income and wealth coverage. Cleaning includes selected capital-income imputations and the construction of housing and durable services.",
    "taxAvailable": true,
    "taxStatus": "Estimated"
  },
  "SCF": {
    "name": "Survey of Consumer Finances (SCF)",
    "unit": "Family units",
    "consumption": "Food, rent, owner housing services and charitable donations in the earlier spending modules. The 2025 wave adds broad total expenditure and vacation spending.",
    "labor": "Wages and salaries plus half of the combined self-employment, farm, other business and investment-income bundle, which also contains rents, trusts and royalties.",
    "capital": "The other half of the business, farm, investment, rent, trust and royalty bundle, plus taxable and tax-exempt interest, dividends and realized gains from funds, securities and property. Add owner rent net of mortgage and home-equity interest, property taxes, insurance, repairs and maintenance. Deduct interest on credit-card, student, vehicle and other personal debt.",
    "wealth": "Main and other residential property, nonresidential real estate, private businesses, stocks, funds, deposits, bonds and other financial assets, IRAs, vehicles and other nonfinancial assets, less mortgages, home-equity borrowing and other debt.",
    "financial": true,
    "realized": true,
    "timeCoverage": "Income and wealth data are available in the 1989–2025 surveys. Food and housing measures are available from 2004. Total expenditure and vacation spending are available only in 2025. Income refers to the calendar year before each survey. Wealth is measured at interview.",
    "selection": "Reference person aged 20–80.",
    "weights": "Original survey weights are retained. The SCF oversamples wealthy families.",
    "details": "Missing responses are imputed five times. We average the resulting estimates.",
    "taxes": "Taxes paid minus transfers received, including Social Security, unemployment and workers’ compensation, welfare and other benefits. Federal and state income taxes and payroll taxes are estimated using NBER TAXSIM for historical waves covered by the SCF tax supplement.",
    "taxAvailable": true,
    "taxStatus": "Estimated for covered waves"
  },
  "CEX_BM_RECON": {
    "expenditureIngredients": "Food at home and away, school and employer-provided meals, alcohol, paid housing, utilities, household operations, supplies and equipment, other lodging, clothing, transport and vehicle purchases, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions. Health, education and charitable giving are outside the headline basket.",
    "name": "Consumer Expenditure Interview Survey (CEX) — Meyer extension",
    "unit": "Consumer units",
    "consumption": "Food at home and away, school and employer-provided meals, alcohol, paid and rental-equivalent housing, utilities, household operations, supplies and equipment, other lodging, clothing, transport and vehicle services, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions. Health, education and charitable giving are outside the headline basket.",
    "spendingScope": "Uses the same Meyer baskets, with vehicle purchases replacing services; health, education and giving are excluded.",
    "wealth": "Checking and savings accounts, certificates of deposit, directly held securities, primary-home and observed secondary-home equity, vehicles and modeled durables, less recorded nonhousing personal and vehicle debt. Housing equity is already net of its associated debt.",
    "housing": true,
    "financial": true,
    "partialWealth": true,
    "optionalLabor": "Optional topcoded income estimates contain wages and salaries plus 67% of business income. Enable Show income in Tails over time or US Estimates by quantile.",
    "optionalCapital": "Optional topcoded income estimates contain 33% of business income, cash rent, interest and dividends, and net imputed owner rent, less personal-debt interest. Topcoding severely distorts these upper tails.",
    "timeCoverage": "Consumption covers 1980–2024, except 1982. The public extension and partial-wealth measures start in 1996.",
    "selection": "Reference person aged 20–80 with positive food spending.",
    "representationCorrection": "We reweight the CEX to match homeownership and the distribution of primary-home values in the SCF. We then recalculate the reporting adjustments with these weights.",
    "details": "Spending is adjusted for family size, and estimates use person weights. Income is topcoded and hidden by default. It can be enabled with Show income.",
    "limitation": "Housing definitions differ across the surveys, and some high values are topcoded.",
    "taxes": "Personal taxes less reported transfers, including Social Security, unemployment and veterans’ benefits, welfare and food assistance. BLS uses reported income taxes in early waves and NBER TAXSIM estimates from 2013. Its personal-tax measure excludes payroll contributions. Tax estimates are unavailable in the 2024 public data.",
    "taxAvailable": true,
    "taxStatus": "Reported or estimated, partial coverage"
  },
  "SAEZ_ZUCMAN": {
    "name": "Distributional National Accounts (DINA) — Saez–Zucman",
    "unit": "Individual adults",
    "labor": "Employee compensation, including wages and supplements, plus the labor share of self-employment income and allocated sales taxes and subsidies. Social-insurance contributions are deducted and the labor share of pension, unemployment and disability benefits is added.",
    "capital": "Housing, equity, interest, business and pension/insurance asset income, plus allocated sales taxes and subsidies, less debt interest. Pension-fund investment income is deducted and the capital share of social-insurance benefits added.",
    "wealth": "Housing, corporate equity, private businesses, currency, deposits, bonds and loans, and pension and life-insurance assets, less mortgages and other household debt. Some assets are reconstructed by capitalizing their income flows.",
    "financial": true,
    "gainsChoice": true,
    "timeCoverage": "1970–2019.",
    "selection": "Aged 20 and over.",
    "weights": "Population weights from DINA.",
    "details": "Income and wealth are reconstructed from tax records, surveys and national accounts.",
    "taxes": "DINA records taxes, social contributions and government benefits separately. Its displayed pre-tax income already includes social-insurance adjustments. These must not be counted twice when forming taxes net of transfers.",
    "taxAvailable": true,
    "taxStatus": "Available in the source"
  },
  "YODLEE": {
    "name": "Yodlee (bank data)",
    "unit": "Bank–individual accounts",
    "consumption": "Spending recorded in the observed bank accounts, classified into transaction categories. Food uses grocery and restaurant purchases, while vacation uses travel transactions.",
    "bank": true,
    "timeCoverage": "2014–2019, depending on the spending measure.",
    "selection": "People with observed accounts in the sampled banking system.",
    "representationCorrection": "SCF income weights are used for representativeness.",
    "details": "Accounts at other banks and cash activity outside the observed accounts may be missing. The data do not necessarily cover a person’s or household’s full spending.",
    "taxes": "The observed bank accounts do not provide a complete household measure of taxes paid and transfers received.",
    "taxAvailable": false,
    "taxStatus": "Not observed"
  },
  "NIELSEN": {
    "name": "NielsenIQ Consumer Panel",
    "unit": "Panel households",
    "consumption": "Recorded retail purchases intended for home use, including food, beverages, household supplies and personal-care products. Housing, meals in restaurants and most services are outside this retail basket.",
    "retail": true,
    "timeCoverage": "2004–2023.",
    "selection": "Households record retail purchases intended for home use.",
    "weights": "NielsenIQ household projection weights.",
    "details": "The panel covers retail purchases rather than complete household spending.",
    "taxes": "Retail purchases do not provide household income taxes or transfers.",
    "taxAvailable": false,
    "taxStatus": "Not observed"
  },
  "FORBES": {
    "name": "Forbes rich lists",
    "unit": "Listed people or family fortunes",
    "wealth": "Stakes in publicly traded and private businesses, real estate and other assets, less known debts, as valued by Forbes magazine.",
    "timeCoverage": "United States, 1982–2024.",
    "selection": "US fortunes from the Forbes 400 and World’s Billionaires lists. Duplicate entries are removed.",
    "details": "Fortunes are valued by Forbes magazine. This is a list of large fortunes, not a representative household sample.",
    "taxes": "The rich lists report wealth rather than household taxes or transfers.",
    "taxAvailable": false,
    "taxStatus": "Not observed"
  },
  "HFCS": {
    "name": "Household Finance and Consumption Survey (HFCS)",
    "unit": "Households",
    "consumption": "Food at home, meals out, utilities and communications, other goods and services, holidays and vehicle leasing, paid rent and owner housing services, and service flows from vehicles and valuables. Charitable giving is retained where observed. Coverage varies across countries and waves.",
    "labor": "Wages and salaries, pensions and other social transfers, plus two thirds of self-employment income.",
    "capital": "Reported rent and financial income, one third of self-employment income and owner housing services, less debt-interest payments.",
    "wealth": "Real estate, businesses, vehicles and valuables, deposits, bonds, mutual funds, listed shares, managed accounts, private pension and life-insurance assets and other financial assets, less mortgage and nonmortgage debt.",
    "financial": true,
    "alternativeWealth": true,
    "timeCoverage": "Available survey waves depend on the country.",
    "selection": "Reference person aged 20–80 with positive food spending.",
    "representationCorrection": "Adjusted weights match the income benchmark from the World Inequality Database (WID).",
    "details": "Estimates average five imputations. Definitions and calendar reference periods vary by country.",
    "taxes": "Pensions and social transfers are included in the displayed labor-income measure. A separate household tax-and-transfer term is not constructed for these estimates.",
    "taxAvailable": false,
    "taxStatus": "Not separately constructed"
  },
  "HILDA": {
    "name": "Household, Income and Labour Dynamics in Australia (HILDA)",
    "unit": "Households",
    "consumption": "Groceries, alcohol and tobacco, clothing and footwear, paid rent and owner housing services, utilities, furniture, electronics and computers, medicines and health services, fuel and transport, vehicle flows, communications, recreation, meals out, private health and other insurance, education, childcare, donations, noncash fringe benefits and home-repair services.",
    "labor": "Wages and salaries, government transfers, and two thirds of self-employment income after business losses.",
    "capital": "Property and investment receipts net of reported losses, one third of self-employment income and imputed owner rent.",
    "wealth": "Nonfinancial assets, financial assets, vehicles and collections, less total household debt, using the source’s broad asset groups.",
    "financial": true,
    "timeCoverage": "2006–2022. Wealth is observed in 2006, 2010, 2014, 2018 and 2022. Income covers the financial year ending in the survey-wave year.",
    "selection": "Reference person aged 20–80 with positive food/recreation spending.",
    "representationCorrection": "Adjusted weights match the income benchmark from the World Inequality Database (WID).",
    "details": "Australian household panel. Consumption combines reported spending with housing and durable services.",
    "taxes": "Government transfers are included in the displayed labor-income measure. A separate net-tax term is not constructed for these estimates.",
    "taxAvailable": false,
    "taxStatus": "Not separately constructed"
  },
  "SHIW": {
    "name": "Survey of Household Income and Wealth (SHIW)",
    "unit": "Households",
    "consumption": "Food, other nondurable goods and services, actual and imputed housing rent, fringe benefits, and service flows from art, jewelry, personal effects, vehicles, furniture, equipment and home maintenance.",
    "labor": "After-tax wages and salaries, pensions and transfers, two thirds of self-employment income and fringe benefits.",
    "capital": "Financial and rental-property receipts, one third of self-employment income and imputed owner rent, less interest payments.",
    "wealth": "Housing, business and other real assets, deposits, securities and related financial claims, vehicles and other consumer durables, less recorded liabilities.",
    "financial": true,
    "timeCoverage": "Available Italian survey waves from 1998 to 2022.",
    "selection": "Reference person aged 20–80 with positive food spending.",
    "representationCorrection": "Adjusted weights match the income benchmark from the World Inequality Database (WID).",
    "details": "Income follows an after-tax construction. Household amounts are not adjusted for family size. Health and financial services are outside the selected consumption basket.",
    "taxes": "Wages, pensions/transfers and self-employment income follow an after-tax construction. Transfers are included in displayed labor income. Taxes and transfers must not be applied again.",
    "taxAvailable": false,
    "taxStatus": "Already reflected in income"
  }
};
  const state={survey:'PSID',consumption:'auto',constantRent:getHousingMethod()==='bp',wealth:'benchmark',bank:'paper',explicit:false};
  host.replaceChildren();host.classList.add('definitions-box','budget-definitions');
  const header=el('header','budget-definition-heading');header.append(el('h2','','From the Household Budget Constraint to Variable Construction'));host.append(header);
  const intro=el('p','definition-intro','The framework and variable definitions follow Section 2.2, equation (1), of the '),paper=el('a','','paper');paper.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';paper.target='_blank';paper.rel='noopener noreferrer';intro.append(paper,'.');host.append(intro);
  const correspondenceNote=el('span','definition-correspondence-note');correspondenceNote.append('Refer to the ');const correspondenceLink=el('a','','correspondence tables');correspondenceLink.href='#panel-adjustments';correspondenceLink.addEventListener('click',event=>{event.preventDefault();doc.getElementById('tab-adjustments')?.click();doc.getElementById('dc-tab-consumption')?.click();const country=doc.getElementById('dc-country-consumption'),survey=doc.getElementById('dc-survey-consumption'),code=state.survey==='HFCS'?state.country:state.survey==='HILDA'?'AU':state.survey==='SHIW'?'IT':'US';if(country&&[...country.options].some(o=>o.value===code)){country.value=code;country.dispatchEvent(new Event('change',{bubbles:true}));}if(survey&&[...survey.options].some(o=>o.value===state.survey)){survey.value=state.survey;survey.dispatchEvent(new Event('change',{bubbles:true}));}});correspondenceNote.append(correspondenceLink,' for details of how survey variables map to national accounts.');intro.append(' ',correspondenceNote);
  const controls=el('div','budget-definition-controls other-controls');host.append(controls);
  function select(labelText,items,field){const box=el('div','control budget-definition-control'),label=el('label','',labelText),input=el('select');input.id='definition-'+field;label.htmlFor=input.id;input.setAttribute('aria-label',labelText);items.forEach(([key,text])=>input.add(new Option(text,key)));box.append(label,input);controls.append(box);input.addEventListener('change',()=>{state[field]=input.value;if(field==='survey'){state.explicit=true;state.consumption='auto';state.wealth='benchmark';}if(field==='bank')state.consumption=state.bank==='none'?'expenditure':'consump_def1';render();});return{box,input};}
  const dataset=select('Dataset',Object.entries(sources).map(([key,r])=>[key,r.name]),'survey');
  const country=select('Country',[],'country'),consumption=select('Consumption / spending measure',[],'consumption');
  const housingBox=el('label','budget-housing-option small-check'),housingInput=el('input');housingInput.type='checkbox';housingInput.setAttribute('aria-label','Constant imputed rent rate');housingBox.append(housingInput,doc.createTextNode('Constant imputed rent rate'));controls.append(housingBox);housingInput.addEventListener('change',()=>{state.constantRent=housingInput.checked;render();});
  const wealth=select('Wealth definition',[['benchmark','Benchmark'],['alternative','Alternative component construction']],'wealth');
  const bank=select('Durable correction',[['paper','Four categories (paper)'],['all','All categories'],['none','Expenditure before correction']],'bank');
  controls.append(housingBox);
  const selectedTitle=el('h3','budget-selected-dataset');host.append(selectedTitle);
  const fullEquation=el('div','budget-full-equation');fullEquation.innerHTML="<p class=\"budget-wealth-intro\">Define net wealth as:</p><div class=\"budget-wealth-definition\"><math display=\"block\" aria-label=\"Net wealth equals financial assets, housing, durables and other real assets, less debt\"><mrow><mi>a</mi><mo>=</mo><mrow><msub><mi>p</mi><mi>b</mi></msub><mi>b</mi><mo>+</mo><msub><mi>p</mi><mi>h</mi></msub><mi>h</mi><mo>+</mo><msub><mi>p</mi><mi>d</mi></msub><mi>d</mi><mo>+</mo><msub><mi>p</mi><mi>k</mi></msub><mi>k</mi><mo>−</mo><mi>m</mi></mrow></mrow></math></div><p class=\"budget-variable-key\">Here b denotes financial assets, h housing, d consumer durables, k other real assets and m debt. Prices are p, returns are r, and δ covers depreciation and the associated housing costs. T is taxes paid minus transfers received.</p><p class=\"budget-equation-lead\">We write the household budget constraint as:</p><math display=\"block\" class=\"budget-full-math\" aria-label=\"Full household budget constraint with prices, returns, depreciation and capital gains\"><mrow><mrow class=\"budget-full-term budget-component-c\" data-budget-term=\"c\"><munder><munder accentunder=\"true\"><mrow><msup><mi>c</mi><mtext>ND</mtext></msup><mo>+</mo><mrow><mo stretchy=\"true\">(</mo><msub><mi>r</mi><mi>h</mi></msub><mo>+</mo><msub><mi>δ</mi><mi>h</mi></msub><mo stretchy=\"true\">)</mo></mrow><msub><mi>p</mi><mi>h</mi></msub><mi>h</mi><mo>+</mo><msub><mi>δ</mi><mi>d</mi></msub><msub><mi>p</mi><mi>d</mi></msub><mi>d</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>c</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-a\" data-budget-term=\"a\"><munder><munder accentunder=\"true\"><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow></munder></mrow><mo>=</mo><mrow class=\"budget-full-term budget-component-y\" data-budget-term=\"y\"><munder><munder accentunder=\"true\"><mrow><mi>y</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>y</mi></mrow></munder></mrow><mo>−</mo><mrow class=\"budget-full-term budget-component-tax\" data-budget-term=\"tax\"><munder><munder accentunder=\"true\"><mrow><mi>T</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>T</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-capital\" data-budget-term=\"capital\"><munder><munder accentunder=\"true\"><mrow><munder><mo>∑</mo><mrow><mi>x</mi><mo>∈</mo><mo>{</mo><mi>b</mi><mo>,</mo><mi>h</mi><mo>,</mo><mi>k</mi><mo>,</mo><mi>d</mi><mo>}</mo></mrow></munder><mrow><mo stretchy=\"true\">[</mo><msub><mi>r</mi><mi>x</mi></msub><msub><mi>p</mi><mi>x</mi></msub><mo>+</mo><mrow class=\"budget-price-gains\"><mrow><mo stretchy=\"true\">(</mo><msubsup><mi>p</mi><mi>x</mi><mo>′</mo></msubsup><mo>−</mo><msub><mi>p</mi><mi>x</mi></msub><mo stretchy=\"true\">)</mo></mrow></mrow><mo stretchy=\"true\">]</mo></mrow><mi>x</mi><mo>−</mo><msub><mi>r</mi><mi>m</mi></msub><mi>m</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>r</mi><mi>a</mi></mrow></munder></mrow></mrow></math>";
  const diagram=el('div','budget-diagram-scroll'),grid=el('div','budget-definition-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Budget constraint: c plus the change in a equals y minus T plus r a');diagram.append(fullEquation,grid);host.append(diagram);
  const symbols={c:'<mi>c</mi>',a:'<mo>(</mo><msup><mi>a</mi><mo data-variable-mark>′</mo></msup><mo>−</mo><mi>a</mi><mo>)</mo>',y:'<mi>y</mi>',tax:'<mi>T</mi>',capital:'<mi>r</mi><mi>a</mi>'},operators={a:'+',y:'=',tax:'−',capital:'+'},cards={};
  for(const [key,title] of [['c','Consumption'],['a','Wealth / saving'],['y','Labor income'],['tax','Net taxes'],['capital','Capital income']]){const card=el('article','budget-component budget-component-'+key),symbol=el('div','budget-component-symbol');symbol.innerHTML='<math display="block"><mrow>'+symbols[key]+'</mrow></math>';const heading=el('h4','',title),detail=el('p'),status=el('span','budget-component-status');const column=el('div','budget-diagram-column budget-component-'+key);if(operators[key]){const operator=el('span','budget-between-operator');operator.innerHTML='<math><mo>'+operators[key]+'</mo></math>';operator.setAttribute('aria-hidden','true');column.append(operator);}card.id='budget-explanation-'+key;symbol.setAttribute('aria-describedby',card.id);card.append(heading,status,detail);column.append(symbol,card);grid.append(column);cards[key]={card,detail,status,symbol};}
  const scfCoverage=el('div','definition-scf-coverage');cards.c.card.append(scfCoverage);
  const gainTypes=el('p','definition-gains-note');cards.capital.card.append(gainTypes);
  const sample=el('section','definition-sample'),sampleFields=el('dl','definition-data-facts');sample.append(el('h3','','Data and sample'),sampleFields);host.append(sample);
  const appendix=el('p','definition-appendix');appendix.append('See the paper’s ');const link=el('a','','Online Appendix');link.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';link.target='_blank';link.rel='noopener noreferrer';appendix.append(link,' for detailed definitions and construction.');host.append(appendix);
  function render(){
    const source=sources[state.survey];dataset.input.value=state.survey;dataset.input.title=source.name;selectedTitle.textContent=source.name;
    const international=['HFCS','SHIW','HILDA'].includes(state.survey);
    const availableVariables=new Set([...summary.filter(r=>r.survey===state.survey).map(r=>r.variable),...referencePoints().filter(r=>r.survey===state.survey).map(r=>r.variable)]);
    let options=spendingOptions.filter(o=>availableVariables.has(o.key));if(international)options=[{key:'consump_def1',label:'Consumption'}];if(source.retail)options=[{key:'retail',label:'Retail purchases'}];
    consumption.input.replaceChildren();options.forEach(o=>consumption.input.add(new Option(o.label,o.key)));if(!options.some(o=>o.key===state.consumption))state.consumption=options.some(o=>o.key==='consump_def1')?'consump_def1':options.some(o=>o.key==='expenditure_incl_rent')?'expenditure_incl_rent':options[0]?.key||'';consumption.input.value=state.consumption;if(!options.length)consumption.input.add(new Option('Unavailable',''));consumption.input.disabled=!options.length;consumption.box.classList.toggle('definition-unavailable',!options.length);consumption.input.title=options.find(o=>o.key===state.consumption)?.label||'Unavailable';
    housingInput.disabled=!source.housing;housingInput.checked=!!source.housing&&state.constantRent;housingBox.classList.toggle('definition-unavailable',!source.housing);
    wealth.box.hidden=!source.alternativeWealth;wealth.input.value=state.wealth;bank.box.hidden=!source.bank;bank.input.value=state.bank;
    const countries=metadata.other_survey_methods?.international?.availability?.HFCS?.countries||[];country.box.hidden=state.survey!=='HFCS';if(!country.box.hidden){const old=country.input.value;country.input.replaceChildren();countries.forEach(code=>country.input.add(new Option(metadata.other_survey_methods.international.country_labels[code]||code,code)));country.input.value=countries.includes(state.country)?state.country:countries.includes(old)?old:countries[0];state.country=country.input.value;}
    const cLabel=options.find(o=>o.key===state.consumption)?.label;
    const alternatives={expenditure:'Purchases of goods and services, excluding owner-occupied imputed rent; durable purchases count as spending.',expenditure_incl_rent:'Purchase expenditure plus constructed owner-occupied imputed rent.',food_total:'Food bought for home use, meals eaten out and food deliveries, where observed.',vacation:'Spending on trips and holidays, including the source’s observed travel and lodging items.',food_housing_vacation:'Food, housing (including actual and imputed rent) and vacation spending.',food_housing_vacation_donations_vehicle:'Food, housing, vacation, donations and modeled vehicle services.'},ownerInMeasure=['consump_def1','expenditure_incl_rent','food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(state.consumption);const consumptionText=source.consumption?(cLabel&&cLabel!=='Consumption'?cLabel+'. ':'')+(alternatives[state.consumption]||source.consumption):'Unavailable in the current estimates.';
    let selectedConsumptionText=consumptionText;
    if(state.survey==='SCF'){
      if(['expenditure','expenditure_incl_rent'].includes(state.consumption))selectedConsumptionText='Available only in the 2025 wave. The reported total covers purchases of durable and nondurable goods and services over the previous 12 months. It excludes rent, mortgage payments and retirement contributions. We add rent paid by tenants.'+(state.consumption==='expenditure_incl_rent'?' For homeowners, we also add an estimate of what it would cost to rent their home.':'');
      else if(state.consumption==='vacation')selectedConsumptionText='Vacation spending reported in the 2025 wave only.';
      else if(state.consumption==='food_total')selectedConsumptionText='Food bought for home use, meals out and food deliveries.';
      scfCoverage.hidden=false;scfCoverage.replaceChildren();for(const [label,text] of [['2004–2022','Food, paid rent, owner housing services and charitable donations.'],['2025','Adds broad total expenditure and vacation spending.']]){const line=el('p');line.append(el('strong','',label+': '),text);scfCoverage.append(line);}
    }else{scfCoverage.hidden=true;scfCoverage.replaceChildren();}
    cards.c.detail.textContent=selectedConsumptionText;if(source.expenditureIngredients&&['expenditure','expenditure_incl_rent'].includes(state.consumption))cards.c.detail.append(' '+source.expenditureIngredients);cards.a.detail.textContent=source.wealth?source.wealth+' The estimates describe wealth held at a point in time, a. In the budget constraint, a′ − a is the change in wealth between periods.':'Unavailable in the current estimates.';cards.y.detail.textContent=source.labor||source.optionalLabor||(state.survey==='CEX_BM_RECON'?'Optional topcoded income estimates are available in Tails over time and US Estimates by quantile.':'Unavailable in the current estimates.');cards.tax.detail.textContent=source.taxes||'Taxes paid minus transfers received. A separate estimate of this component is unavailable for this dataset.';
    let capitalText=source.capital||'Unavailable in the current estimates.';
    if(source.gainsChoice)capitalText+=' Includes fiscal (realized) capital gains.';
    if(source.housing&&state.constantRent){if(ownerInMeasure)cards.c.detail.append(' Owner services use the constant NIPA-matched rent-rate alternative.');if(source.capital)capitalText+=' Net owner rent uses the same constant-rate construction.';}
    if(source.bank){cards.c.detail.append(state.bank==='paper'?' The paper’s service-flow correction applies to ATM/cash withdrawals, check payments, loans and other expenses.':state.bank==='all'?' Durable services are constructed across all saved categories.':' This option keeps spending before the durable-service conversion.');}
    if(source.alternativeWealth&&state.wealth==='alternative')cards.a.detail.textContent='Alternative detailed component construction: dwellings, business assets, consumer durables, deposits and other financial assets, less liabilities. The estimates describe wealth held at a point in time, a. In the budget constraint, a′ − a is the change in wealth between periods.';
    cards.capital.detail.textContent=source.optionalCapital||capitalText;
    for(const [key,available] of [['c',!!source.consumption],['a',!!source.wealth],['y',!!source.labor],['tax',!!source.taxAvailable],['capital',!!source.capital]]){cards[key].card.classList.toggle('definition-unavailable',!available);cards[key].symbol.classList.toggle('definition-unavailable',!available);fullEquation.querySelector('[data-budget-term="'+key+'"]').classList.toggle('definition-unavailable',!available);cards[key].status.textContent=key==='tax'&&source.taxStatus?source.taxStatus:!available?(state.survey==='CEX_BM_RECON'&&['y','capital'].includes(key)?'Optional: topcoded':'Unavailable'):key==='a'&&source.partialWealth?'Partial coverage':'';}
    fullEquation.querySelector('.budget-price-gains').classList.toggle('definition-unavailable',!source.realized&&!source.gainsChoice);
    gainTypes.hidden=!source.capital;gainTypes.textContent=source.realized||source.gainsChoice?'Capital gains: realized only.':'Capital gains: not separated.';
    sampleFields.replaceChildren();
    const addFact=(label,value)=>{if(!value)return;sampleFields.append(el('dt','',label+':'),el('dd','',value));};
    addFact('Unit of observation',source.unit);
    let coverage=source.timeCoverage,selection=source.selection;
    if(state.survey==='HFCS'){const waves=state.country==='IE'?[2014,2017,2021]:state.country==='PL'?[2014,2017]:metadata.other_survey_methods?.international?.availability?.HFCS?.waves||[];coverage=waves.join(', ')+'. Calendar reference periods vary by variable.';addFact('Country',metadata.other_survey_methods?.international?.country_labels?.[state.country]||state.country);if(state.country==='IE')selection='Positive food spending. All ages are included because the age field is unavailable.';}
    addFact('Time coverage',coverage);addFact('Sample selection',selection);addFact('Representativeness correction',source.representationCorrection);addFact('Weights',source.weights);addFact('Other details',source.details);addFact('Coverage limitation',source.limitation);

  }
  render();return{render,chooseDefault(surveys){if(!state.explicit){state.survey=surveys.find(s=>sources[s])||'PSID';state.constantRent=getHousingMethod()==='bp';}render();}};
}
