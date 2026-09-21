"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Smartphone, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useMetaEmbeddedSignup } from "@/hooks/useMetaEmbeddedSignup";
import type { EmbeddedConnectionType } from "@/services/whatsappConfiguration";

interface EmbeddedSignupCardProps {
    isDarkMode: boolean;
    isAdmin: boolean;
    /** Server-approved onboarding methods for this organization (Super Admin controlled). */
    methods: { standard: boolean; coexistence: boolean };
    /** The organization already has a (manual) connection: connecting via Meta REPLACES it, so ask first. */
    existingConnection?: boolean;
}

const COEXISTENCE_NOT_ELIGIBLE_CODES = new Set(["COEXISTENCE_NOT_ELIGIBLE"]);

export const EmbeddedSignupCard = ({ isDarkMode, isAdmin, methods, existingConnection = false }: EmbeddedSignupCardProps) => {
    const [confirmed, setConfirmed] = useState(false);
    const { status, error, errorCode, ready, unavailable, result, launch, reset } = useMetaEmbeddedSignup(methods, {
        confirmSwitch: existingConnection && confirmed,
    });
    // With an existing connection the user must confirm first; the server enforces it too.
    const needsConfirm = existingConnection && !confirmed;

    const busy = status === "STARTED" || status === "AUTHORIZATION_RECEIVED" || status === "PROCESSING";
    const muted = isDarkMode ? "text-white/60" : "text-slate-600";
    const heading = isDarkMode ? "text-white" : "text-slate-900";

    const options: Array<{
        type: EmbeddedConnectionType;
        enabled: boolean;
        title: string;
        description: string;
        icon: typeof MessageCircle;
    }> = [
        {
            type: "EMBEDDED_STANDARD",
            enabled: methods.standard,
            title: "Set up WhatsApp with Meta",
            description: "Connect a WhatsApp number to WhatsNexus using Meta.",
            icon: MessageCircle,
        },
        {
            type: "EMBEDDED_COEXISTENCE",
            enabled: methods.coexistence,
            title: "Connect Existing WhatsApp Business App",
            description:
                "Keep using your eligible WhatsApp Business App while connecting it to WhatsNexus.",
            icon: Smartphone,
        },
    ];

    return (
        <div
            className={cn(
                "p-8 rounded-xl border backdrop-blur-xl mt-5 space-y-6",
                isDarkMode ? "bg-white/[0.02] border-white/10" : "bg-white border-slate-200",
            )}
        >
            <div>
                <h2 className={cn("text-xl font-bold mb-2", heading)}>
                    {existingConnection ? "Connect with Meta" : "Connect WhatsApp"}
                </h2>
                <p className={cn("text-sm", muted)}>
                    {existingConnection
                        ? "Your current WhatsApp connection keeps working until you complete this."
                        : "Choose how you would like to connect your business number. You can still enter credentials manually below."}
                </p>
            </div>

            {existingConnection && (
                <div
                    className={cn(
                        "p-4 rounded-xl border flex items-start gap-3",
                        isDarkMode ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200",
                    )}
                >
                    <Checkbox
                        aria-label="Confirm replacing the current WhatsApp connection"
                        checked={confirmed}
                        onCheckedChange={setConfirmed}
                        disabled={!isAdmin || busy}
                        className="mt-0.5"
                    />
                    <p className={cn("text-sm", isDarkMode ? "text-amber-200" : "text-amber-800")}>
                        I understand this replaces my current WhatsApp connection. If Meta returns the same business
                        number, my chats and contacts are kept. If it returns a different number, chats from the
                        current number stay stored in WhatsNexus but are not shown under the new number.
                    </p>
                </div>
            )}

            {!isAdmin && (
                <p className={cn("text-sm", muted)}>Only an organization admin can connect WhatsApp.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options
                    .filter((o) => o.enabled)
                    .map((o) => {
                        const Icon = o.icon;
                        const notReady = !ready[o.type];
                        const reason = unavailable[o.type];
                        return (
                            <div
                                key={o.type}
                                className={cn(
                                    "p-5 rounded-xl border flex flex-col justify-between gap-4",
                                    isDarkMode ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200",
                                )}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Icon size={18} className="text-emerald-500" />
                                        <h3 className={cn("font-semibold", heading)}>{o.title}</h3>
                                    </div>
                                    <p className={cn("text-sm", muted)}>{o.description}</p>
                                    {reason && <p className="text-xs text-amber-500">{reason}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => launch(o.type)}
                                    disabled={!isAdmin || busy || notReady || needsConfirm}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 transition-all hover:brightness-110",
                                        (!isAdmin || busy || notReady || needsConfirm) && "opacity-50 cursor-not-allowed hover:brightness-100",
                                    )}
                                >
                                    {busy || (notReady && !reason) ? <Loader2 size={16} className="animate-spin" /> : null}
                                    <span>{o.type === "EMBEDDED_STANDARD" ? "Connect WhatsApp" : "Connect Business App"}</span>
                                </button>
                            </div>
                        );
                    })}
            </div>

            {methods.coexistence && (
                <p className={cn("text-xs", isDarkMode ? "text-white/40" : "text-slate-500")}>
                    Business App connection depends on Meta confirming your number is eligible during setup.
                </p>
            )}

            {status === "PROCESSING" && (
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Connecting your WhatsApp account…</span>
                </div>
            )}

            {status === "CONNECTED" && (
                <div className="flex items-start gap-2 text-sm text-emerald-500">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <span>
                        {result?.previous_history_hidden
                            ? `WhatsApp connected to ${result.business_number}. Conversations from your previous number (${result.previous_business_number}) are kept safely in WhatsNexus but are not shown under the new number.`
                            : result?.migration_mode === "SAME_NUMBER"
                                ? "WhatsApp connected. This is the same business number, so your existing chats and contacts are unchanged."
                                : "WhatsApp connected."}
                    </span>
                </div>
            )}

            {status === "CANCELLED" && (
                <div className="flex items-center justify-between gap-3">
                    <p className={cn("text-sm", muted)}>
                        {error || "Setup was cancelled. No changes have been made to your WhatsApp setup."}
                    </p>
                    <button type="button" onClick={reset} className="text-sm font-medium text-emerald-500 hover:underline">
                        Dismiss
                    </button>
                </div>
            )}

            {status === "FAILED" && (
                <div
                    role="alert"
                    className={cn(
                        "p-4 rounded-xl border flex items-start justify-between gap-3",
                        isDarkMode ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200",
                    )}
                >
                    <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                        <p className={cn("text-sm", isDarkMode ? "text-red-300" : "text-red-700")}>
                            {error || "We could not connect WhatsApp. Please try again."}
                            {COEXISTENCE_NOT_ELIGIBLE_CODES.has(errorCode || "") ? "" : " Your existing WhatsApp setup was not changed."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={reset}
                        className="flex items-center gap-1 text-sm font-medium text-emerald-500 hover:underline shrink-0"
                    >
                        <RefreshCw size={14} />
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
};
