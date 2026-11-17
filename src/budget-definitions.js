function initBudgetDefinitions({host,metadata,summary,referencePoints,spendingOptions,getHousingMethod=()=> 'benchmark',getDinaCapitalDefinition=()=> 'including_fiscal_gains'}){
  const doc=document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const sources={
  "PSID": {
    "expenditureIngredients": "Food, health, paid rent, utilities and communications, furniture and equipment purchases, vehicle purchases and running costs, other transport, education and childcare, recreation, computers, travel, clothing and charitable giving.",
    "name": "Panel Study of Income Dynamics (PSID)",
    "unit": "Family units",
    "sample": "Reference person aged 20–80 and positive reported food spending. Biennial waves, 2005–2023; household survey weights. Income and annual consumption use the previous calendar year; wealth and usual food spending refer to interview time.",
    "consumption": "Food at home, meals out and deliveries, household-funded health, paid rent and owner housing services, utilities and communications, furniture and equipment services, vehicle services and operating costs, other transport, education and childcare, recreation, computers, travel, clothing and charitable giving.",
    "labor": "Wages and salaries, bonuses, overtime, tips, commissions, professional-practice income, additional-job income and other labor receipts of the reference person, spouse and other family members, plus 67% of noncorporate business income.",
    "capital": "The remaining 33% of noncorporate business income, cash rents, interest and other family members’ undifferentiated asset income, dividends, incorporated-business receipts and trust income. Add imputed owner rent net of mortgage interest, property taxes, insurance, repairs and maintenance. Deduct interest on credit-card, student, vehicle and other personal debt.",
    "wealth": "Primary housing and other real estate, private businesses, stocks and funds, bank accounts, bonds and other financial assets, IRA balances, vehicles and modeled furniture and home-improvement stocks, less mortgages, vehicle loans and other personal debt.",
    "taxes": "Income taxes are estimated using NBER’s TAXSIM.",
    "housing": true,
    "financial": true
  },
  "SCF": {
    "expenditureIngredients": "Reported nonhousing expenditure and paid rent, with imputed owner rent added in the housing-inclusive measure. The expenditure questions cover food, vacations and other spending.",
    "name": "Survey of Consumer Finances (SCF)",
    "unit": "Primary economic units (families)",
    "sample": "Reference person aged 20–80; original survey weights. Estimates average five imputations. Financial waves cover 1989–2025; relationship samples begin in 2004. Income refers to the preceding calendar year; wealth is measured at interview.",
    "consumption": "Food at home, meals out and deliveries, paid rent and owner housing services, vacation spending, charitable giving and other reported expenditure, where collected. The selected measure combines only its named categories. Broad expenditure and vacation are available in the 2025 module.",
    "labor": "Wages and salaries plus half of the combined self-employment, farm, other business and investment-income bundle, which also contains rents, trusts and royalties.",
    "capital": "The other half of the business, farm, investment, rent, trust and royalty bundle, plus taxable and tax-exempt interest, dividends and realized gains from funds, securities and property. Add owner rent net of mortgage and home-equity interest, property taxes, insurance, repairs and maintenance. Deduct interest on credit-card, student, vehicle and other personal debt.",
    "wealth": "Main and other residential property, nonresidential real estate, private businesses, stocks, funds, deposits, bonds and other financial assets, IRAs, vehicles and other nonfinancial assets, less mortgages, home-equity borrowing and other debt.",
    "financial": true,
    "realized": true
  },
  "CEX_BM_RECON": {
    "expenditureIngredients": "Food at home and away, school and employer-provided meals, alcohol, paid housing, utilities, household operations, supplies and equipment, other lodging, clothing, transport and vehicle purchases, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions. Health, education and charitable giving are outside the headline basket.",
    "name": "Consumer Expenditure Interview Survey (CEX) — Meyer extension",
    "unit": "Consumer units, Meyer equivalence scale and person weights",
    "sample": "Reference person aged 20–80 and positive food spending. Consumption spans 1980–2024 (except 1982); the public extension and partial-wealth measures begin in 1996. Public-use income components are topcoded, severely distorting their upper tails; income estimates are hidden by default and can be enabled in Tails over time or US Estimates by quantile using Show income. Available years depend on the measure and adjustment. The source changes from the supplied historical series to a public reconstruction in 1996; vehicle matching and subsidized rent are approximated.",
    "consumption": "Food at home and away, school and employer-provided meals, alcohol, paid and rental-equivalent housing, utilities, household operations, supplies and equipment, other lodging, clothing, transport and vehicle services, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions. Health, education and charitable giving are outside the headline basket.",
    "spendingScope": "Uses the same Meyer baskets, with vehicle purchases replacing services; health, education and giving are excluded.",
    "wealth": "Checking and savings accounts, certificates of deposit, directly held securities, primary-home and observed secondary-home equity, vehicles and modeled durables, less recorded nonhousing personal and vehicle debt. Housing equity is already net of its associated debt.",
    "housing": true,
    "financial": true,
    "partialWealth": true,
    "optionalLabor": "Optional topcoded income estimates contain wages and salaries plus 67% of business income. Enable Show income in Tails over time or US Estimates by quantile.",
    "optionalCapital": "Optional topcoded income estimates contain 33% of business income, cash rent, interest and dividends, and net imputed owner rent, less personal-debt interest. Topcoding severely distorts these upper tails."
  },
  "SAEZ_ZUCMAN": {
    "name": "Distributional National Accounts (DINA) — Saez–Zucman",
    "unit": "Synthetic adult records",
    "sample": "Adults aged 20+ in 1970–2019, with source population weights. These are reconstructed individual-adult distributions, rather than household survey units; no food-spending requirement or upper-age limit.",
    "labor": "Employee compensation, including wages and supplements, plus the labor share of self-employment income and allocated sales taxes and subsidies. Social-insurance contributions are deducted and the labor share of pension, unemployment and disability benefits is added.",
    "capital": "Housing, equity, interest, business and pension/insurance asset income, plus allocated sales taxes and subsidies, less debt interest. Pension-fund investment income is deducted and the capital share of social-insurance benefits added.",
    "wealth": "Housing, corporate equity, private businesses, currency, deposits, bonds and loans, and pension and life-insurance assets, less mortgages and other household debt. Some assets are reconstructed by capitalizing their income flows.",
    "financial": true,
    "gainsChoice": true
  },
  "YODLEE": {
    "name": "Yodlee (bank data)",
    "unit": "Bank–individual accounts",
    "sample": "One person’s account within the sampled banking system, 2014–2019. Spending at other institutions and cash activity outside the account may be missing. Source SCF income weights improve representativeness.",
    "consumption": "Spending recorded in the observed bank accounts, classified into transaction categories. Food uses grocery and restaurant purchases, while vacation uses travel transactions.",
    "bank": true
  },
  "NIELSEN": {
    "name": "NielsenIQ Consumer Panel",
    "unit": "Panel households",
    "sample": "Annual household retail purchases, 2004–2023, with national household projection weights. Panelists record purchases intended for home use.",
    "consumption": "Recorded retail purchases intended for home use, including food, beverages, household supplies and personal-care products. Housing, meals in restaurants and most services are outside this retail basket.",
    "retail": true
  },
  "FORBES": {
    "name": "Forbes rich lists",
    "unit": "Listed people or family fortunes",
    "sample": "United States, 1982–2024. World’s Billionaires and Forbes 400 entries are combined with overlaps removed. This is a list of large fortunes, rather than a household population sample.",
    "wealth": "Stakes in publicly traded and private businesses, real estate and other assets, less known debts, as valued by Forbes magazine."
  },
  "HFCS": {
    "name": "Household Finance and Consumption Survey (HFCS)",
    "unit": "Households",
    "sample": "Reference persons aged 20–80 where age is observed, with positive food spending. Five imputations and source country–wave weights; Ireland retains all ages where the age field is unavailable.",
    "consumption": "Food at home, meals out, utilities and communications, other goods and services, holidays and vehicle leasing, paid rent and owner housing services, and service flows from vehicles and valuables. Charitable giving is retained where observed. Coverage varies across countries and waves.",
    "labor": "Wages and salaries, pensions and other social transfers, plus two thirds of self-employment income.",
    "capital": "Reported rent and financial income, one third of self-employment income and owner housing services, less debt-interest payments.",
    "wealth": "Real estate, businesses, vehicles and valuables, deposits, bonds, mutual funds, listed shares, managed accounts, private pension and life-insurance assets and other financial assets, less mortgage and nonmortgage debt.",
    "financial": true,
    "alternativeWealth": true
  },
  "HILDA": {
    "name": "Household, Income and Labour Dynamics in Australia (HILDA)",
    "unit": "Households",
    "sample": "Australia, 2006–2022; reference person aged 20–80 and positive source food/recreation spending. Wealth is observed in the 2006, 2010, 2014, 2018 and 2022 modules.",
    "consumption": "Groceries, alcohol and tobacco, clothing and footwear, paid rent and owner housing services, utilities, furniture, electronics and computers, medicines and health services, fuel and transport, vehicle flows, communications, recreation, meals out, private health and other insurance, education, childcare, donations, noncash fringe benefits and home-repair services.",
    "labor": "Wages and salaries, government transfers, and two thirds of self-employment income after business losses.",
    "capital": "Property and investment receipts net of reported losses, one third of self-employment income and imputed owner rent.",
    "wealth": "Nonfinancial assets, financial assets, vehicles and collections, less total household debt, using the source’s broad asset groups.",
    "financial": true
  },
  "SHIW": {
    "name": "Survey of Household Income and Wealth (SHIW)",
    "unit": "Households",
    "sample": "Italy, available waves 1998–2022; reference person aged 20–80 and positive food spending. Household amounts are not equivalized.",
    "consumption": "Food, other nondurable goods and services, actual and imputed housing rent, fringe benefits, and service flows from art, jewelry, personal effects, vehicles, furniture, equipment and home maintenance.",
    "labor": "After-tax wages and salaries, pensions and transfers, two thirds of self-employment income and fringe benefits.",
    "capital": "Financial and rental-property receipts, one third of self-employment income and imputed owner rent, less interest payments.",
    "wealth": "Housing, business and other real assets, deposits, securities and related financial claims, vehicles and other consumer durables, less recorded liabilities.",
    "financial": true
  }
};
  const state={survey:'PSID',consumption:'auto',constantRent:getHousingMethod()==='bp',wealth:'benchmark',bank:'paper',explicit:false};
  host.replaceChildren();host.classList.add('definitions-box','budget-definitions');
  const header=el('header','budget-definition-heading');header.append(el('h2','','From the Household Budget Constraint to Variable Construction'));host.append(header);
  const intro=el('p','definition-intro','The framework and variable definitions follow Section 2.2, equation (1), of the '),paper=el('a','','paper');paper.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';paper.target='_blank';paper.rel='noopener noreferrer';intro.append(paper,'.');host.append(intro);
  const correspondenceNote=el('p','definition-correspondence-note');correspondenceNote.append('Refer to the ');const correspondenceLink=el('a','','correspondence tables');correspondenceLink.href='#panel-adjustments';correspondenceLink.addEventListener('click',event=>{event.preventDefault();doc.getElementById('tab-adjustments')?.click();doc.getElementById('dc-tab-consumption')?.click();const country=doc.getElementById('dc-country-consumption'),survey=doc.getElementById('dc-survey-consumption'),code=state.survey==='HFCS'?state.country:state.survey==='HILDA'?'AU':state.survey==='SHIW'?'IT':'US';if(country&&[...country.options].some(o=>o.value===code)){country.value=code;country.dispatchEvent(new Event('change',{bubbles:true}));}if(survey&&[...survey.options].some(o=>o.value===state.survey)){survey.value=state.survey;survey.dispatchEvent(new Event('change',{bubbles:true}));}});correspondenceNote.append(correspondenceLink,' for details of how survey variables map to national accounts.');host.append(correspondenceNote);
  const controls=el('div','budget-definition-controls other-controls');host.append(controls);
  function select(labelText,items,field){const box=el('div','control budget-definition-control'),label=el('label','',labelText),input=el('select');input.id='definition-'+field;label.htmlFor=input.id;input.setAttribute('aria-label',labelText);items.forEach(([key,text])=>input.add(new Option(text,key)));box.append(label,input);controls.append(box);input.addEventListener('change',()=>{state[field]=input.value;if(field==='survey'){state.explicit=true;state.consumption='auto';state.wealth='benchmark';}if(field==='bank')state.consumption=state.bank==='none'?'expenditure':'consump_def1';render();});return{box,input};}
  const dataset=select('Dataset',Object.entries(sources).map(([key,r])=>[key,r.name]),'survey');
  const country=select('Country',[],'country'),consumption=select('Consumption / spending measure',[],'consumption');
  const housingBox=el('label','budget-housing-option small-check'),housingInput=el('input');housingInput.type='checkbox';housingInput.setAttribute('aria-label','Constant imputed rent rate');housingBox.append(housingInput,doc.createTextNode('Constant imputed rent rate'));controls.append(housingBox);housingInput.addEventListener('change',()=>{state.constantRent=housingInput.checked;render();});
  const wealth=select('Wealth definition',[['benchmark','Benchmark'],['alternative','Alternative component construction']],'wealth');
  const bank=select('Durable correction',[['paper','Four categories (paper)'],['all','All categories'],['none','Expenditure before correction']],'bank');
  controls.append(housingBox);
  const selectedTitle=el('h3','budget-selected-dataset');host.append(selectedTitle);
  const diagram=el('div','budget-diagram-scroll'),grid=el('div','budget-definition-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Budget constraint: c plus the change in a equals y minus T plus r a');diagram.append(grid);host.append(diagram);
  const symbols={c:'<mi>c</mi>',a:'<mo>(</mo><msup><mi>a</mi><mo data-variable-mark>′</mo></msup><mo>−</mo><mi>a</mi><mo>)</mo>',y:'<mi>y</mi>',tax:'<mi>T</mi>',capital:'<mi>r</mi><mi>a</mi>'},operators={a:'+',y:'=',tax:'−',capital:'+'},cards={};
  for(const [key,title] of [['c','Consumption'],['a','Wealth / saving'],['y','Labor income'],['tax','Net taxes'],['capital','Capital income']]){const card=el('article','budget-component budget-component-'+key),symbol=el('div','budget-component-symbol');symbol.innerHTML='<math display="block"><mrow>'+symbols[key]+'</mrow></math>';const heading=el('h4','',title),detail=el('p'),status=el('span','budget-component-status');const column=el('div','budget-diagram-column budget-component-'+key);if(operators[key]){const operator=el('span','budget-between-operator');operator.innerHTML='<math><mo>'+operators[key]+'</mo></math>';operator.setAttribute('aria-hidden','true');column.append(operator);}card.id='budget-explanation-'+key;symbol.setAttribute('aria-describedby',card.id);card.append(heading,status,detail);column.append(symbol,card);grid.append(column);cards[key]={card,detail,status,symbol};}
  const gainTypes=el('p','definition-gains-note');cards.capital.card.append(gainTypes);
  const sample=el('section','definition-sample'),sampleText=el('p'),sampleExtra=el('p');sampleExtra.className='definition-data-extra';sample.append(el('h3','','Data and sample'),sampleText,sampleExtra);host.append(sample);
  const additionalDataNotes={PSID:'Longitudinal panel with broad consumption, income and wealth coverage. Construction includes selected imputations and modeled housing and durable services.',HFCS:'Harmonized European survey; coverage and account definitions vary by country. Harmonized wave labels may differ from a variable’s calendar reference period.',HILDA:'Income covers the financial year ending in the survey-wave year.',SHIW:'Income follows a net-of-tax construction. Health and financial services are omitted from the selected consumption control basket.'};
  const representation=el('section','definition-sample'),representationText=el('p'),scopeText=el('p');representation.append(el('h3','','CEX representation correction'),representationText,scopeText);scopeText.style.marginTop='12px';host.append(representation);
  const appendix=el('p','definition-appendix');appendix.append('See the paper’s ');const link=el('a','','Online Appendix');link.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';link.target='_blank';link.rel='noopener noreferrer';appendix.append(link,' for detailed definitions and construction.');host.append(appendix);
  function render(){
    const source=sources[state.survey];sampleExtra.textContent=additionalDataNotes[state.survey]||'';sampleExtra.hidden=!sampleExtra.textContent;representation.hidden=state.survey!=='CEX_BM_RECON';if(!representation.hidden){representationText.textContent='Matches nonowners and gross primary-home value groups to the latest observed SCF wave at or before each year. Homeowner boundaries are CEX P50, P70, P80, P90 and P95, with an open-ended top cell. Values use common annual prices; target shares average the five SCF imputations. Corrected weights preserve the original all-age consumer-unit total; person weights multiply by family size. Reporting factors are then recalculated.';scopeText.textContent='Scope limitation: SCF housing values reflect the respondent’s ownership share and exclude the farm/ranch business portion. CEX retains the full primary-property market value; ownership-share and farm-value adjustments cannot be harmonized consistently across all years. Housing is a common proxy, rather than an exact ownership-share match or comprehensive net worth. Unknown housing values remain unavailable; public housing values also remain topcoded.';const disclosure=el('a','','BLS disclosure rules');disclosure.href='https://www.bls.gov/cex/pumd_disclosure.htm';disclosure.target='_blank';disclosure.rel='noopener noreferrer';scopeText.append(' ',disclosure,'.');}dataset.input.value=state.survey;dataset.input.title=source.name;selectedTitle.textContent=source.name;
    const international=['HFCS','SHIW','HILDA'].includes(state.survey);
    const availableVariables=new Set([...summary.filter(r=>r.survey===state.survey).map(r=>r.variable),...referencePoints().filter(r=>r.survey===state.survey).map(r=>r.variable)]);
    let options=spendingOptions.filter(o=>availableVariables.has(o.key));if(international)options=[{key:'consump_def1',label:'Consumption'}];if(source.retail)options=[{key:'retail',label:'Retail purchases'}];
    consumption.input.replaceChildren();options.forEach(o=>consumption.input.add(new Option(o.label,o.key)));if(!options.some(o=>o.key===state.consumption))state.consumption=options.some(o=>o.key==='consump_def1')?'consump_def1':options.some(o=>o.key==='expenditure_incl_rent')?'expenditure_incl_rent':options[0]?.key||'';consumption.input.value=state.consumption;if(!options.length)consumption.input.add(new Option('Unavailable',''));consumption.input.disabled=!options.length;consumption.box.classList.toggle('definition-unavailable',!options.length);consumption.input.title=options.find(o=>o.key===state.consumption)?.label||'Unavailable';
    housingInput.disabled=!source.housing;housingInput.checked=!!source.housing&&state.constantRent;housingBox.classList.toggle('definition-unavailable',!source.housing);
    wealth.box.hidden=!source.alternativeWealth;wealth.input.value=state.wealth;bank.box.hidden=!source.bank;bank.input.value=state.bank;
    const countries=metadata.other_survey_methods?.international?.availability?.HFCS?.countries||[];country.box.hidden=state.survey!=='HFCS';if(!country.box.hidden){const old=country.input.value;country.input.replaceChildren();countries.forEach(code=>country.input.add(new Option(metadata.other_survey_methods.international.country_labels[code]||code,code)));country.input.value=countries.includes(state.country)?state.country:countries.includes(old)?old:countries[0];state.country=country.input.value;}
    const cLabel=options.find(o=>o.key===state.consumption)?.label;
    const alternatives={expenditure:'Purchases of goods and services, excluding owner-occupied imputed rent; durable purchases count as spending.',expenditure_incl_rent:'Purchase expenditure plus constructed owner-occupied imputed rent.',food_total:'Food bought for home use, meals eaten out and food deliveries, where observed.',vacation:'Spending on trips and holidays, including the source’s observed travel and lodging items.',food_housing_vacation:'Food, housing (including actual and imputed rent) and vacation spending.',food_housing_vacation_donations_vehicle:'Food, housing, vacation, donations and modeled vehicle services.'},ownerInMeasure=['consump_def1','expenditure_incl_rent','food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(state.consumption);const consumptionText=source.consumption?(cLabel&&cLabel!=='Consumption'?cLabel+'. ':'')+(alternatives[state.consumption]||source.consumption):'Unavailable in the current estimates.';
    cards.c.detail.textContent=consumptionText;if(source.expenditureIngredients&&['expenditure','expenditure_incl_rent'].includes(state.consumption))cards.c.detail.append(' '+source.expenditureIngredients);cards.a.detail.textContent=source.wealth?source.wealth+' The figures use wealth levels a; a′ − a denotes the change in wealth.':'Unavailable in the current estimates.';cards.y.detail.textContent=source.labor||source.optionalLabor||(state.survey==='CEX_BM_RECON'?'Optional topcoded income estimates are available in Tails over time and US Estimates by quantile.':'Unavailable in the current estimates.');cards.tax.detail.textContent=source.taxes||'Taxes net of transfers in the budget constraint; not a separate estimated series in the explorer.';
    let capitalText=source.capital||'Unavailable in the current estimates.';
    if(source.gainsChoice)capitalText+=' Includes fiscal (realized) capital gains.';
    if(source.housing&&state.constantRent){if(ownerInMeasure)cards.c.detail.append(' Owner services use the constant NIPA-matched rent-rate alternative.');if(source.capital)capitalText+=' Net owner rent uses the same constant-rate construction.';}
    if(source.bank){cards.c.detail.append(state.bank==='paper'?' The paper’s service-flow correction applies to ATM/cash withdrawals, check payments, loans and other expenses.':state.bank==='all'?' Durable services are constructed across all saved categories.':' This option keeps spending before the durable-service conversion.');}
    if(source.alternativeWealth&&state.wealth==='alternative')cards.a.detail.textContent='Alternative detailed component construction: dwellings, business assets, consumer durables, deposits and other financial assets, less liabilities. The figures use the stock a.';
    cards.capital.detail.textContent=source.optionalCapital||capitalText;
    for(const [key,available] of [['c',!!source.consumption],['a',!!source.wealth],['y',!!source.labor],['tax',!!source.taxes],['capital',!!source.capital]]){cards[key].card.classList.toggle('definition-unavailable',!available);cards[key].symbol.classList.toggle('definition-unavailable',!available);cards[key].status.textContent=!available?(state.survey==='CEX_BM_RECON'&&['y','capital'].includes(key)?'Optional: topcoded':'Unavailable'):key==='a'&&source.partialWealth?'Partial coverage':'';}
    gainTypes.hidden=!source.capital;gainTypes.textContent=source.realized||source.gainsChoice?'Capital gains: realized only.':'Capital gains: not separated.';
    sampleText.textContent=source.unit+'. '+source.sample;if(state.survey==='CEX_BM_RECON'){sampleText.append(' The 2024 series incorporates the ');const update=el('a','','BLS grocery-field update');update.href='https://www.bls.gov/cex/pumd/errata/errata-2023.htm';update.target='_blank';update.rel='noopener noreferrer';sampleText.append(update,'.');}if(state.survey==='HFCS')sampleText.prepend((metadata.other_survey_methods.international.country_labels[state.country]||state.country)+'. ');
  }
  render();return{render,chooseDefault(surveys){if(!state.explicit){state.survey=surveys.find(s=>sources[s])||'PSID';state.constantRent=getHousingMethod()==='bp';}render();}};
}
