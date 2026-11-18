function initBudgetDefinitions({host,metadata,summary,referencePoints,spendingOptions,getHousingMethod=()=> 'benchmark',getDinaCapitalDefinition=()=> 'including_fiscal_gains'}){
  const doc=document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const sources={
  "PSID": {
    "expenditureIngredients": "Food, out-of-pocket healthcare and health-insurance premiums, paid rent, utilities and communications, furniture and equipment purchases, vehicle purchases and running costs, other transport, education and childcare, recreation, computers, travel, clothing and charitable giving.",
    "name": "Panel Study of Income Dynamics (PSID)",
    "unit": "Family units",
    "consumption": [
      ["nondurable", "Food at home, meals out and deliveries, healthcare paid out of pocket and insurance premiums, actual rent, utilities, communications, vehicle running costs, other transport, education, childcare, recreation, computers, travel, clothing and charitable giving."],
      ["housing", "The rental value of owner-occupied housing, before deducting the costs of ownership."],
      ["durable", "Flows from furniture, equipment and vehicles."]
    ],
    "labor": "Wages and salaries, bonuses, overtime, tips, commissions, professional-practice income, additional-job income and other labor receipts of the reference person, spouse and other family members, plus 67% of noncorporate business income.",
    "capital": [
      ["asset", "Interest, dividends, trust income, other family members’ asset income, cash rents, incorporated-business receipts, and 33% of noncorporate business income."],
      ["netHousing", "Gross imputed rent less mortgage interest, homeowners’ insurance, property taxes, repairs, and maintenance. The PSID construction sets the separate housing depreciation deduction to zero."],
      ["interest", "Subtract interest on credit-card, student, vehicle and other personal debt."]
    ],
    "wealth": [
      ["financial", "Stocks and funds, bank accounts, bonds, IRA balances and other financial assets."],
      ["home", "Primary housing."],
      ["durables", "Vehicles and modeled stocks of furniture and home improvements."],
      ["real", "Other real estate and private businesses."],
      ["debt", "Subtract mortgages, vehicle loans and other personal debt."]
    ],
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
    "consumption": [
      ["nondurable", "Food, rent paid by tenants and charitable donations in earlier spending modules."],
      ["housing", "The rental value of owner-occupied housing before deducting ownership costs."]
    ],
    "labor": "Wages and salaries plus half of the combined self-employment, farm, other business and investment-income bundle, which also contains rents, trusts and royalties.",
    "capital": [
      ["asset", "Half the combined business, farm, investment, rent, trust and royalty bundle, plus taxable and tax-exempt interest and dividends."],
      ["netHousing", "Gross imputed rent less mortgage and home-equity interest, property taxes, insurance, and repairs and maintenance."],
      ["gains", "Realized gains from funds, securities and property."],
      ["interest", "Subtract interest on credit-card, student, vehicle and other personal debt."]
    ],
    "wealth": [
      ["financial", "Stocks, funds, deposits, bonds, IRAs and other financial assets."],
      ["home", "Principal residence."],
      ["durables", "Vehicles."],
      ["real", "Other residential and nonresidential property, private businesses and other nonfinancial assets."],
      ["debt", "Subtract mortgages, home-equity borrowing and other debt."]
    ],
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
    "consumption": [
      ["nondurable", "Food at home and away, school and employer-provided meals, alcohol, actual rent, utilities, household operations and supplies, other lodging, clothing, transport, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions."],
      ["housing", "Rental-equivalent value for owner-occupied housing before deducting ownership costs."],
      ["durable", "Household equipment and vehicle services."]
    ],
    "spendingScope": "Uses the same Meyer baskets, with vehicle purchases replacing services; health, education and giving are excluded.",
    "wealth": [
      ["financial", "Checking and savings accounts, certificates of deposit and directly held securities."],
      ["housingEquity", "Primary-home and observed secondary-home equity, already net of associated housing debt."],
      ["durables", "Vehicles and modeled durables."],
      ["debt", "Subtract recorded nonhousing personal debt and vehicle debt."]
    ],
    "housing": true,
    "financial": true,
    "partialWealth": true,
    "optionalLabor": "Optional topcoded income estimates contain wages and salaries plus 67% of business income. Enable Show income in Tails over time or US Estimates by quantile.",
    "optionalCapital": [
      ["asset", "33% of business income, cash rent, interest and dividends."],
      ["netHousing", "Gross imputed rent less mortgage interest, homeowners’ insurance, property taxes, and the service cost of home repairs."],
      ["interest", "Subtract personal-debt interest."]
    ],
    "timeCoverage": "Consumption covers 1980–2024, except 1982. The public extension and partial-wealth measures start in 1996.",
    "selection": "Reference person aged 20–80 with positive food spending.",
    "representationCorrection": "We reweight the CEX to match homeownership and the distribution of primary-home values in the SCF. We then recalculate the reporting adjustments with these weights.",
    "details": "Spending is adjusted for family size, and estimates use person weights. Income is topcoded and hidden by default. It can be enabled with Show income.",
    "limitation": "Housing definitions differ across the surveys, and some high values are topcoded. From 1996, some missing prices for known owned vehicles are estimated using comparable vehicles from the same year. Confirmed nonowners have zero vehicle services. Cases with insufficient vehicle information remain flagged.",
    "taxes": "Personal taxes less reported transfers, including Social Security, unemployment and veterans’ benefits, welfare and food assistance. BLS uses reported income taxes in early waves and NBER TAXSIM estimates from 2013. Its personal-tax measure excludes payroll contributions. Tax estimates are unavailable in the 2024 public data.",
    "taxAvailable": true,
    "taxStatus": "Reported or estimated, partial coverage"
  },
  "SAEZ_ZUCMAN": {
    "name": "Distributional National Accounts (DINA) — Saez–Zucman",
    "unit": "Individual adults",
    "labor": "Employee compensation, including wages and supplements, plus the labor share of self-employment income and allocated sales taxes and subsidies. Social-insurance contributions are deducted and the labor share of pension, unemployment and disability benefits is added.",
    "capital": [
      ["asset", "Housing, equity, interest, business and pension or insurance asset income, plus allocated sales taxes and subsidies. Pension-fund investment income is deducted and the capital share of social insurance benefits is added."],
      ["gains", "Fiscal (realized) capital gains are included by default."],
      ["interest", "Subtract debt interest."]
    ],
    "wealth": [
      ["financial", "Corporate equity, currency, deposits, bonds, loans, and pension and life-insurance assets. Some assets are inferred from their income flows."],
      ["home", "Housing."],
      ["real", "Private businesses."],
      ["debt", "Subtract mortgages and other household debt."]
    ],
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
    "consumption": [
      ["spending", "Spending recorded in observed accounts. Food uses grocery and restaurant purchases. Vacation uses travel transactions."]
    ],
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
    "consumption": [
      ["purchases", "Retail purchases for home use, including food, beverages, household supplies and personal-care products. The basket excludes housing, restaurant meals and most services."]
    ],
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
    "wealth": [
      ["assets", "Stakes in publicly traded and private businesses, real estate and other assets, as valued by Forbes."],
      ["debt", "Subtract known debts."]
    ],
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
    "consumption": [
      ["nondurable", "Food at home, meals out, utilities, communications, other goods and services, holidays, vehicle leasing and rent paid by tenants. Includes charitable giving where observed."],
      ["housing", "Owner housing services."],
      ["durable", "Service flows from vehicles and valuables."]
    ],
    "labor": "Wages and salaries, pensions and other social transfers, plus two thirds of self-employment income.",
    "capital": [
      ["asset", "Reported rent and financial income, one third of self-employment income and owner housing services."],
      ["interest", "Subtract debt interest."]
    ],
    "wealth": [
      ["financial", "Deposits, bonds, mutual funds, listed shares, managed accounts, private pension and life-insurance assets and other financial assets."],
      ["propertyAndBusiness", "Real estate and businesses."],
      ["durables", "Vehicles and valuables."],
      ["debt", "Subtract mortgage and nonmortgage debt."]
    ],
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
    "consumption": [
      ["nondurable", "Groceries, alcohol and tobacco, clothing and footwear, paid rent, utilities, medicines and health services, fuel and transport, communications, recreation, meals out, insurance, education, childcare, donations and noncash fringe benefits."],
      ["housing", "Owner housing services, including home-repair services in the consumption construction."],
      ["durable", "Furniture, electronics, computers and vehicle flows."]
    ],
    "labor": "Wages and salaries, government transfers, and two thirds of self-employment income after business losses.",
    "capital": [
      ["asset", "Property and investment receipts net of reported losses, one third of self-employment income and imputed owner rent."]
    ],
    "wealth": [
      ["financial", "Financial assets."],
      ["durables", "Vehicles and collections."],
      ["nonfinancial", "Other nonfinancial assets, using the source’s broad groups."],
      ["debt", "Subtract total household debt."]
    ],
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
    "consumption": [
      ["nondurable", "Food, other nondurable goods and services, actual rent and fringe benefits."],
      ["housing", "Imputed rent and services from home maintenance."],
      ["durable", "Service flows from art, jewelry, personal effects, vehicles, furniture and equipment."]
    ],
    "labor": "After-tax wages and salaries, pensions and transfers, two thirds of self-employment income and fringe benefits.",
    "capital": [
      ["asset", "Financial and rental-property receipts, one third of self-employment income and imputed owner rent."],
      ["interest", "Subtract interest payments."]
    ],
    "wealth": [
      ["financial", "Deposits, securities and related financial claims."],
      ["home", "Housing."],
      ["durables", "Vehicles and other consumer durables."],
      ["real", "Business and other real assets."],
      ["debt", "Subtract recorded liabilities."]
    ],
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
  const selectedTitle=el('h3','budget-selected-dataset');
  const fullEquation=el('div','budget-full-equation');fullEquation.innerHTML="<p class=\"budget-equation-lead\"></p><math display=\"block\" class=\"budget-full-math\" aria-label=\"Full household budget constraint with prices, returns, depreciation and capital gains\"><mrow><mrow class=\"budget-full-term budget-component-c\" data-budget-term=\"c\"><munder><munder accentunder=\"true\"><mrow><msup><mi>c</mi><mtext>ND</mtext></msup><mo>+</mo><mrow><mo stretchy=\"true\">(</mo><msub><mi>r</mi><mi>h</mi></msub><mo>+</mo><msub><mi>δ</mi><mi>h</mi></msub><mo stretchy=\"true\">)</mo></mrow><msub><mi>p</mi><mi>h</mi></msub><mi>h</mi><mo>+</mo><msub><mi>δ</mi><mi>d</mi></msub><msub><mi>p</mi><mi>d</mi></msub><mi>d</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>c</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-a\" data-budget-term=\"a\"><munder><munder accentunder=\"true\"><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow></munder></mrow><mo>=</mo><mrow class=\"budget-full-term budget-component-y\" data-budget-term=\"y\"><munder><munder accentunder=\"true\"><mrow><mi>y</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>y</mi></mrow></munder></mrow><mo>−</mo><mrow class=\"budget-full-term budget-component-tax\" data-budget-term=\"tax\"><munder><munder accentunder=\"true\"><mrow><mi>T</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>T</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-capital\" data-budget-term=\"capital\"><munder><munder accentunder=\"true\"><mrow><munder><mo>∑</mo><mrow><mi>x</mi><mo>∈</mo><mo>{</mo><mi>b</mi><mo>,</mo><mi>h</mi><mo>,</mo><mi>k</mi><mo>,</mo><mi>d</mi><mo>}</mo></mrow></munder><mrow><mo stretchy=\"true\">[</mo><msub><mi>r</mi><mi>x</mi></msub><msub><mi>p</mi><mi>x</mi></msub><mo>+</mo><mrow class=\"budget-price-gains\"><mrow><mo stretchy=\"true\">(</mo><msubsup><mi>p</mi><mi>x</mi><mo>′</mo></msubsup><mo>−</mo><msub><mi>p</mi><mi>x</mi></msub><mo stretchy=\"true\">)</mo></mrow></mrow><mo stretchy=\"true\">]</mo></mrow><mi>x</mi><mo>−</mo><msub><mi>r</mi><mi>m</mi></msub><mi>m</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>r</mi><mi>a</mi></mrow></munder></mrow></mrow></math>";
  const diagram=el('div','budget-diagram-scroll');
  const grid=el('div','budget-definition-grid');
  const equationRows=el('div','budget-equation-rows');
  const equation=fullEquation.querySelector('.budget-full-math');
  equationRows.setAttribute('role','group');
  equationRows.setAttribute('aria-label','Household budget constraint: consumption plus the change in wealth equals labor income less net taxes plus capital income.');
  grid.append(equationRows);
  diagram.append(grid);
  host.append(selectedTitle,fullEquation,diagram);

  function termMath(expression){
    const math=doc.createElementNS('http://www.w3.org/1998/Math/MathML','math');
    math.append(expression);
    return math;
  }
  const mathSub=(letter,index)=>`<msub><mi>${letter}</mi><mi>${index}</mi></msub>`;
  const inlineMath=(expression,key)=>`<math class="budget-component-${key}">${expression}</math>`;
  const sub=(letter,index,key)=>inlineMath(mathSub(letter,index),key);
  const notation=fullEquation.querySelector('.budget-equation-lead');
  notation.innerHTML=[
    `Households hold financial assets <var class="budget-component-a">b</var>, owner-occupied housing <var class="budget-component-a">h</var>, consumer durables <var class="budget-component-a">d</var>, and other real assets <var class="budget-component-a">k</var>. Net wealth <var class="budget-component-a">a</var> is the value of these assets at prices ${sub('p','x','a')} less debt <var class="budget-component-a">m</var>.`,
    `Each asset earns a return at rate ${sub('r','x','capital')}. For owner-occupied housing, ${sub('r','h','capital')} is the net rental return rate and ${sub('δ','h','c')} is the rate of housing expenses, including depreciation, maintenance and repairs, property taxes, and mortgage interest.`,
    `Their sum, ${inlineMath(mathSub('r','h')+'<mo>+</mo>'+mathSub('δ','h'),'c')}, is the gross imputed rent rate used in consumption. The rate ${sub('δ','d','c')} measures depreciation on consumer durables.`,
    'Let <var class="budget-component-y">y</var> denote labor income and <var class="budget-component-tax">T</var> denote taxes paid minus transfers received. These definitions give the household budget constraint below.'
  ].join(' ');
  const cards={};
  for(const [key,title] of [['c','Consumption'],['a','Wealth / saving'],['y','Labor income'],['tax','Net taxes'],['capital','Capital income']]){
    const column=el('div','budget-diagram-column budget-component-'+key);
    const card=el('article','budget-component budget-component-'+key);
    const term=equation.querySelector('[data-budget-term="'+key+'"]');
    const operator=term.previousElementSibling;
    const label=el('div','budget-card-term');
    const expansion=el('div','budget-card-expansion');
    const heading=el('h4','',title);
    const detail=el(['c','a','capital'].includes(key)?'div':'p','budget-component-detail');
    const status=el('span','budget-component-status');

    if(operator?.localName==='mo'){
      const mark=el('span','budget-card-operator');
      mark.append(termMath(operator));
      mark.setAttribute('aria-hidden','true');
      label.append(mark);
    }
    const underbrace=term.firstElementChild;
    if(key==='c'||key==='capital'){
      expansion.append(termMath(underbrace.firstElementChild));
      label.append(termMath(underbrace.lastElementChild));
    }else{
      label.append(termMath(underbrace.firstElementChild.firstElementChild));
    }
    if(key==='a')expansion.innerHTML=`<math aria-label="Net wealth equals financial assets, housing, durables and other real assets, less debt"><munder accentunder="true"><mrow><mi>a</mi><mo>=</mo><mrow><msub><mi>p</mi><mi>b</mi></msub><mi>b</mi><mo>+</mo><msub><mi>p</mi><mi>h</mi></msub><mi>h</mi><mo>+</mo><msub><mi>p</mi><mi>d</mi></msub><mi>d</mi><mo>+</mo><msub><mi>p</mi><mi>k</mi></msub><mi>k</mi><mo>−</mo><mi>m</mi></mrow></mrow><mo stretchy="true">⏟</mo></munder></math>`;
    card.id='budget-explanation-'+key;
    label.setAttribute('aria-describedby',card.id);
    card.append(heading,status,detail);
    if(expansion.childElementCount)column.append(expansion);
    column.append(label);
    equationRows.append(column);
    grid.append(card);
    cards[key]={card,detail,status,symbol:label,expansion};
  }
  equation.remove();
  const scfCoverage=el('div','definition-scf-coverage');cards.c.card.append(scfCoverage);
  const sample=el('section','definition-sample'),sampleFields=el('dl','definition-data-facts');sample.append(el('h3','','Data and sample'),sampleFields);host.append(sample);
  const appendix=el('p','definition-appendix');appendix.append('See the paper’s ');const link=el('a','','Online Appendix');link.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';link.target='_blank';link.rel='noopener noreferrer';appendix.append(link,' for detailed definitions and construction.');host.append(appendix);
  const price=asset=>mathSub('p',asset)+'<mi>'+asset+'</mi>';
  const componentTerms={
    nondurable:['Nondurable consumption','<msup><mi>c</mi><mtext>ND</mtext></msup>'],
    housing:['Gross imputed rent','<mo>(</mo>'+mathSub('r','h')+'<mo>+</mo>'+mathSub('δ','h')+'<mo>)</mo>'+price('h')],
    durable:['Durable services',mathSub('δ','d')+price('d')],
    financial:['Financial assets',price('b')],
    home:['Housing',price('h')],
    housingEquity:['Housing equity'],
    propertyAndBusiness:['Real estate and businesses',price('h')+'<mo>+</mo>'+price('k')],
    durables:['Consumer durables',price('d')],
    real:['Real assets',price('k')],
    debt:['Debt','<mo>−</mo><mi>m</mi>'],
    asset:['Asset income',mathSub('r','x')+price('x')],
    netHousing:['Net imputed rent',mathSub('r','h')+price('h')],
    gains:['Capital gains','<mo>(</mo><msubsup><mi>p</mi><mi>x</mi><mo>′</mo></msubsup><mo>−</mo>'+mathSub('p','x')+'<mo>)</mo><mi>x</mi>'],
    interest:['Interest paid','<mo>−</mo>'+mathSub('r','m')+'<mi>m</mi>'],
    spending:['Recorded spending'],
    purchases:['Purchases'],
    assets:['Assets'],
    nonfinancial:['Other nonfinancial assets'],
    conversion:['Durable correction'],
  };
  function renderComponents(detail,rows,notes=[]){
    detail.replaceChildren();
    if(rows?.length){
      const list=el('ul','budget-component-list');
      for(const [key,description] of rows){
        const [name,formula]=componentTerms[key];
        const item=el('li'),label=el('strong','budget-component-label');
        if(formula){
          const math=doc.createElementNS('http://www.w3.org/1998/Math/MathML','math');
          math.innerHTML='<mrow>'+formula+'</mrow>';
          label.append(math,' ');
        }
        label.append(name);
        item.append(label,' ',description);
        list.append(item);
      }
      detail.append(list);
    }
    for(const note of notes)if(note)detail.append(el('p','budget-component-note',note));
    if(!detail.childNodes.length)detail.append(el('p','','Unavailable in the current estimates.'));
  }
  function consumptionComponents(source){
    if(!source.consumption)return {rows:[],notes:[]};
    const measure=state.consumption,owner=['consump_def1','expenditure_incl_rent','food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(measure);
    const scf=state.survey==='SCF';
    const notes=[];
    let rows=source.consumption.slice();
    if(['expenditure','expenditure_incl_rent'].includes(measure)){
      const description=scf
        ? 'The 2025 total covers durable and nondurable purchases in the previous 12 months. It excludes rent, mortgage payments and retirement contributions. Rent paid by tenants is added.'
        : source.bank?'Purchases recorded in the observed bank accounts.':source.expenditureIngredients||'Purchases of goods and services, including durable purchases.';
      rows=[['purchases',description]];
      if(owner)rows.push(['housing','The rental value of owner-occupied housing, before deducting the costs of ownership.']);
    }else if(measure==='food_total'){
      rows=[['nondurable','Food bought for home use, meals eaten out and food deliveries, where observed.']];
    }else if(measure==='vacation'){
      rows=[['nondurable',scf?'Vacation spending reported in the 2025 wave.':'Spending on trips and holidays, including the source’s observed travel and lodging items.']];
    }else if(['food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(measure)){
      const vehicle=measure==='food_housing_vacation_donations_vehicle';
      rows=[['nondurable','Food, rent paid by tenants and vacation spending'+(vehicle?', plus donations.':'.')],['housing','Imputed rent for owner-occupied housing.']];
      if(vehicle)rows.push(['durable','Modeled vehicle services.']);
    }else if(measure!=='consump_def1'&&measure!=='retail'){
      notes.push('The list describes the source’s consumption components. Coverage depends on the selected measure.');
    }
    if(source.housing&&owner&&state.constantRent)notes.push('Owner services use the constant NIPA-matched rent-rate alternative.');
    if(source.bank)rows.push(['conversion',state.bank==='paper'
      ? 'The paper’s service-flow correction applies to ATM or cash withdrawals, check payments, loans and other expenses.'
      : state.bank==='all'
        ? 'Durable services are constructed across all saved categories.'
        : 'Spending before conversion to durable service flows.']);
    if(state.survey==='CEX_BM_RECON'&&measure==='consump_def1')notes.push('Health, education and charitable giving are outside the headline basket.');
    if(state.survey==='HFCS')notes.push('Coverage varies across countries and waves.');
    return {rows,notes};
  }
  function render(){
    const source=sources[state.survey];dataset.input.value=state.survey;dataset.input.title=source.name;
    selectedTitle.textContent=state.survey==='PSID'?'Variable construction/mapping in the '+source.name:'Variable construction/mapping — '+source.name;
    const international=['HFCS','SHIW','HILDA'].includes(state.survey);
    const availableVariables=new Set([...summary.filter(r=>r.survey===state.survey).map(r=>r.variable),...referencePoints().filter(r=>r.survey===state.survey).map(r=>r.variable)]);
    let options=spendingOptions.filter(o=>availableVariables.has(o.key));if(international)options=[{key:'consump_def1',label:'Consumption'}];if(source.retail)options=[{key:'retail',label:'Retail purchases'}];
    consumption.input.replaceChildren();options.forEach(o=>consumption.input.add(new Option(o.label,o.key)));if(!options.some(o=>o.key===state.consumption))state.consumption=options.some(o=>o.key==='consump_def1')?'consump_def1':options.some(o=>o.key==='expenditure_incl_rent')?'expenditure_incl_rent':options[0]?.key||'';consumption.input.value=state.consumption;if(!options.length)consumption.input.add(new Option('Unavailable',''));consumption.input.disabled=!options.length;consumption.box.classList.toggle('definition-unavailable',!options.length);consumption.input.title=options.find(o=>o.key===state.consumption)?.label||'Unavailable';
    housingInput.disabled=!source.housing;housingInput.checked=!!source.housing&&state.constantRent;housingBox.classList.toggle('definition-unavailable',!source.housing);
    wealth.box.hidden=!source.alternativeWealth;wealth.input.value=state.wealth;bank.box.hidden=!source.bank;bank.input.value=state.bank;
    const countries=metadata.other_survey_methods?.international?.availability?.HFCS?.countries||[];country.box.hidden=state.survey!=='HFCS';if(!country.box.hidden){const old=country.input.value;country.input.replaceChildren();countries.forEach(code=>country.input.add(new Option(metadata.other_survey_methods.international.country_labels[code]||code,code)));country.input.value=countries.includes(state.country)?state.country:countries.includes(old)?old:countries[0];state.country=country.input.value;}
    const selectedConsumption=consumptionComponents(source);
    renderComponents(cards.c.detail,selectedConsumption.rows,selectedConsumption.notes);
    scfCoverage.hidden=state.survey!=='SCF';
    scfCoverage.replaceChildren();
    if(!scfCoverage.hidden){
      for(const [label,text] of [['2004–2022','Food, paid rent, owner housing services and charitable donations.'],['2025','Adds broad total expenditure and vacation spending.']]){
        const line=el('p');
        line.append(el('strong','',label+' '),text);
        scfCoverage.append(line);
      }
    }
    const wealthRows=source.alternativeWealth&&state.wealth==='alternative'?[
      ['financial','Deposits and other financial assets.'],
      ['home','Dwellings.'],
      ['durables','Consumer durables.'],
      ['real','Business assets.'],
      ['debt','Subtract liabilities.'],
    ]:source.wealth;
    renderComponents(cards.a.detail,wealthRows,wealthRows?['The estimates measure wealth at a point in time. The term a′ − a is the change in wealth between periods.']:[]);
    cards.y.detail.textContent=source.labor||source.optionalLabor||'Unavailable in the current estimates.';
    cards.tax.detail.textContent=source.taxes||'Taxes paid minus transfers received. A separate estimate of this component is unavailable for this dataset.';
    const capitalNotes=[];
    if(source.optionalCapital)capitalNotes.push('Optional topcoded income estimates. Topcoding severely distorts these upper tails.');
    if(source.housing&&state.constantRent&&source.capital)capitalNotes.push('Net owner rent uses the same constant-rate construction.');
    const capitalRows=(source.capital||source.optionalCapital||[]).slice();
    if(source.capital&&!source.realized&&!source.gainsChoice){
      const interestIndex=capitalRows.findIndex(([key])=>key==='interest');
      capitalRows.splice(interestIndex<0?capitalRows.length:interestIndex,0,['gains','Capital gains are not reported separately.']);
    }
    renderComponents(cards.capital.detail,capitalRows,capitalNotes);
    for(const [key,available] of [['c',!!source.consumption],['a',!!source.wealth],['y',!!source.labor],['tax',!!source.taxAvailable],['capital',!!source.capital]]){cards[key].card.classList.toggle('definition-unavailable',!available);cards[key].symbol.classList.toggle('definition-unavailable',!available);cards[key].expansion.classList.toggle('definition-unavailable',!available);cards[key].status.textContent=key==='tax'&&source.taxStatus?source.taxStatus:!available?(state.survey==='CEX_BM_RECON'&&['y','capital'].includes(key)?'Optional: topcoded':'Unavailable'):key==='a'&&source.partialWealth?'Partial coverage':'';}
    grid.querySelector('.budget-price-gains').classList.toggle('definition-unavailable',!source.realized&&!source.gainsChoice);
    sampleFields.replaceChildren();
    const addFact=(label,value)=>{if(!value)return;sampleFields.append(el('dt','',label+':'),el('dd','',value));};
    addFact('Unit of observation',source.unit);
    let coverage=source.timeCoverage,selection=source.selection;
    if(state.survey==='HFCS'){const waves=state.country==='IE'?[2014,2017,2021]:state.country==='PL'?[2014,2017]:metadata.other_survey_methods?.international?.availability?.HFCS?.waves||[];coverage=waves.join(', ')+'. Calendar reference periods vary by variable.';addFact('Country',metadata.other_survey_methods?.international?.country_labels?.[state.country]||state.country);if(state.country==='IE')selection='Positive food spending. All ages are included because the age field is unavailable.';}
    addFact('Time coverage',coverage);addFact('Sample selection',selection);addFact('Representativeness correction',source.representationCorrection);addFact('Weights',source.weights);addFact('Other details',source.details);addFact('Coverage limitation',source.limitation);

  }
  render();return{render,chooseDefault(surveys){if(!state.explicit){state.survey=surveys.find(s=>sources[s])||'PSID';state.constantRent=getHousingMethod()==='bp';}render();}};
}
