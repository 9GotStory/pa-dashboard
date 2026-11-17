import PaDashboard from "./PaDashboard";
import { processPaSnapshot } from "@/lib/pa/process";
import { readClosedPaYears, readPaSnapshot } from "@/lib/pa/snapshot";
import { paYearLinks } from "@/lib/pa/years";

// /pa renders the numbers of the build's pa.json, then PaDashboard's hook
// refreshes them from GAS (SPEC §4, ADR-0017).
export default function Page() {
  const snapshot = readPaSnapshot();
  const years = paYearLinks(
    snapshot.BATCH_ALL.meta?.current_year ?? "",
    readClosedPaYears().map((closed) => closed.year),
  );
  return <PaDashboard initial={processPaSnapshot(snapshot)} years={years} />;
}
