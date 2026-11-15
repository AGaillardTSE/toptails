const SeriesYears=(()=>{
  const income=variable=>['total_labor_income','total_capital_income','total_income'].includes(variable);
  // Wave IDs remain unchanged for matching estimates, filters and within-wave ratios.
  // Dates below describe the measured series, not the public-file release year.
  const psidWealthConvention='valuation';
  function period(row){
    const survey=String(row.survey||'').toUpperCase(),wave=Number(row.year??row.wave),variable=row.variable||'',native=Number.isFinite(row.reference_year)?row.reference_year:null;
    if(!Number.isFinite(wave))return{year:null,wave:null,label:'Across-wave average',basis:'average'};

    let year=wave,basis='calendar_year',label=String(wave);
    if(survey==='PSID'){
      const interviewMeasure=variable==='networth_val'&&psidWealthConvention==='valuation'||['food_total','food_home','food_away','food_home_val','food_away_val','home_service_val','home_util_val'].includes(variable);
      year=interviewMeasure?wave:(native??wave-1);basis=interviewMeasure?'interview_year':'annual_reference_year';
    }else if(survey==='SCF'){
      year=income(variable)?wave-1:wave;basis=income(variable)?'previous_calendar_year':'interview_year';
    }else if(survey==='HILDA'&&income(variable)){
      basis='financial_year_ending';label=(wave-1)+'–'+String(wave).slice(-2);
    }else if(survey==='HFCS'){
      return{year:wave,wave,label:'Wave '+wave,basis:'harmonized_survey_wave',detail:'HFCS wave '+wave+'; reference periods vary by country and variable'};
    }else if(['CEX','CEX_BM','CEX_BM_RECON'].includes(survey)){
      year=native??wave;basis='source_reference_year';
    }else if(survey==='FORBES')basis='valuation_year';
    else if(survey==='YODLEE'||survey==='NIELSEN')basis='transaction_year';
    else if(survey==='SAEZ_ZUCMAN')basis='source_calendar_year';
    if(basis!=='financial_year_ending')label=String(year);
    const detail=basis==='financial_year_ending'?'Financial year '+label+' · survey wave '+wave:year!==wave?'Reference year '+year+' · survey wave '+wave:basis==='interview_year'?'Interview year '+wave:basis==='valuation_year'?'Valuation/list year '+wave:'Reference year '+year;
    return{year,wave,label,basis,detail};
  }
  return{period,psidWealthConvention};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SeriesYears;
