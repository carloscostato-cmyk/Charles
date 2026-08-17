const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, '..', 'sites_data_center.xlsx');
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);
console.log('rows', data.length);
console.log('columns', Object.keys(data[0] || {}));
console.log(JSON.stringify(data.slice(0,3), null, 2));
