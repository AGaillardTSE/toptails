function initBudgetDefinitions({host,metadata,summary,referencePoints,spendingOptions,getHousingMethod=()=> 'benchmark',getDinaCapitalDefinition=()=> 'including_fiscal_gains'}){
  const doc=document,el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const psidFood='Groceries and other food bought for home use, delivered meals, meals away from home, and the value of food stamps or SNAP benefits.';
  const psidRent='Paid rent enters at the reported amount. For homeowners, we estimate the gross rental value of the main home using rates that vary with home value. The rates are based on homeowners’ own rental estimates from the 2017–2023 waves and are applied across waves.';
  const sources={
  "PSID": {
    "expenditureIngredients": "Food, out-of-pocket healthcare and health-insurance premiums, paid rent, utilities and communications, furniture and equipment purchases, vehicle purchases, leasing and running costs, other transport, education and childcare, recreation, computers, travel, clothing (including jewelry and watches), and charitable giving. Both expenditure measures include rent paid by tenants.",
    "name": "Panel Study of Income Dynamics (PSID)",
    "unit": "Family units",
    "consumption": [
      ["nondurable", [
        psidFood,
        "Health spending includes out-of-pocket hospital, nursing-home, outpatient, dental, prescription and in-home care, plus insurance premiums.",
        "Utilities and communications cover fuel, electricity, water and sewer, phone, television and internet.",
        "Transport includes fuel, insurance and repairs for vehicles, leases, parking, carpooling, public transit and taxis.",
        "Education and childcare include tuition, tutoring, school supplies, school room and board, and childcare.",
        "The basket also includes entertainment, computers, other devices and software, trips and vacations, clothing, footwear, jewelry, watches and charitable giving."
      ].join(' ')],
      ["housing", psidRent],
      ["durable", "Furnishings and equipment include furniture, textiles, floor coverings, appliances and housewares. Their annual service flow uses 15% of new purchases and the remaining stock from earlier waves. Owned vehicles also use a 15% rate applied to estimated values, with additional vehicle payments carried forward as they depreciate. Vehicle lease payments enter as reported spending."]
    ],
    "labor": "Wages and salaries, bonuses, overtime, tips, commissions, professional-practice income, additional-job income and other labor receipts of the reference person, spouse and other family members, plus 67% of noncorporate business income.",
    "capital": [
      ["financialIncome", "Interest and other family members’ recorded asset income. The construction groups dividends with trust income, royalties and the incorporated-business income of owners."],
      ["businessIncome", "Cash rent received by the reference person and spouse or partner, plus the capital share of noncorporate business income (33%)."],
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
    "partialConsumption": true,
    "consumption": [
      ["nondurable", "The survey records food bought for home use, delivered meals and meals eaten out separately. Housing baskets include rent paid by tenants."],
      ["housing", "Gross imputed rent is estimated from the value of owner-occupied housing. It is included in the housing baskets and in total expenditure including imputed rent."],
      ["durable", "Vehicle services are estimated from reported vehicle values for the baskets that include them."]
    ],
    "labor": "Wages and salaries plus half of the combined self-employment, farm, other business and investment-income bundle, which also contains rents, trusts and royalties.",
    "capital": [
      ["financialIncome", "Taxable interest, tax-exempt investment income such as municipal-bond interest, and dividends."],
      ["scfBusinessAndInvestmentIncome", "The construction combines net income from professional practices, businesses and farms with the survey’s combined category for net rent, trusts, royalties and other business or investment income. It assigns half of this total to capital income."],
      ["netHousing", "Gross imputed rent less mortgage and home-equity interest, property taxes, insurance, and repairs and maintenance."],
      ["gains", "Net realized gains or losses from the sale of securities and real estate."],
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
    "expenditureIngredients": "Food at home and away, school and employer-provided meals, alcohol, paid housing, utilities, household operations, supplies and equipment, other lodging, clothing, transport and vehicle purchases, entertainment and reading, personal care, tobacco and personal insurance net of pension contributions.",
    "name": "Consumer Expenditure Interview Survey (CEX) — Meyer extension",
    "unit": "Consumer units",
    "consumption": [
      ["nondurable", "The Interview Survey uses a three-month recall period for most expenses. The basket includes food at home and away, school and employer-provided meals, alcohol, tobacco, paid rent, utilities, household operations and supplies, other lodging, clothing, transport, entertainment and reading, personal care, and personal insurance net of pension contributions."],
      ["housing", "The rental-equivalent value of owner-occupied homes measures housing services before deducting ownership costs. Rent paid by tenants enters separately."],
      ["durable", "Consumption includes services from household equipment and vehicles. Vehicle services use estimated vehicle values, including comparable vehicles from the same year when an owned vehicle’s price is missing. The expenditure measures include vehicle purchases."]
    ],
    "wealth": [
      ["financial", "Checking and savings accounts, certificates of deposit and directly held securities."],
      ["housingEquity", "Primary-home and observed secondary-home equity, already net of associated housing debt."],
      ["durables", "Vehicles and modeled durables."],
      ["debt", "Subtract recorded nonhousing personal debt and vehicle debt."]
    ],
    "housing": true,
    "financial": true,
    "partialWealth": true,
    "optionalLabor": "Optional topcoded income estimates contain wages and salaries plus 67% of business income. Enable Show income in Tails over time or US Tails by quantile.",
    "optionalCapital": [
      ["financialIncome", "Interest and dividends, plus royalties and receipts from estates and trusts where captured by the public income fields."],
      ["businessIncome", "Net cash rental income and the capital share (33%) of income from farm and nonfarm self-employment."],
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
    "consumptionUnavailable": "The DINA estimates in this explorer cover adult income and wealth. They provide no measure of household purchases, owner housing services or durable services.",
    "labor": "Employee compensation, including wages and supplements, plus the labor share of self-employment income and allocated sales taxes and subsidies. Social-insurance contributions are deducted and the labor share of pension, unemployment and disability benefits is added.",
    "capital": [
      ["financialIncome", "Equity income from C and S corporations, interest, and pension and insurance investment income. DINA deducts investment income payable to pension plans and IRAs. It adds a share of pension, disability and unemployment benefits, based on pension investment income as a fraction of that income plus social-insurance contributions. Life-insurance investment income remains included."],
      ["businessIncome", "Income from partnerships and sole proprietorships."],
      ["housingIncome", "Imputed rent from owner-occupied homes and rental income from other properties."],
      ["gains", "Fiscal (realized) capital gains are included by default."],
      ["interest", "Subtract mortgage and nonmortgage interest."]
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
    "taxAvailable": true
  },
  "YODLEE": {
    "name": "Yodlee (bank data)",
    "unit": "Bank–individual accounts",
    "partialConsumption": true,
    "consumption": [
      ["nondurable", "Account payments cover categories such as groceries, restaurants, rent, utilities, communications, education, recreation, travel and giving. The spending total also includes cash withdrawals and checks, which can cover several kinds of purchases."],
      ["housing", "Rent payments can be recorded when they pass through the observed account. The rental value of a home the account holder owns is unobserved."]
    ],
    "labor": "Income recorded in the observed bank account is a proxy for labor income. Coverage depends on which payments reach that account.",
    "laborStatus": "Proxy",
    "capitalUnavailable": "The account inflows provide an income proxy. Separate household capital-income components are unavailable.",
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
    "partialConsumption": true,
    "consumption": [
      ["nondurable", "Households record retail purchases for home use by scanning product barcodes. The estimate uses annual household receipt totals across retail outlets, including food, beverages, household supplies and personal-care goods. This is the retail basket shown alongside the Food measure."],
      ["housing", "Housing services and rent are outside the retail basket."],
      ["durable", "The panel records purchases. It does not construct service flows from durable goods. Restaurant meals and most services are outside the retail basket."]
    ],
    "retail": true,
    "labor": "The panel reports household income in brackets that combine labor and other income.",
    "laborStatus": "Household income brackets",
    "capitalUnavailable": "Household income is reported in brackets. Separate interest, dividends and rents are unavailable.",
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
    "consumptionUnavailable": "The rich lists value assets and debts for listed fortunes. They do not measure purchases or the services households receive from homes and durables.",
    "capitalUnavailable": "Forbes estimates the value of listed fortunes. Income from those assets is unavailable.",
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
      ["nondurable", "Food at home and away, utilities such as water, electricity and gas, communications such as phone and internet, trips and holidays, vehicle leases, and reported donations and similar payments where available. Other goods and services come from a broad spending question. The 2023 wave measures other nondurable spending directly where available."],
      ["housing", "Paid rent enters separately for the main residence and other rented housing. The gross rent equivalent for owner-occupied housing is based on the main home’s value and matched to national accounts in the adjusted estimates."],
      ["durable", "Owned vehicles and valuables enter as annual service flows set at 15% of their reported values. Lease payments enter as spending."]
    ],
    "labor": "Wages and salaries, pensions and other social transfers, plus two thirds of self-employment income.",
    "capital": [
      ["financialIncome", "Interest and dividends from bank deposits, certificates of deposit, managed accounts, bonds, listed shares and mutual funds."],
      ["businessIncome", "Reported real estate rental income and one third of self-employment income. This component also includes income from privately held businesses outside self-employment, which the HFCS reports together with financial investment income."],
      ["housing", "Gross imputed rent on owner-occupied housing enters capital income. Debt interest is deducted separately."],
      ["interest", "Subtract interest on loans for the main home, other properties and other borrowing, estimated from interest rates and outstanding balances."]
    ],
    "wealth": [
      ["financial", "Deposits, bonds, mutual funds, listed shares, managed accounts, private pension and life-insurance assets and other financial assets."],
      ["propertyAndBusiness", "Real estate and businesses."],
      ["durables", "Vehicles and valuables."],
      ["debt", "Subtract mortgage and nonmortgage debt."]
    ],
    "financial": true,
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
      ["nondurable", "Groceries, meals out, alcohol and tobacco, clothing and footwear, paid rent and utilities, prescriptions and health-practitioner fees, insurance, fuel, vehicle running costs, public transport, communications, holidays, recreation, education, childcare and donations. Reported noncash benefits include childcare, parking, computers, housing, vehicles and phone services."],
      ["housing", "Rent paid by tenants enters directly. Gross imputed rent for homeowners is estimated from their reported home values and aligned with national accounts in the adjusted estimates."],
      ["durable", "Furniture, large appliances and electronics, and computers enter at reported spending. New and used vehicle purchases and major home repairs are converted to service flows. Vehicle fuel and running costs enter separately."]
    ],
    "labor": "Wages and salaries, government transfers, and two thirds of self-employment income after business losses.",
    "capital": [
      ["financialIncome", "Interest, dividends and royalties from the household’s investment-income total."],
      ["businessIncome", "Rental income and one third of self-employment income after business losses. The estimates use HILDA’s combined total for financial receipts and rents, net of reported investment losses for the financial year."],
      ["housing", "Gross imputed rent is estimated from the value of the owner-occupied home. The reporting adjustment scales it to Australian national accounts."]
    ],
    "wealth": [
      ["financial", "Bank accounts, superannuation, cash and equity investments, trust funds, and the cash value of life insurance."],
      ["propertyAndBusiness", "The principal home, other property, and business assets. Vehicles and collectibles are counted separately."],
      ["durables", "Vehicles and collectibles."],
      ["debt", "Subtract home and other property debt, business debt, student loans, credit-card balances, and other personal debt."]
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
  "HBS": {
    "name": "Eurostat Household Budget Survey (HBS)",
    "unit": "Households",
    "consumption": [
      ["nondurable", "The basket covers 47 spending categories, including food, clothing, utilities, health, transport, communication, education and recreation."],
      ["housing", "Housing spending includes the survey’s imputed rent for homeowners."],
      ["durable", "Vehicles enter at their purchase cost."]
    ],
    "timeCoverage": "Available waves in 2010, 2015 and 2020 for 11 European countries.",
    "selection": "Households with positive consumption spending.",
    "representationCorrection": "Where available, weights match post-tax income shares from the World Inequality Database (WID).",
    "details": "Consumption categories are rescaled to national accounts. The income series measures annual net monetary household income, and reporting adjustments leave its amounts unchanged.",
    "limitation": "France and Italy have no fully adjusted estimates. Italy has no income series."
  },
  "SHIW": {
    "name": "Survey of Household Income and Wealth (SHIW)",
    "unit": "Households",
    "consumption": [
      ["nondurable", "Reported food, other nondurables and services such as clothing, regular transport and personal care, rent paid by tenants, and noncash fringe benefits. Reported accident and health-insurance premiums are added where available."],
      ["housing", "Gross imputed rent is based on the survey’s estimate of what the home would rent for. Major home maintenance expenses contribute separately to durable services."],
      ["durable", "Annual service flows use 15% of the reported stock values of vehicles, household durables, and valuables such as jewelry, art and antiques. The construction also applies this rate to purchases of other household durables and major maintenance."]
    ],
    "labor": "After-tax wages and salaries, pensions and transfers, two thirds of self-employment income and fringe benefits.",
    "capital": [
      ["financialIncome", "Returns on deposits, government securities and other securities, estimated by the Bank of Italy from balances and after-tax yields."],
      ["businessIncome", "Actual rents and one third of net self-employment and entrepreneurial income."],
      ["housing", "Imputed rent on owner-occupied homes, based on the survey’s rental values and rescaled to national accounts in the adjusted estimates."],
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
    "details": "Income follows an after-tax construction. Household amounts are not adjusted for family size. The consumption benchmark excludes the separate national-account categories for health and financial services.",
    "taxes": "Wages, pensions/transfers and self-employment income follow an after-tax construction. Transfers are included in displayed labor income. Taxes and transfers must not be applied again.",
    "taxAvailable": false,
    "taxStatus": "Already reflected in income"
  }
};
  const state={survey:'PSID',consumption:'auto',constantRent:getHousingMethod()==='bp',bank:'paper',explicit:false};
  host.replaceChildren();host.classList.add('definitions-box','budget-definitions');
  const header=el('header','budget-definition-heading');header.append(el('h2','','From the Household Budget Constraint to Variable Construction'));host.append(header);
  const intro=el('p','definition-intro','The framework and variable definitions follow Section 2.2, equation (1), of the '),paper=el('a','','paper');paper.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';paper.target='_blank';paper.rel='noopener noreferrer';intro.append(paper,'.');host.append(intro);
  const correspondenceNote=el('span','definition-correspondence-note');correspondenceNote.append('Refer to the ');const correspondenceLink=el('a','','correspondence tables');correspondenceLink.href='#panel-adjustments';correspondenceLink.addEventListener('click',event=>{event.preventDefault();doc.getElementById('tab-adjustments')?.click();doc.getElementById('dc-tab-consumption')?.click();const country=doc.getElementById('dc-country-consumption'),survey=doc.getElementById('dc-survey-consumption'),code=state.survey==='HFCS'?state.country:state.survey==='HILDA'?'AU':state.survey==='SHIW'?'IT':'US';if(country&&[...country.options].some(o=>o.value===code)){country.value=code;country.dispatchEvent(new Event('change',{bubbles:true}));}if(survey&&[...survey.options].some(o=>o.value===state.survey)){survey.value=state.survey;survey.dispatchEvent(new Event('change',{bubbles:true}));}});correspondenceNote.append(correspondenceLink,' for details of how survey variables map to national accounts.');intro.append(' ',correspondenceNote);
  const controls=el('div','budget-definition-controls other-controls');host.append(controls);
  function select(labelText,items,field){const box=el('div','control budget-definition-control'),label=el('label','',labelText),input=el('select');input.id='definition-'+field;label.htmlFor=input.id;input.setAttribute('aria-label',labelText);items.forEach(([key,text])=>input.add(new Option(text,key)));box.append(label,input);controls.append(box);input.addEventListener('change',()=>{state[field]=input.value;if(field==='survey'){state.explicit=true;state.consumption='auto';}if(field==='bank')state.consumption=state.bank==='none'?'expenditure':'consump_def1';render();});return{box,input};}
  const dataset=select('Dataset',Object.entries(sources).map(([key,r])=>[key,r.name]),'survey');
  const country=select('Country',[],'country'),consumption=select('Consumption / spending measure',[],'consumption');
  const housingBox=el('label','budget-housing-option small-check'),housingInput=el('input');housingInput.type='checkbox';housingInput.setAttribute('aria-label','Constant imputed rent rate');housingBox.append(housingInput,doc.createTextNode('Constant imputed rent rate'));controls.append(housingBox);housingInput.addEventListener('change',()=>{state.constantRent=housingInput.checked;render();});
  const bank=select('Durable correction',[['paper','Four categories (paper)'],['all','All categories'],['none','Expenditure before correction']],'bank');
  controls.append(housingBox);
  const accountingTitle=el('h3','budget-selected-dataset');
  const fullEquation=el('div','budget-full-equation');fullEquation.innerHTML="<p class=\"budget-equation-lead\"></p><math display=\"block\" class=\"budget-full-math\" aria-label=\"Full household budget constraint with prices, returns, depreciation and capital gains\"><mrow><mrow class=\"budget-full-term budget-component-c\" data-budget-term=\"c\"><munder><munder accentunder=\"true\"><mrow><msup><mi>c</mi><mtext>ND</mtext></msup><mo>+</mo><mrow><mo stretchy=\"true\">(</mo><msub><mi>r</mi><mi>h</mi></msub><mo>+</mo><msub><mi>δ</mi><mi>h</mi></msub><mo stretchy=\"true\">)</mo></mrow><msub><mi>p</mi><mi>h</mi></msub><mi>h</mi><mo>+</mo><msub><mi>δ</mi><mi>d</mi></msub><msub><mi>p</mi><mi>d</mi></msub><mi>d</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>c</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-a\" data-budget-term=\"a\"><munder><munder accentunder=\"true\"><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mrow><msup><mi>a</mi><mo>′</mo></msup><mo>−</mo><mi>a</mi></mrow></mrow></munder></mrow><mo>=</mo><mrow class=\"budget-full-term budget-component-y\" data-budget-term=\"y\"><munder><munder accentunder=\"true\"><mrow><mi>y</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>y</mi></mrow></munder></mrow><mo>−</mo><mrow class=\"budget-full-term budget-component-tax\" data-budget-term=\"tax\"><munder><munder accentunder=\"true\"><mrow><mi>T</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>T</mi></mrow></munder></mrow><mo>+</mo><mrow class=\"budget-full-term budget-component-capital\" data-budget-term=\"capital\"><munder><munder accentunder=\"true\"><mrow><munder><mo>∑</mo><mrow><mi>x</mi><mo>∈</mo><mo>{</mo><mi>b</mi><mo>,</mo><mi>h</mi><mo>,</mo><mi>k</mi><mo>,</mo><mi>d</mi><mo>}</mo></mrow></munder><mrow><mo stretchy=\"true\">[</mo><msub><mi>r</mi><mi>x</mi></msub><msub><mi>p</mi><mi>x</mi></msub><mo>+</mo><mrow class=\"budget-price-gains\"><mrow><mo stretchy=\"true\">(</mo><msubsup><mi>p</mi><mi>x</mi><mo>′</mo></msubsup><mo>−</mo><msub><mi>p</mi><mi>x</mi></msub><mo stretchy=\"true\">)</mo></mrow></mrow><mo stretchy=\"true\">]</mo></mrow><mi>x</mi><mo>−</mo><msub><mi>r</mi><mi>m</mi></msub><mi>m</mi></mrow><mo stretchy=\"true\">⏟</mo></munder><mrow><mi>r</mi><mi>a</mi></mrow></munder></mrow></mrow></math>";
  const diagram=el('div','budget-diagram-scroll');
  const grid=el('div','budget-definition-grid');
  const equationRows=el('div','budget-equation-rows');
  const equation=fullEquation.querySelector('.budget-full-math');
  equationRows.setAttribute('role','group');
  equationRows.setAttribute('aria-label','Household budget constraint: consumption plus the change in wealth equals labor income less net taxes plus capital income.');
  grid.append(equationRows);
  diagram.append(grid);
  host.append(accountingTitle,fullEquation,diagram);

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
    `Let <var class="budget-component-a">b</var> denote financial assets, <var class="budget-component-a">h</var> owner-occupied housing, <var class="budget-component-a">d</var> consumer durables, and <var class="budget-component-a">k</var> other real assets. Net wealth <var class="budget-component-a">a</var> is the value of these assets at prices ${sub('p','x','a')} less debt <var class="budget-component-a">m</var>.`,
    `Each asset earns a return at rate ${sub('r','x','capital')}. For owner-occupied housing, ${sub('r','h','capital')} is the net rental return rate and ${sub('δ','h','c')} is the rate of housing expenses, including depreciation, maintenance and repairs, property taxes, and mortgage interest.`,
    `Their sum, ${inlineMath(mathSub('r','h')+'<mo>+</mo>'+mathSub('δ','h'),'c')}, is the gross imputed rent rate used in consumption. The rate ${sub('δ','d','c')} measures depreciation on consumer durables.`,
    'Let <var class="budget-component-y">y</var> denote labor income and <var class="budget-component-tax">T</var> denote taxes paid minus transfers received. These definitions give the household budget constraint below.'
  ].join(' ');
  const cards={};
  for(const [key,title] of [['c','Consumption'],['a','Wealth/savings'],['y','Labor income'],['tax','Net taxes'],['capital','Capital income']]){
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
    cards[key]={card,detail,status,symbol:label,expansion,heading,title};
  }
  equation.remove();
  const sample=el('section','definition-sample'),sampleFields=el('dl','definition-data-facts');sample.append(el('h3','','Data and sample'),sampleFields);host.append(sample);
  const appendix=el('p','definition-appendix');appendix.append('See the paper’s ');const link=el('a','','Supplemental Appendix');link.href='https://www.dropbox.com/scl/fi/bxfxrio8taz6bywwjqcvu/GHWW_2024.pdf?rlkey=8d9oymi9jdagybvwriringwy5&dl=0';link.target='_blank';link.rel='noopener noreferrer';appendix.append(link,' for detailed definitions and construction.');host.append(appendix);
  const price=asset=>mathSub('p',asset)+'<mi>'+asset+'</mi>';
  const componentTerms={
    nondurable:['Nondurable consumption','<msup><mi>c</mi><mtext>ND</mtext></msup>'],
    housing:['Gross imputed rent','<mo>(</mo>'+mathSub('r','h')+'<mo>+</mo>'+mathSub('δ','h')+'<mo>)</mo>'+price('h')],
    durable:['Durable services',mathSub('δ','d')+price('d')],
    financial:['Financial assets',price('b')],
    home:['Housing',price('h')],
    housingEquity:['Housing equity',price('h')+'<mo>+</mo>'+price('k')+'<mo>−</mo><msub><mi>m</mi><mtext>housing</mtext></msub>'],
    propertyAndBusiness:['Real estate and businesses',price('h')+'<mo>+</mo>'+price('k')],
    durables:['Consumer durables',price('d')],
    real:['Real assets',price('k')],
    debt:['Debt','<mo>−</mo><mi>m</mi>'],
    financialIncome:['Financial income',mathSub('r','b')+price('b')],
    businessIncome:['Income from businesses and other real assets',mathSub('r','k')+price('k')],
    scfBusinessAndInvestmentIncome:['Business and investment income bundle',mathSub('r','k')+price('k')+'<mo>+</mo>'+mathSub('r','b')+price('b')],
    housingIncome:['Owner-occupied and rental housing income',mathSub('r','h')+price('h')+'<mo>+</mo>'+mathSub('r','k')+price('k')],
    netHousing:['Net imputed rent',mathSub('r','h')+price('h')],
    gains:['Capital gains','<mo>(</mo><msubsup><mi>p</mi><mi>x</mi><mo>′</mo></msubsup><mo>−</mo>'+mathSub('p','x')+'<mo>)</mo><mi>x</mi>'],
    interest:['Interest paid','<mo>−</mo>'+mathSub('r','m')+'<mi>m</mi>'],
    purchases:['Purchases'],
    assets:['Assets',[price('b'),price('h'),price('d'),price('k')].join('<mo>+</mo>')],
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
    if(!source.consumption)return {rows:[],notes:[source.consumptionUnavailable]};
    if(state.survey==='HBS'){
      const includeInKind=state.consumption==='consump_def1';
      const rows=source.consumption.map(([key,description])=>[key,key==='nondurable'&&includeInKind
        ?description+' The benchmark also adds reported in-kind earnings from employment and self-employment.'
        :description]);
      return {rows,notes:[]};
    }
    const measure=state.consumption,owner=['consump_def1','expenditure_incl_rent','food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(measure);
    const expenditure=['expenditure','expenditure_incl_rent'].includes(measure);
    const psid=state.survey==='PSID';
    const notes=[];
    let rows=source.consumption.slice();
    if(state.survey==='SCF'){
      const food='Food bought for home use, delivered meals and meals eaten out.';
      const vacation='Reported spending on vacations or trips during the previous 12 months.';
      if(expenditure){
        rows=[['nondurable','The 2025 question asks for total spending in the previous 12 months, including food, trips and other everyday or one-off purchases. The response excludes rent, mortgage payments and retirement contributions. We add rent paid by tenants.']];
        if(owner)rows.push(source.consumption[1]);
        rows.push(['durable','Cars, appliances and other durables enter at their purchase cost in this measure.']);
      }else if(measure==='food_total')rows=[['nondurable',food],['durable','Outside the selected measure.']];
      else if(measure==='vacation')rows=[['nondurable',vacation],['durable','Outside the selected measure.']];
      else if(['food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(measure)){
        const vehicle=measure==='food_housing_vacation_donations_vehicle';
        rows=[['nondurable',food+' The basket adds rent paid by tenants and spending on vacations or trips'+(vehicle?', plus charitable donations.':'.')],source.consumption[1]];
        rows.push(vehicle?source.consumption[2]:['durable','Outside the selected measure.']);
      }
      return {rows,notes:['The 2004–2022 waves support narrower measures of food, housing, donations and vehicle services. The total expenditure and vacation estimates use 2025 only.']};
    }
    if(expenditure){
      const description=source.bank?'Spending identified in the observed accounts, including card purchases, cash withdrawals and check payments, before the service-flow correction.':source.expenditureIngredients||'Purchases of goods and services, including durable purchases.';
      rows=psid?[['purchases',description]]:[['nondurable','Included in the purchase total.'],['purchases',description]];
      if(owner)rows.push(['housing','The rental value of owner-occupied housing, before deducting the costs of ownership.']);
    }else if(measure==='food_total'){
      rows=[['nondurable',psid?psidFood:'Food bought for home use, meals eaten out and food deliveries, where observed.']];
    }else if(measure==='vacation'){
      rows=[['nondurable','Spending on trips and holidays, including the source’s observed travel and lodging items.']];
    }else if(['food_housing_vacation','food_housing_vacation_donations_vehicle'].includes(measure)){
      const vehicle=measure==='food_housing_vacation_donations_vehicle';
      rows=[['nondurable','Food, rent paid by tenants and vacation spending'+(vehicle?', plus donations.':'.')],['housing','Imputed rent for owner-occupied housing.']];
      if(vehicle)rows.push(['durable',psid?'Services from owned vehicles use estimated vehicle values and the remaining value of earlier payments.':'Modeled vehicle services.']);
    }else if(measure!=='consump_def1'&&measure!=='retail'){
      notes.push('The list describes the source’s consumption components. Coverage depends on the selected measure.');
    }
    if(psid&&owner){
      const grossRent=state.constantRent?'Paid rent enters at the reported amount. Gross imputed rent for homeowners applies one NIPA-matched rate to the value of the main home.':psidRent;
      rows=rows.map(([component,description])=>[component,component==='housing'?grossRent+' Ownership costs, including repairs and maintenance, are deducted when computing net rent for capital income.':description]);
    }else if(source.housing&&owner&&state.constantRent)notes.push('Owner services use the constant NIPA-matched rent-rate alternative.');
    if(source.bank&&measure==='consump_def1')rows.push(['durable',state.bank==='paper'
      ? 'The paper estimates durable purchases from unusually large ATM or cash withdrawals, check payments, loan payments and other expenses. Each year, 20% of the estimated durable stock enters consumption as a service flow and the balance carries forward.'
      : 'The same service-flow correction is applied across all spending categories in this version.']);
    if(!rows.some(([key])=>key==='durable')){
      const description=expenditure?'The selected measure counts purchases of durables as spending.'
        : source.retail?'Durable service flows are unavailable in the retail panel.':'Durable services are outside the selected basket.';
      rows.push(['durable',description]);
    }
    if(state.survey==='HFCS')notes.push('Coverage varies across countries and waves.');
    return {rows,notes};
  }
  const shortDatasetNames={CEX_BM_RECON:'CEX',SAEZ_ZUCMAN:'DINA',YODLEE:'Yodlee',NIELSEN:'NielsenIQ',FORBES:'Forbes'};
  function render(){
    const source=sources[state.survey];dataset.input.value=state.survey;dataset.input.title=source.name;
    correspondenceNote.hidden=state.survey==='HBS';
    grid.dataset.survey=state.survey;
    const datasetName=shortDatasetNames[state.survey]||state.survey;
    accountingTitle.textContent='Accounting framework for variable construction and mapping to '+datasetName;
    for(const {heading,title} of Object.values(cards))heading.textContent=title+' in '+datasetName;
    const international=['HFCS','SHIW','HILDA'].includes(state.survey);
    const availableVariables=new Set([...summary.filter(r=>r.survey===state.survey).map(r=>r.variable),...referencePoints().filter(r=>r.survey===state.survey).map(r=>r.variable)]);
    let options=spendingOptions.filter(o=>availableVariables.has(o.key));if(international)options=[{key:'consump_def1',label:'Consumption'}];if(source.retail)options=[{key:'retail',label:'Retail purchases'}];
    if(state.survey==='HBS')options=[{key:'consump_def1',label:'Consumption including in-kind benefits'},{key:'hbs_consumption_excl_inkind',label:'Consumption excluding in-kind benefits'}];
    consumption.input.replaceChildren();options.forEach(o=>consumption.input.add(new Option(o.label,o.key)));if(!options.some(o=>o.key===state.consumption))state.consumption=options.some(o=>o.key==='consump_def1')?'consump_def1':options.some(o=>o.key==='expenditure_incl_rent')?'expenditure_incl_rent':options[0]?.key||'';consumption.input.value=state.consumption;if(!options.length)consumption.input.add(new Option('Unavailable',''));consumption.input.disabled=!options.length;consumption.box.classList.toggle('definition-unavailable',!options.length);consumption.input.title=options.find(o=>o.key===state.consumption)?.label||'Unavailable';
    housingInput.disabled=!source.housing;housingInput.checked=!!source.housing&&state.constantRent;housingBox.classList.toggle('definition-unavailable',!source.housing);
    bank.box.hidden=!source.bank;bank.input.value=state.bank;
    const countries=metadata.other_survey_methods?.international?.availability?.HFCS?.countries||[];country.box.hidden=state.survey!=='HFCS';if(!country.box.hidden){const old=country.input.value;country.input.replaceChildren();countries.forEach(code=>country.input.add(new Option(metadata.other_survey_methods.international.country_labels[code]||code,code)));country.input.value=countries.includes(state.country)?state.country:countries.includes(old)?old:countries[0];state.country=country.input.value;}
    const selectedConsumption=consumptionComponents(source);
    renderComponents(cards.c.detail,selectedConsumption.rows,selectedConsumption.notes);
    const wealthRows=source.wealth;
    renderComponents(cards.a.detail,wealthRows,wealthRows?['The estimates measure wealth at a point in time. The term a′ − a is the change in wealth between periods.']:[]);
    cards.y.detail.textContent=source.labor||source.optionalLabor||'Unavailable in the current estimates.';
    cards.tax.detail.textContent=source.taxes||'Taxes paid minus transfers received. A separate estimate of this component is unavailable for this dataset.';
    const capitalNotes=[];
    if(source.capitalUnavailable)capitalNotes.push(source.capitalUnavailable);
    if(source.optionalCapital)capitalNotes.push('Optional topcoded income estimates. Topcoding severely distorts these upper tails.');
    if(source.housing&&state.constantRent&&source.capital)capitalNotes.push('Net owner rent uses the same constant-rate construction.');
    const capitalRows=(source.capital||source.optionalCapital||[]).slice();
    if(source.capital&&!source.realized&&!source.gainsChoice){
      const interestIndex=capitalRows.findIndex(([key])=>key==='interest');
      capitalRows.splice(interestIndex<0?capitalRows.length:interestIndex,0,['gains','Capital gains are not reported separately.']);
    }
    renderComponents(cards.capital.detail,capitalRows,capitalNotes);
    for(const [key,available] of [['c',!!source.consumption],['a',!!source.wealth],['y',!!source.labor],['tax',!!source.taxAvailable],['capital',!!source.capital]]){cards[key].card.classList.toggle('definition-unavailable',!available);cards[key].symbol.classList.toggle('definition-unavailable',!available);cards[key].expansion.classList.toggle('definition-unavailable',!available);cards[key].status.textContent=key==='tax'&&source.taxStatus?source.taxStatus:!available?(state.survey==='CEX_BM_RECON'&&['y','capital'].includes(key)?'Optional: topcoded':'Unavailable'):key==='a'&&source.partialWealth?'Partial coverage':'';}
    if(source.partialConsumption)cards.c.status.textContent='Partial coverage';
    if(source.laborStatus)cards.y.status.textContent=source.laborStatus;
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
