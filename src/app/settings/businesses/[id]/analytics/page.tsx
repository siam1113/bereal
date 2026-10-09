"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceRow {
  id: string;
  title: string;
  isActive: boolean;
  inquiries: number;
}

interface Analytics {
  totalViews: number;
  recentViews: number;
  windowDays: number;
  viewsByDay: { date: string; count: number }[];
  totalInquiries: number;
  inquiryRate: number | null;
  services: ServiceRow[];
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-4">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="font-display text-2xl text-ink">{value}</span>
    </div>
  );
}

/**
 * Owner-only aggregate analytics. Deliberately shows counts and rates only — never a
 * per-viewer breakdown (see business-service.ts#getBusinessAnalytics and the flagged
 * policy question in docs/decisions.md on re-identification risk).
 */
export default function BusinessAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/businesses/${id}/analytics`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          setError(body?.error ?? "Couldn't load analytics.");
          return;
        }
        const d = await r.json();
        setAnalytics(d.analytics);
      })
      .catch(() => setError("Couldn't load analytics."));
  }, [id]);

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-danger">{error}</div>;
  }
  if (!analytics) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-ink-muted">Loading…</div>;
  }

  const maxDay = Math.max(1, ...analytics.viewsByDay.map((d) => d.count));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="font-display text-2xl text-ink">Analytics</h1>
        <p className="text-sm text-ink-muted">
          Aggregate storefront traffic only — individual viewer identity is never shown here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total views" value={String(analytics.totalViews)} />
        <StatTile label={`Views (${analytics.windowDays}d)`} value={String(analytics.recentViews)} />
        <StatTile label="Total inquiries" value={String(analytics.totalInquiries)} />
        <StatTile
          label="Inquiry rate"
          value={analytics.inquiryRate === null ? "—" : `${(analytics.inquiryRate * 100).toFixed(1)}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storefront views, last {analytics.windowDays} days</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.viewsByDay.length === 0 ? (
            <p className="text-sm text-ink-muted">No views recorded in this window yet.</p>
          ) : (
            <>
              <div className="flex h-24 items-end gap-1" role="img" aria-label="Daily storefront views bar chart">
                {analytics.viewsByDay.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count} view${d.count === 1 ? "" : "s"}`}
                    className="flex-1 rounded-t bg-accent"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                  />
                ))}
              </div>
              <details className="mt-3 text-sm text-ink-muted">
                <summary className="cursor-pointer">View as table</summary>
                <table className="mt-2 w-full text-left">
                  <thead>
                    <tr>
                      <th className="pr-4">Date</th>
                      <th>Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.viewsByDay.map((d) => (
                      <tr key={d.date}>
                        <td className="pr-4">{d.date}</td>
                        <td>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.services.length === 0 ? (
            <p className="text-sm text-ink-muted">No services listed yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-ink-muted">
                  <th className="pb-2">Service</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Inquiries</th>
                </tr>
              </thead>
              <tbody>
                {analytics.services.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2 text-ink">{s.title}</td>
                    <td className="py-2 text-ink-muted">{s.isActive ? "Active" : "Inactive"}</td>
                    <td className="py-2 text-ink">{s.inquiries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
