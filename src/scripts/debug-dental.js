// Native fetch in Node 22


async function checkDental() {
  const url = 'https://opendata.moph.go.th/api/report_data';
  const payload = {
    tableName: 's_aged9_w',
    year: '2569',
    province: '54',
    type: 'json'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  const districtData = data.filter(d => d.areacode && String(d.areacode).startsWith('5406'));

  let sumTarget = 0;
  let sumResult = 0;
  let sumResult1to4 = 0;

  districtData.forEach(item => {
    sumTarget += Number(item.target || 0);
    sumResult += Number(item.result || 0);
    const r1 = Number(item.result1 || 0);
    const r2 = Number(item.result2 || 0);
    const r3 = Number(item.result3 || 0);
    const r4 = Number(item.result4 || 0);
    sumResult1to4 += (r1 + r2 + r3 + r4);
  });

  console.log('District 5406 s_aged9_w Data:');
  console.log('Sum Target (Main):', sumTarget);
  console.log('Sum Result (Main - 9 Aspects):', sumResult);
  console.log('Sum Result 1-4 (Vision+Urine+Hearing+ADL):', sumResult1to4);
}

checkDental();
