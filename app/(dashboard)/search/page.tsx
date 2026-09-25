import NaturalSearch from "./search-form";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const query = (await searchParams).q;
  return <NaturalSearch initialQuery={typeof query === "string" ? query : ""} />;
}
