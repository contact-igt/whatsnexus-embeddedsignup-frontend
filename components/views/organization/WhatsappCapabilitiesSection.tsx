"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/redux/selectors/auth/authSelector";
import {
    useGetWhatsappCapabilitiesQuery,
    useUpdateWhatsappCapabilitiesMutation,
} from "@/hooks/useWhatsappCapabilitiesQuery";

interface WhatsappCapabilitiesSectionProps {
    tenantId: string;
    isDarkMode: boolean;
}

/**
 * Super Admin control over which WhatsApp onboarding methods an organization may
 * use. Saves independently of the organization form and NEVER touches an
 * existing WhatsApp connection — it only enables / disables NEW onboarding.
 * (The server re-checks every flag and only accepts writes from super_admin.)
 */
export const WhatsappCapabilitiesSection = ({ tenantId, isDarkMode }: WhatsappCapabilitiesSectionProps) => {
    const { user } = useAuth();
    const canEdit = user?.role === "super_admin";

    const { data, isLoading, isError } = useGetWhatsappCapabilitiesQuery(tenantId);
    const { mutate, isPending } = useUpdateWhatsappCapabilitiesMutation(tenantId);

    // Unsaved edits only; everything else is derived from the server state.
    const [draft, setDraft] = useState<{ embedded?: boolean; coexistence?: boolean }>({});
    const embedded = draft.embedded ?? !!data?.embedded_signup_enabled;
    const coexistence = embedded && (draft.coexistence ?? !!data?.coexistence_enabled);
    const setEmbedded = (v: boolean) => setDraft((d) => ({ ...d, embedded: v, ...(v ? {} : { coexistence: false }) }));
    const setCoexistence = (v: boolean) => setDraft((d) => ({ ...d, coexistence: v }));

    const dirty =
        !!data && (embedded !== !!data.embedded_signup_enabled || coexistence !== !!data.coexistence_enabled);

    const label = cn("text-sm font-medium", isDarkMode ? "text-white" : "text-slate-800");
    const hint = cn("text-xs", isDarkMode ? "text-white/40" : "text-slate-500");

    return (
        <div
            className="space-y-4 border-t pt-4"
            style={{ borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
        >
            <h3
                className={`text-sm font-bold ${isDarkMode ? "text-white/40" : "text-slate-400"} uppercase tracking-wider flex items-center gap-2`}
            >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Capabilities
            </h3>

            {isLoading && (
                <div className={hint}>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Loading…
                </div>
            )}
            {isError && <p className="text-xs text-red-500">Could not load WhatsApp capabilities.</p>}

            {data && (
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            aria-label="Embedded Signup"
                            checked={embedded}
                            disabled={!canEdit || isPending}
                            onCheckedChange={setEmbedded}
                            className="mt-0.5"
                        />
                        <div>
                            <p className={label}>Embedded Signup</p>
                            <p className={hint}>
                                Lets this organization connect WhatsApp through Meta&apos;s guided setup.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Checkbox
                            aria-label="Business App Coexistence"
                            checked={coexistence}
                            disabled={!canEdit || isPending || !embedded}
                            onCheckedChange={setCoexistence}
                            className="mt-0.5"
                        />
                        <div>
                            <p className={cn(label, !embedded && "opacity-50")}>Business App Coexistence</p>
                            <p className={hint}>
                                Lets an eligible WhatsApp Business App number stay in use while connected. Requires Embedded Signup.
                            </p>
                        </div>
                    </div>

                    <p className={hint}>
                        Changing these options never disconnects an existing WhatsApp connection.
                        {!canEdit && " Only a Super Admin can change them."}
                    </p>

                    {canEdit && (
                        <button
                            type="button"
                            disabled={!dirty || isPending}
                            onClick={() =>
                                mutate(
                                    { embedded_signup_enabled: embedded, coexistence_enabled: coexistence },
                                    { onSuccess: () => setDraft({}) },
                                )
                            }
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save WhatsApp capabilities
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
