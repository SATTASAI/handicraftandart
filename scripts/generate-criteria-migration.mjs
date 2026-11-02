import { readFile, writeFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile(
    new URL("../data/criteria-2568.json", import.meta.url),
    "utf8",
  ),
);
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
let sql = `ALTER TABLE competitions ADD COLUMN policy_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN school_key TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN school_key TEXT NOT NULL DEFAULT '';
UPDATE users SET school_key=lower(replace(replace(replace(replace(school,' ',''),char(9),''),char(10),''),char(13),''));
UPDATE registrations SET school_key=lower(replace(replace(replace(replace(school,' ',''),char(9),''),char(10),''),char(13),''));
ALTER TABLE registrations ADD COLUMN eligibility_reviewed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN eligibility_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN decision TEXT NOT NULL DEFAULT 'eligible';
ALTER TABLE registrations ADD COLUMN decision_note TEXT NOT NULL DEFAULT '';
ALTER TABLE scores ADD COLUMN deduction REAL NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN deduction_reason TEXT NOT NULL DEFAULT '';
`;
for (const c of catalog.competitions) {
  const columns = [
    "id",
    "title",
    "category",
    "grade",
    "cover",
    "description",
    "min_students",
    "max_students",
    "max_coaches",
    "score_rules",
    "rules_version",
    "rules_source_url",
    "policy_json",
  ];
  const values = columns.map((k) =>
    quote(
      k === "policy_json"
        ? JSON.stringify({ ...c.policy, source_page: c.source_page })
        : k === "score_rules"
          ? JSON.stringify(c[k])
          : c[k],
    ),
  );
  sql += `INSERT INTO competitions(${columns.join(",")}) VALUES(${values.join(",")});\n`;
}
// Old sample entries with real data remain visible to their owners. Empty examples are closed.
sql += `UPDATE competitions SET registration_open=0 WHERE id NOT IN (${catalog.competitions.map((c) => quote(c.id)).join(",")}) AND NOT EXISTS(SELECT 1 FROM registrations WHERE competition_id=competitions.id);\n`;
await writeFile(
  new URL("../migrations/0008_primary_catalog_2568.sql", import.meta.url),
  sql,
);
console.log(
  `Prepared ${catalog.competitions.length} independent trial competitions`,
);
