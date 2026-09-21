"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAuth } from "@/redux/selectors/auth/authSelector";
import { GlassCard } from "@/components/ui/glassCard";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/searchInput";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, RefreshCw, AlertTriangle, Cpu, FlaskConical, Play, Power, PowerOff, SlidersHorizontal,
} from "lucide-react";
import {
  useAiModelCatalog, useCatalogSync, useCatalogReview, useCatalogTest, useCatalogActivation,
  type CatalogModel, type CatalogState,
} from "@/hooks/useAiModelCatalog";

const STATE_VARIANT: Record<CatalogState, "default" | "primary" | "success" | "warning" | "danger" | "info"> = {
  "Pending review": "warning",
  "Unsupported": "default",
  "Pricing needed": "warning",
  "Test required": "info",
  "Test failed": "danger",
  "Ready to activate": "primary",
  "Active": "success",
  "Active (legacy — not live-tested)": "warning",
  "Deprecated": "warning",
  "Retired": "danger",
  "Unavailable": "danger",
};

const REVIEW_STATUSES = ["pending", "approved", "unsupported", "retired"];
const LIFECYCLE_STATUSES = ["unknown", "available", "deprecated", "shutdown"];
const TEST_STATUSES = ["not_tested", "passed", "failed", "legacy_grandfathered"];

// Plain-language meaning of each catalog state (shown as a tooltip on the state badge).
const STATE_HELP: Partial<Record<CatalogState, string>> = {
  "Pending review": "Discovered but not approved yet. Open Review, approve it and add a request profile.",
  "Unsupported": "Marked unsupported. It cannot be activated.",
  "Pricing needed": "Approved, but it has no pricing row. Use Pricing to add exact rates (including the cached-input rate).",
  "Test required": "Approved and priced, but it has not passed a live compatibility test yet. Open Review → Compatibility test and run it (credential scope: platform). A model cannot be activated until a test passes.",
  "Test failed": "The last live compatibility test failed. Fix the profile or credential in Review and run the test again.",
  "Ready to activate": "Everything is in place. Click Activate.",
  "Active": "Live: tenants can use this model.",
  "Active (legacy — not live-tested)": "Live since before the catalog existed. It keeps running, but run a live test to confirm it.",
  "Deprecated": "OpenAI has deprecated this model. Plan a replacement.",
  "Retired": "Retired. It cannot be used.",
  "Unavailable": "Not currently usable (shut down or blocked). See the note under the model name.",
};

// Turn a backend blocker into "what is wrong → what to do".
const BLOCKER_HINTS: Array<[RegExp, string]> = [
  [/requires approval/i, "Open Review and set Review status to approved."],
  [/availability is not confirmed/i, "Open Review and set Lifecycle to available (or Refresh models so OpenAI confirms it)."],
  [/request profile/i, "Open Review and paste a reviewed request profile (JSON)."],
  [/cached-input|cached input/i, "Click Pricing and enter the verified cached-input rate."],
  [/pricing|rate/i, "Click Pricing and enter valid, exact rates."],
  [/live compatibility test/i, "Open Review → Compatibility test and run it with credential scope “platform” (needs the platform OpenAI key)."],
];

const explainBlockers = (blockers: string[]): string =>
  ["Cannot activate yet:", ...blockers.map((b, i) => {
    const hint = BLOCKER_HINTS.find(([re]) => re.test(b))?.[1];
    return `${i + 1}. ${b}${hint ? ` → ${hint}` : ""}`;
  })].join("\n");

const errMessage = (e: unknown, fallback: string): string => {
  const withResp = e as { response?: { data?: { message?: string } }; message?: string } | undefined;
  return withResp?.response?.data?.message || withResp?.message || fallback;
};

interface Props {
  isDarkMode: boolean;
  onConfigurePricing: (model: CatalogModel) => void;
}

export const AiModelCatalog = ({ isDarkMode, onConfigurePricing }: Props) => {
  const { user } = useAuth();
  const canWrite = user?.role === "super_admin";

  const catalog = useAiModelCatalog();
  const sync = useCatalogSync();
  const review = useCatalogReview();
  const test = useCatalogTest();
  const activation = useCatalogActivation();

  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [testFilter, setTestFilter] = useState("");
  const [pricingFilter, setPricingFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [drawerModel, setDrawerModel] = useState<CatalogModel | null>(null);
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [lifecycleStatus, setLifecycleStatus] = useState("unknown");
  const [profileText, setProfileText] = useState("");
  const [scope, setScope] = useState<"platform" | "tenant">("platform");
  const [testTenantId, setTestTenantId] = useState("");
  const [testOutput, setTestOutput] = useState<string>("");

  const data = catalog.data;
  const models = useMemo(() => data?.models ?? [], [data?.models]);
  const busy = sync.isPending || review.isPending || test.isPending || activation.isPending;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((m) => {
      if (q && !m.model.toLowerCase().includes(q)) return false;
      if (reviewFilter && m.review_status !== reviewFilter) return false;
      if (lifecycleFilter && m.lifecycle_status !== lifecycleFilter) return false;
      if (testFilter && m.test_status !== testFilter) return false;
      if (pricingFilter === "configured" && !m.pricing) return false;
      if (pricingFilter === "needed" && m.pricing) return false;
      if (activeFilter === "active" && !m.active) return false;
      if (activeFilter === "inactive" && m.active) return false;
      return true;
    });
  }, [models, search, reviewFilter, lifecycleFilter, testFilter, pricingFilter, activeFilter]);

  const openReview = (m: CatalogModel) => {
    setDrawerModel(m);
    setReviewStatus(m.review_status);
    setLifecycleStatus(m.lifecycle_status);
    // A model with no reviewed profile starts EMPTY. Seeding "{}" here made every save submit an
    // invalid empty profile, which the API rejects with a confusing "Unsupported endpoint.".
    setProfileText(m.request_profile ? JSON.stringify(m.request_profile, null, 2) : "");
    setScope("platform");
    setTestTenantId("");
    setTestOutput("");
  };

  const handleSync = async () => {
    try {
      await sync.sync();
      toast.success("Model catalog refreshed.");
    } catch (e: unknown) {
      toast.error(errMessage(e, "Refresh failed. The previous catalog is retained."));
    }
  };

  const handleSaveReview = async () => {
    if (!drawerModel) return;
    let parsed: unknown = undefined;
    if (profileText.trim()) {
      try { parsed = JSON.parse(profileText); }
      catch { toast.error("Request profile is not valid JSON."); return; }
    }
    // An empty object is "no profile", never something to submit.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
      parsed = undefined;
    }
    if (reviewStatus === "approved" && parsed === undefined && !drawerModel.request_profile) {
      toast.error("Add a reviewed request profile (JSON) before approving this model.");
      return;
    }
    try {
      await review.review(drawerModel.id, {
        review_status: reviewStatus,
        lifecycle_status: lifecycleStatus,
        ...(parsed !== undefined ? { request_profile: parsed } : {}),
      });
      // Mirror the server rule: only a real profile change invalidates the compatibility test.
      const profileChanged =
        parsed !== undefined && JSON.stringify(parsed) !== JSON.stringify(drawerModel.request_profile ?? null);
      toast.success(
        profileChanged
          ? "Review saved. The request profile changed, so the compatibility test was reset — run it again before activating."
          : "Review saved. Your compatibility test result is unchanged.",
      );
      setDrawerModel(null);
    } catch (e: unknown) {
      toast.error(errMessage(e, "Could not save review. Check the profile fields."));
    }
  };

  const handleTest = async () => {
    if (!drawerModel) return;
    if (scope === "tenant" && !testTenantId.trim()) { toast.error("Enter a tenant ID for the tenant credential test."); return; }
    try {
      const res = await test.test(drawerModel.id, { credentialScope: scope, tenantId: testTenantId.trim() || undefined }) as { data?: unknown };
      setTestOutput(JSON.stringify(res?.data ?? res, null, 2));
      toast.success("Compatibility test passed.");
    } catch (e: unknown) {
      setTestOutput("");
      toast.error(errMessage(e, "Compatibility test failed."));
    }
  };

  const handleActivation = async (m: CatalogModel) => {
    try {
      await activation.setActive(m.id, !m.active);
      toast.success(m.active ? "Model deactivated." : "Model activated.");
    } catch (e: unknown) {
      toast.error(errMessage(e, "Action blocked. Resolve the listed blockers first."));
    }
  };

  const lastSuccess = data?.latestSuccess?.completed_at
    ? new Date(data.latestSuccess.completed_at).toLocaleString()
    : "Never";
  const lastFailed = data?.latestSync?.status === "failed" ? data.latestSync : null;

  return (
    <div className="space-y-4">
      <GlassCard isDarkMode={isDarkMode} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className={cn("w-5 h-5", isDarkMode ? "text-violet-400" : "text-violet-600")} />
              <h2 className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-slate-900")}>OpenAI Model Catalog</h2>
            </div>
            <p className={cn("text-xs mt-1", isDarkMode ? "text-white/50" : "text-slate-500")}>
              Discovery only. New models arrive as <strong>pending</strong> and stay hidden from tenants until reviewed, priced, tested and activated here.
            </p>
            <p className={cn("text-[11px] mt-1", isDarkMode ? "text-white/40" : "text-slate-400")}>
              Last successful refresh: {lastSuccess}
            </p>
          </div>
          {canWrite && (
            <button
              onClick={handleSync}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50"
            >
              {sync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh models
            </button>
          )}
        </div>

        {lastFailed && (
          <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", isDarkMode ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700")}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Last refresh failed ({lastFailed.error_code || "error"}): {lastFailed.sanitized_error || "Provider request failed."} The previous catalog is unchanged.</span>
          </div>
        )}
        {!!data?.uncataloguedActiveModels?.length && (
          <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", isDarkMode ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700")}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Active pricing without an approved catalog profile: {data.uncataloguedActiveModels.join(", ")}. Review and profile these before the next deploy.</span>
          </div>
        )}
      </GlassCard>

      <GlassCard isDarkMode={isDarkMode} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className={cn("w-4 h-4", isDarkMode ? "text-white/40" : "text-slate-400")} />
          <span className={cn("text-xs font-semibold uppercase tracking-wider", isDarkMode ? "text-white/40" : "text-slate-400")}>Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <SearchInput isDarkMode={isDarkMode} placeholder="Search model ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select isDarkMode={isDarkMode} label="" value={reviewFilter} onChange={setReviewFilter}
            options={[{ value: "", label: "All review" }, ...REVIEW_STATUSES.map((v) => ({ value: v, label: v }))]} />
          <Select isDarkMode={isDarkMode} label="" value={lifecycleFilter} onChange={setLifecycleFilter}
            options={[{ value: "", label: "All lifecycle" }, ...LIFECYCLE_STATUSES.map((v) => ({ value: v, label: v }))]} />
          <Select isDarkMode={isDarkMode} label="" value={testFilter} onChange={setTestFilter}
            options={[{ value: "", label: "All test states" }, ...TEST_STATUSES.map((v) => ({ value: v, label: v }))]} />
          <Select isDarkMode={isDarkMode} label="" value={pricingFilter} onChange={setPricingFilter}
            options={[{ value: "", label: "Any pricing" }, { value: "configured", label: "Pricing configured" }, { value: "needed", label: "Pricing needed" }]} />
          <Select isDarkMode={isDarkMode} label="" value={activeFilter} onChange={setActiveFilter}
            options={[{ value: "", label: "Any state" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </div>
      </GlassCard>

      <GlassCard isDarkMode={isDarkMode} className="p-0 overflow-hidden">
        <Table isDarkMode={isDarkMode}>
          <TableHeader isDarkMode={isDarkMode}>
            <TableRow isDarkMode={isDarkMode}>
              <TableHead isDarkMode={isDarkMode}>Model</TableHead>
              <TableHead isDarkMode={isDarkMode} align="center">State</TableHead>
              <TableHead isDarkMode={isDarkMode} align="center">Lifecycle</TableHead>
              <TableHead isDarkMode={isDarkMode} align="center">Pricing</TableHead>
              <TableHead isDarkMode={isDarkMode} align="center">Test</TableHead>
              <TableHead isDarkMode={isDarkMode} align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalog.isLoading ? (
              <TableRow isDarkMode={isDarkMode}>
                <TableCell align="center" colSpan={6}>
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" /> Loading catalog…
                  </div>
                </TableCell>
              </TableRow>
            ) : catalog.isError ? (
              <TableRow isDarkMode={isDarkMode}>
                <TableCell align="center" colSpan={6}>
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-500">
                    <AlertTriangle className="w-6 h-6 opacity-40" />
                    <span>Unable to load the catalog.</span>
                    <button className="text-emerald-600 text-sm font-semibold" onClick={() => catalog.refetch()}>Retry</button>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow isDarkMode={isDarkMode}>
                <TableCell align="center" colSpan={6}>
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <Cpu className="w-6 h-6 mb-2 opacity-40" />
                    <p>{models.length === 0 ? "No models discovered yet. Refresh to begin." : "No models match these filters."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m, idx) => (
                <TableRow key={m.id} isDarkMode={isDarkMode} isLast={idx === filtered.length - 1}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono font-medium">{m.model}</span>
                      {m.owned_by && <span className={cn("text-[11px]", isDarkMode ? "text-white/40" : "text-slate-400")}>{m.owned_by}</span>}
                      {m.blockers.length > 0 && (
                        <span className={cn("text-[11px] mt-0.5", isDarkMode ? "text-amber-300/80" : "text-amber-700")}>{m.blockers.join(" ")}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className="inline-flex cursor-help"
                      title={
                        STATE_HELP[m.state as CatalogState]
                        ?? (m.state.startsWith("Active — last test failed")
                          ? "Still serving tenants, but its most recent live test failed. Investigate, and deactivate it if the failure is real."
                          : m.state)
                      }
                    >
                      <Badge isDarkMode={isDarkMode} size="sm" variant={STATE_VARIANT[m.state]}>{m.state}</Badge>
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span className={cn("text-xs", isDarkMode ? "text-white/60" : "text-slate-600")}>{m.lifecycle_status}</span>
                  </TableCell>
                  <TableCell align="center">
                    <Badge isDarkMode={isDarkMode} size="sm" variant={m.pricing ? (m.pricing.is_active ? "success" : "info") : "warning"}>
                      {m.pricing ? (m.pricing.is_active ? `v${m.pricing.pricing_version} active` : `v${m.pricing.pricing_version}`) : "needed"}
                    </Badge>
                  </TableCell>
                  <TableCell align="center">
                    <Badge isDarkMode={isDarkMode} size="sm" variant={m.test_status === "passed" ? "success" : m.test_status === "failed" ? "danger" : m.test_status === "legacy_grandfathered" ? "warning" : "default"}>
                      {m.test_status === "legacy_grandfathered" ? "legacy" : m.test_status}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    {canWrite ? (
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button onClick={() => openReview(m)} title="Review / profile / test"
                          className={cn("px-2 py-1 rounded-lg text-xs font-medium border", isDarkMode ? "border-white/10 text-white/80 hover:bg-white/5" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                          <FlaskConical className="w-3.5 h-3.5 inline -mt-0.5" /> Review
                        </button>
                        <button onClick={() => onConfigurePricing(m)} title="Configure pricing"
                          className={cn("px-2 py-1 rounded-lg text-xs font-medium border", isDarkMode ? "border-white/10 text-white/80 hover:bg-white/5" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                          Pricing
                        </button>
                        {/*
                          The tooltip lives on a wrapper, not on the button: browsers (notably Firefox) show no
                          tooltip on a DISABLED button, which hid the reason. The disabled button ignores the
                          pointer so the wrapper receives the hover.
                        */}
                        <span
                          className={cn("inline-flex", !m.active && m.blockers.length > 0 && "cursor-not-allowed")}
                          title={
                            m.active
                              ? "Deactivate this model for all tenants."
                              : m.blockers.length > 0
                                ? explainBlockers(m.blockers)
                                : "Activate this model for all tenants. A passing platform test is re-checked first."
                          }
                        >
                          <button
                            onClick={() => handleActivation(m)}
                            disabled={busy || (!m.active && m.blockers.length > 0)}
                            aria-label={m.active ? "Deactivate model" : "Activate model"}
                            className={cn(
                              "px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none",
                              m.active
                                ? (isDarkMode ? "bg-red-500/15 text-red-300 hover:bg-red-500/25" : "bg-red-50 text-red-700 hover:bg-red-100")
                                : "bg-emerald-600 text-white hover:bg-emerald-700",
                            )}
                          >
                            {m.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                            {m.active ? "Deactivate" : "Activate"}
                          </button>
                        </span>
                      </div>
                    ) : (
                      <span className={cn("text-xs", isDarkMode ? "text-white/40" : "text-slate-400")}>view only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>

      <Drawer
        isOpen={!!drawerModel}
        onClose={() => setDrawerModel(null)}
        title={`Review ${drawerModel?.model ?? "model"}`}
        description="Set review status, lifecycle and the request profile. Changing the request profile resets the compatibility test; changing only the status or lifecycle keeps a passed test. Activation is a separate action."
        isDarkMode={isDarkMode}
        className="font-sans max-w-2xl"
      >
        {drawerModel && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Select isDarkMode={isDarkMode} label="Review status" value={reviewStatus} onChange={setReviewStatus}
                options={REVIEW_STATUSES.map((v) => ({ value: v, label: v }))} />
              <Select isDarkMode={isDarkMode} label="Lifecycle status" value={lifecycleStatus} onChange={setLifecycleStatus}
                options={LIFECYCLE_STATUSES.map((v) => ({ value: v, label: v }))} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-2 block ml-1", isDarkMode ? "text-white/70" : "text-slate-700")}>
                Request profile (JSON)
              </label>
              <textarea
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                spellCheck={false}
                placeholder={'Paste the reviewed request profile as JSON, e.g. {"endpoint":"chat_completions","usageFormat":"chat_completions","modalities":["text"],"purposes":["output"], … }'}
                className={cn(
                  "w-full min-h-[300px] rounded-xl border p-3 font-mono text-xs outline-none",
                  isDarkMode ? "bg-black/40 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900",
                )}
              />
              <p className={cn("text-[11px] mt-1 ml-1", isDarkMode ? "text-white/40" : "text-slate-400")}>
                Allowed endpoints: chat_completions, responses. Modalities: text, image_input. Do not infer capabilities from the model name.
              </p>
            </div>
            <button
              onClick={handleSaveReview}
              disabled={review.isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {review.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save review
            </button>

            <hr className={isDarkMode ? "border-white/10" : "border-slate-200"} />

            <div>
              <h3 className={cn("text-sm font-bold mb-1", isDarkMode ? "text-white" : "text-slate-900")}>Compatibility test</h3>
              <p className={cn("text-xs mb-3", isDarkMode ? "text-white/50" : "text-slate-500")}>
                Runs a few small live requests (capped output). Billable on the chosen credential. Passing does not activate the model.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Select isDarkMode={isDarkMode} label="Credential scope" value={scope} onChange={(v) => setScope(v as "platform" | "tenant")}
                  options={[{ value: "platform", label: "Platform" }, { value: "tenant", label: "Tenant" }]} />
                {scope === "tenant" && (
                  <Input isDarkMode={isDarkMode} label="Tenant ID" value={testTenantId} onChange={(e) => setTestTenantId(e.target.value)} placeholder="TT001" />
                )}
              </div>
              <button
                onClick={handleTest}
                disabled={test.isPending}
                className={cn(
                  "mt-3 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 border",
                  isDarkMode ? "border-white/10 text-white hover:bg-white/5" : "border-slate-200 text-slate-800 hover:bg-slate-50",
                )}
              >
                {test.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run capped test
              </button>
              {testOutput && (
                <pre className={cn("mt-3 rounded-xl border p-3 text-[11px] overflow-auto max-h-64 whitespace-pre-wrap", isDarkMode ? "bg-black/40 border-white/10 text-white/80" : "bg-slate-50 border-slate-200 text-slate-700")}>
                  {testOutput}
                </pre>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
