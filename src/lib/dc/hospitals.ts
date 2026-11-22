import type { DcCatalog } from "./types";

/** The คำนำหน้าหน่วยบริการ a hospitals row may have (SCHEMA §1); the prebuild warns of any other */
export const HOSP_PREFIXES = ["รพ.", "รพ.สต.", "สสช."];

/**
 * The name of a หน่วยบริการ wherever the Data Center shows one (SCHEMA §4.4):
 * its คำนำหน้าหน่วยบริการ right before hospname, as รพ.สต.บ้านหนุน; hospname
 * alone when hospprefix is blank, not one of HOSP_PREFIXES or missing; and
 * หน่วยบริการ {hospcode} for a hospcode not in hospitals
 */
export function hospitalName(hospcode: string, hospitals: DcCatalog["hospitals"]): string {
  const hospital = hospitals.find((h) => h.hospcode === hospcode);
  if (!hospital) return `หน่วยบริการ ${hospcode}`;
  const prefix = HOSP_PREFIXES.includes(hospital.hospprefix ?? "") ? hospital.hospprefix : "";
  return `${prefix}${hospital.hospname}`;
}
