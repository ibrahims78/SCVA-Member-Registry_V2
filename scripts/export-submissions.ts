import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { formSubmissions } from "../shared/schema";
import { buildExcelBuffers } from "../server/excelBuilder";
import { writeFileSync } from "fs";
import { resolve } from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const rows = await db.select().from(formSubmissions).orderBy(formSubmissions.createdAt);
  console.log(`📊 عدد التسجيلات: ${rows.length}`);

  if (rows.length === 0) {
    console.log("لا توجد بيانات بعد.");
    await pool.end();
    return;
  }

  const { arBuffer, enBuffer } = buildExcelBuffers(rows);

  const arPath = resolve(process.cwd(), "نموذج-الأعضاء-عربي.xlsx");
  const enPath = resolve(process.cwd(), "SCVA-Members-EN.xlsx");

  writeFileSync(arPath, arBuffer);
  writeFileSync(enPath, enBuffer);

  console.log(`✅ تم التصدير بنجاح:`);
  console.log(`   - ${arPath}`);
  console.log(`   - ${enPath}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
