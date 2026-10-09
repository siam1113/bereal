import { apiJson, API_VERSION } from "@/lib/api/http";
import { API_SCOPES } from "@/lib/services/api-key-service";

/**
 * API root / manifest — not authenticated. Lets a client discover the version and the
 * full set of scopes it can request before minting a key. See docs/platform-api.md for
 * the endpoint-by-endpoint reference; this intentionally does not duplicate that list.
 */
export async function GET() {
  return apiJson({
    version: API_VERSION,
    auth: {
      methods: ["session", "api_key"],
      apiKeyHeader: "Authorization: Bearer <token>",
      scopes: API_SCOPES,
    },
    docs: "/docs/platform-api.md",
  });
}
