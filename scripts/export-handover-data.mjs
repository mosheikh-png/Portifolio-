import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const outputPath = path.resolve(process.argv[2] || "database/seed-current-content.sql");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to export the CMS seed data.");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

async function exportTable(table, columns) {
  const [rows] = await connection.query(`SELECT ${columns.map((column) => `\`${column}\``).join(", ")} FROM \`${table}\` ORDER BY \`id\` ASC`);
  if (!rows.length) return `-- ${table}: no rows\n`;
  const values = rows.map((row) => `  (${columns.map((column) => sqlValue(row[column])).join(", ")})`).join(",\n");
  return `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES\n${values}\nON DUPLICATE KEY UPDATE ${columns.filter((column) => column !== "id" && column !== "key").map((column) => `\`${column}\` = VALUES(\`${column}\`)`).join(", ")};\n`;
}

try {
  const contentColumns = ["key", "value"];
  const projectColumns = ["id", "title", "titleAr", "category", "summary", "summaryAr", "imageUrl", "projectUrl", "sortOrder", "isPublished"];
  const contactColumns = ["id", "label", "labelAr", "type", "url", "sortOrder", "isPublished"];

  const [contentRows] = await connection.query("SELECT `key`, `value` FROM `portfolio_content` ORDER BY `key` ASC");
  const contentSql = contentRows.length
    ? `INSERT INTO \`portfolio_content\` (\`key\`, \`value\`) VALUES\n${contentRows.map((row) => `  (${sqlValue(row.key)}, ${sqlValue(row.value)})`).join(",\n")}\nON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);\n`
    : "-- portfolio_content: no rows\n";

  const projectSql = await exportTable("portfolio_projects", projectColumns);
  const contactSql = await exportTable("contact_links", contactColumns);
  const sql = `-- Current public CMS data export. Accounts and authentication records are deliberately excluded.\n-- Apply after Drizzle migrations: mysql -u USER -p DATABASE < database/seed-current-content.sql\n\nSET NAMES utf8mb4;\n\n${contentSql}\n${projectSql}\n${contactSql}`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, "utf8");
  console.log(`Wrote ${outputPath}`);
} finally {
  await connection.end();
}

process.exit(0);
