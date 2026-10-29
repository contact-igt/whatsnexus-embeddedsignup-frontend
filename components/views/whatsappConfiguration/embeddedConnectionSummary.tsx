"use client";

import { Activity, CheckCircle2, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmbeddedConnectionSummaryProps {
    isDarkMode: boolean;
    account: any;
    health: any;
    checkingHealth: boolean;
    isAdmin: boolean;
    onCheckHealth: () => void;
}

export const EmbeddedConnectionSummary = ({
    isDarkMode,
    account,
    health,
    checkingHealth,
    isAdmin,
    onCheckHealth,
}: EmbeddedConnectionSummaryProps) => {
    const coexistence = account?.whatsapp_connection_type === "EMBEDDED_COEXISTENCE";
    const label = coexistence ? "WhatsApp Business App coexistence" : "Meta Embedded Signup";
    const muted = isDarkMode ? "text-white/60" : "text-slate-600";
    const healthReady = health?.overall_status === "ready";

    return (
        <div className={cn("p-6 rounded-xl border space-y-5", isDarkMode ? "bg-white/[0.02] border-white/10" : "bg-white border-slate-200")}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", isDarkMode ? "bg-emerald-500/20" : "bg-emerald-100")}>
                        {coexistence ? <Smartphone className="text-emerald-500" size={22} /> : <ShieldCheck className="text-emerald-500" size={22} />}
                    </div>
                    <div>
                        <h3 className={cn("font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>{label}</h3>
                        <p className={cn("text-sm", muted)}>Connected through Meta. Credentials are managed securely by WhatsNexus.</p>
                    </div>
                </div>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", healthReady ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10")}>
                    {healthReady ? "Healthy" : "Check connection"}
                </span>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><dt className={muted}>WhatsApp number</dt><dd className={cn("font-medium", isDarkMode ? "text-white" : "text-slate-900")}>{account?.whatsapp_number || "—"}</dd></div>
                <div><dt className={muted}>Connection status</dt><dd className={cn("font-medium", isDarkMode ? "text-white" : "text-slate-900")}>{account?.status || "—"}</dd></div>
                <div><dt className={muted}>Connected</dt><dd className={cn("font-medium", isDarkMode ? "text-white" : "text-slate-900")}>{account?.connected_at ? new Date(account.connected_at).toLocaleString() : "—"}</dd></div>
                <div><dt className={muted}>WhatsApp Business Account ID</dt><dd className={cn("font-medium break-all", isDarkMode ? "text-white" : "text-slate-900")}>{account?.waba_id || "—"}</dd></div>
                <div><dt className={muted}>Phone Number ID</dt><dd className={cn("font-medium break-all", isDarkMode ? "text-white" : "text-slate-900")}>{account?.phone_number_id || "—"}</dd></div>
                {coexistence && <div><dt className={muted}>Business App echoes</dt><dd className={cn("font-medium", isDarkMode ? "text-white" : "text-slate-900")}>{health?.coexistence_echo_handling === "enabled" ? "Handling enabled" : "Check connection health"}</dd></div>}
            </dl>

            <div className="flex items-center gap-3 pt-1">
                {isAdmin && <button type="button" onClick={onCheckHealth} disabled={checkingHealth} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold", isDarkMode ? "border-white/10 text-white hover:bg-white/5" : "border-slate-200 text-slate-700 hover:bg-slate-50", checkingHealth && "opacity-50") }>
                    {checkingHealth ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
                    Check connection health
                </button>}
                {health?.issues?.length > 0 && <p className="text-xs text-amber-500">{health.issues[0]}</p>}
            </div>
            <p className={cn("text-xs", muted)}><CheckCircle2 size={13} className="inline mr-1 text-emerald-500" />Use “Reconnect with Meta” below to replace this connection safely. Do not enter credentials manually.</p>
        </div>
    );
};
