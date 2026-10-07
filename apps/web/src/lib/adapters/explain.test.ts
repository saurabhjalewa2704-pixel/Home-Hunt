import { describe, expect, it } from "vitest";
import { explainLoadError } from "./explain";

describe("explainLoadError", () => {
  it("says to run the migration when the tables are missing", () => {
    expect(explainLoadError({ code: "PGRST205", message: "Could not find the table 'public.households' in the schema cache" })).toMatch(/0001_init\.sql/);
    expect(explainLoadError({ code: "42P01", message: 'relation "public.households" does not exist' })).toMatch(/migration|0001_init/);
  });
  it("points at the key when Supabase rejects it", () => {
    expect(explainLoadError({ status: 401, message: "Invalid API key" })).toMatch(/anon/);
  });
  it("points at policies for permission errors", () => {
    expect(explainLoadError({ code: "42501", message: "permission denied for table members" })).toMatch(/policies/);
  });
  it("reports an unreachable URL for network failures", () => {
    expect(explainLoadError(new TypeError("Failed to fetch"))).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });
  it("shows the real message otherwise", () => {
    expect(explainLoadError({ message: "something odd" })).toBe("Couldn't load your data: something odd.");
  });
});
