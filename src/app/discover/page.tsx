"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkillPicker } from "@/components/discover/skill-picker";

interface SearchResult {
  profileId: string;
  slug: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  availability: string;
  primarySkillName: string | null;
  matchedSkillName: string | null;
  stage: string | null;
  portfolioCount: number;
  matchReasons: {
    skillMatch: "primary" | "secondary" | "none";
    geoMatch: "local" | "region" | "global" | "unknown";
    hasPortfolio: boolean;
    availability: string;
  };
}

const GEO_SCOPES = [
  { value: "none", label: "Anywhere" },
  { value: "LOCAL", label: "Local (same city)" },
  { value: "REGION", label: "Region / country" },
  { value: "GLOBAL", label: "Global" },
];

const PAGE_SIZE = 20;

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [geoScope, setGeoScope] = useState("none");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  function buildParams(offset: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (skillId) params.set("skillId", skillId);
    if (geoScope !== "none") params.set("geoScope", geoScope);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return params;
  }

  async function runSearch() {
    setLoading(true);
    const res = await fetch(`/api/search/people?${buildParams(0).toString()}`);
    if (res.ok) {
      const data = await res.json();
      setResults(data.results ?? []);
      setHasMore(Boolean(data.hasMore));
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }

  async function loadMore() {
    setLoadingMore(true);
    const res = await fetch(`/api/search/people?${buildParams(results.length).toString()}`);
    if (res.ok) {
      const data = await res.json();
      setResults((prev) => [...prev, ...(data.results ?? [])]);
      setHasMore(Boolean(data.hasMore));
      setTotal(data.total ?? 0);
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    const handle = setTimeout(() => runSearch(), 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-medium text-ink">Discover people</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Every result shows exactly why it matched — skill relevance, geography, and
        portfolio evidence — not a single hidden trust score.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Input
          placeholder="Search by name, bio, or skill..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SkillPicker label="" value={skillId} onChange={(id) => setSkillId(id)} />
        <Select value={geoScope} onValueChange={setGeoScope}>
          <SelectTrigger>
            <SelectValue placeholder="Location scope" />
          </SelectTrigger>
          <SelectContent>
            {GEO_SCOPES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="mt-4" onClick={runSearch} disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </Button>

      {!loading && results.length > 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          Showing {results.length} of {total} {total === 1 ? "match" : "matches"}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <Link key={r.profileId} href={`/p/${r.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-ink">{r.displayName}</h3>
                  {r.stage ? <Badge variant="accent">{r.stage}</Badge> : null}
                </div>
                {r.bio ? <p className="line-clamp-2 text-sm text-ink-muted">{r.bio}</p> : null}
                <p className="text-sm text-ink-muted">
                  {[r.city, r.region, r.country].filter(Boolean).join(", ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {r.matchedSkillName ? (
                    <Badge variant={r.matchReasons.skillMatch === "primary" ? "accent" : "neutral"}>
                      {r.matchReasons.skillMatch === "primary" ? "Primary skill" : "Secondary skill"}:{" "}
                      {r.matchedSkillName}
                    </Badge>
                  ) : null}
                  {r.matchReasons.geoMatch !== "unknown" ? (
                    <Badge variant="outline">Location: {r.matchReasons.geoMatch}</Badge>
                  ) : null}
                  {r.matchReasons.hasPortfolio ? (
                    <Badge variant="success">Has portfolio ({r.portfolioCount})</Badge>
                  ) : null}
                  <Badge variant="outline">{r.availability.replaceAll("_", " ").toLowerCase()}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!loading && results.length === 0 ? (
          <p className="text-ink-muted">No matches yet — try broadening your search.</p>
        ) : null}
      </div>

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
