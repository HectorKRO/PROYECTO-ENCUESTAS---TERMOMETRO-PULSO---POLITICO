const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Docs/colonias_temp.json', 'utf8'));

let sql = '-- Migración de datos de colonias desde Catálogo INE\n';
sql += '-- Total: ' + data.length + ' colonias\n';
sql += "INSERT INTO colonias (nombre, seccion_id, tipo, codigo_postal) VALUES\n";

const values = data.map(row => {
  const nombre = row['NOMBRE DE LA COLONIA'].replace(/'/g, "''");
  const seccion = row['SECCION'].toString().padStart(4, '0');
  const tipo = row['TIPO DE COLONIA'];
  const cp = row['CP'] ? row['CP'].toString() : '';
  return `  ('${nombre}', '${seccion}', '${tipo}', '${cp}')`;
});

sql += values.join(',\n');
sql += '\nON CONFLICT (nombre, seccion_id) DO NOTHING;';

fs.writeFileSync('sql/migracion_colonias_v2.4.sql', sql);
console.log('Archivo creado: sql/migracion_colonias_v2.4.sql');
console.log('Total colonias:', data.length);
