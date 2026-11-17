// npm runs it after npm run build. With no file in data/pa-years/,
// src/app/pa/[year]/page.tsx builds the stand-in /pa/_ as the 404 page,
// because Next.js fails an output: 'export' build whose generateStaticParams
// returns no param. This deletes its files from out/, so /pa/_ is a 404 as
// any other year with no file (SPEC §4). With a closed year there is no
// stand-in and nothing to delete.
import fs from "node:fs";
import path from "node:path";

const PA = path.resolve("out", "pa");
for (const name of ["_.html", "_.txt", "_"]) fs.rmSync(path.join(PA, name), { recursive: true, force: true });
