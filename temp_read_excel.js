const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('Docs/CATALOGO_DE_COLONIAS_SECCIONES_ATLIXCO.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(worksheet);

console.log('COLUMNAS:', Object.keys(data[0]));
console.log('\nPRIMERAS 15 FILAS:');
data.slice(0, 15).forEach((row, i) => {
  console.log(`${i + 1}.`, row);
});

console.log('\nTOTAL:', data.length, 'colonias');

// Guardar como JSON para referencia
fs.writeFileSync('Docs/colonias_temp.json', JSON.stringify(data, null, 2));
console.log('\nGuardado en Docs/colonias_temp.json');
