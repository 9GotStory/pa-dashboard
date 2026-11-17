import PaDashboard from "./PaDashboard";
import { processPaSnapshot } from "@/lib/pa/process";
import { readPaSnapshot, readPaYearLinks } from "@/lib/pa/snapshot";

// /pa renders the numbers of the build's pa.json, then PaDashboard's hook
// refreshes them from GAS (SPEC §4, ADR-0017).
export default function Page() {
  return <PaDashboard initial={processPaSnapshot(readPaSnapshot())} years={readPaYearLinks()} />;
}
