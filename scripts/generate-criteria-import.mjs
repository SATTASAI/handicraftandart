import { activationSql } from "../server/catalog.js";
import { readFile, writeFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile(
    new URL("../data/criteria-73-2568.json", import.meta.url),
    "utf8",
  ),
);
const q = (value) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : "'" + String(value).replaceAll("'", "''") + "'";
const compact = (value) => JSON.stringify(value);
const sql = [
  "CREATE TABLE competition_rule_sources (key TEXT PRIMARY KEY,name TEXT NOT NULL,sha256 TEXT NOT NULL UNIQUE,pages INTEGER NOT NULL,url TEXT,source_year INTEGER NOT NULL,included INTEGER NOT NULL CHECK(included IN (0,1)));",
  "CREATE TABLE competition_rule_sections (key TEXT PRIMARY KEY,source_key TEXT NOT NULL REFERENCES competition_rule_sources(key),start_page INTEGER NOT NULL,end_page INTEGER NOT NULL,text_json TEXT NOT NULL CHECK(json_valid(text_json)));",
  "CREATE TABLE competition_catalog (id TEXT PRIMARY KEY,catalog_key TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,grade_label TEXT NOT NULL,min_students INTEGER NOT NULL CHECK(min_students>=1),max_students INTEGER CHECK(max_students IS NULL OR max_students>=min_students),registration_open INTEGER NOT NULL CHECK(registration_open IN (0,1)),category TEXT NOT NULL,rules_version TEXT NOT NULL,source_key TEXT NOT NULL REFERENCES competition_rule_sources(key),source_page INTEGER NOT NULL,source_end_page INTEGER NOT NULL,section_key TEXT NOT NULL REFERENCES competition_rule_sections(key),rules_json TEXT NOT NULL CHECK(json_valid(rules_json)));",
  "ALTER TABLE event_competitions ADD COLUMN catalog_key TEXT;",
  "CREATE UNIQUE INDEX event_competitions_catalog_key ON event_competitions(catalog_key);",
  "ALTER TABLE event_competitions ADD COLUMN category TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE event_competitions ADD COLUMN rules_version TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE event_competitions ADD COLUMN source_key TEXT REFERENCES competition_rule_sources(key);",
  "ALTER TABLE event_competitions ADD COLUMN source_page INTEGER;",
  "ALTER TABLE event_competitions ADD COLUMN source_end_page INTEGER;",
  "ALTER TABLE event_competitions ADD COLUMN section_key TEXT REFERENCES competition_rule_sections(key);",
  "ALTER TABLE event_competitions ADD COLUMN rules_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rules_json));",
  "ALTER TABLE event_competitions ADD COLUMN roster_min_students INTEGER CHECK(roster_min_students IS NULL OR roster_min_students>=1);",
  "ALTER TABLE event_competitions ADD COLUMN roster_max_students INTEGER CHECK(roster_max_students IS NULL OR roster_max_students>=roster_min_students);",
  "ALTER TABLE event_students ADD COLUMN gender TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE event_registrations ADD COLUMN variant TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE event_registrations ADD COLUMN work_url TEXT NOT NULL DEFAULT '';",
  "ALTER TABLE event_registrations ADD COLUMN coaches_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(coaches_json));",
];
for (const s of catalog.sources)
  sql.push(
    "INSERT OR IGNORE INTO competition_rule_sources VALUES(" +
      [
        s.key,
        s.name,
        s.sha256,
        s.pages,
        s.url,
        s.source_year,
        s.included ? 1 : 0,
      ]
        .map(q)
        .join(",") +
      ");",
  );
for (const s of catalog.sections)
  sql.push(
    "INSERT OR IGNORE INTO competition_rule_sections VALUES(" +
      [s.key, s.source_key, s.start_page, s.end_page, compact(s.text)]
        .map(q)
        .join(",") +
      ");",
  );
for (const c of catalog.competitions) {
  sql.push(
    "INSERT OR IGNORE INTO competition_catalog VALUES(" +
      [
        c.id,
        c.catalog_key,
        c.title,
        c.description,
        c.grade_label,
        c.min_students,
        c.max_students,
        catalog.registration_open ? 1 : 0,
        c.category,
        c.rules_version,
        c.source_key,
        c.source_page,
        c.source_end_page,
        c.section_key,
        compact(c.rules),
      ]
        .map(q)
        .join(",") +
      ");",
  );
}
sql.push(activationSql);
if (sql.some((line) => Buffer.byteLength(line) > 90000))
  throw Error("A migration statement is too large for D1");
await writeFile(
  new URL("../migrations/0013_primary_criteria_73.sql", import.meta.url),
  sql.join("\n") + "\n",
);
console.log(
  `Generated ${catalog.competitions.length} catalog entries, ${catalog.sources.length} source records and ${catalog.sections.length} verified sections.`,
);
