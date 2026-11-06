const fs = require('fs');

function getTables(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const regex = /CREATE\s+TABLE\s+"([^"]+)"/g;
  const matches = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

const m0 = getTables('prisma/migrations/0_init_user_auth/migration.sql');
const m1 = getTables('prisma/migrations/1_capacity_and_bookings/migration.sql');
const m2 = getTables('prisma/migrations/2_add_customer_id/migration.sql');

console.log('Migration 0 tables (' + m0.length + '):', m0);
console.log('Migration 1 tables (' + m1.length + '):', m1);
console.log('Migration 2 tables (' + m2.length + '):', m2);

const allTables = [...m0, ...m1, ...m2];
console.log('Total tables created across all migrations (' + allTables.length + '):', allTables);

// Check models in prisma/schema.prisma
const schemaText = fs.readFileSync('prisma/schema.prisma', 'utf8');
const modelRegex = /^model\s+(\w+)\s+\{/gm;
const schemaModels = [];
let mm;
while ((mm = modelRegex.exec(schemaText)) !== null) {
  schemaModels.push(mm[1]);
}
console.log('Models in prisma/schema.prisma (' + schemaModels.length + '):', schemaModels);

const missingFromSchema = allTables.filter(t => !schemaModels.includes(t));
console.log('Tables created in migrations but missing from schema.prisma (' + missingFromSchema.length + '):', missingFromSchema);

