"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetaSetupGuideProps {
    isDarkMode: boolean;
}

const guides = [
    {
        id: "manual",
        title: "Manual WhatsApp API setup",
        description: "Use this only when entering your Meta credentials below.",
        steps: [
            ["Create or select a Meta business portfolio", "Sign in to Meta Business Suite with an administrator account. Complete business verification if Meta asks for it."],
            ["Create a Meta app and add WhatsApp", "In Meta for Developers, create or select an app, add the WhatsApp product, then open WhatsApp API Setup."],
            ["Add and verify the business number", "Add the number in API Setup and verify it by SMS or phone call. Copy the WABA ID and Phone Number ID."],
            ["Create a system-user token", "Create a system user in Business Settings, assign the app and WhatsApp assets, then generate a long-lived token with the required WhatsApp permissions."],
            ["Configure the WhatsNexus webhook", "Enter the callback URL and verify token supplied by WhatsNexus in WhatsApp Configuration, verify it, then subscribe the required webhook fields."],
        ],
    },
    {
        id: "embedded-standard",
        title: "Embedded Signup — new Cloud API connection",
        description: "Use “Set up WhatsApp with Meta” to connect through the Meta popup.",
        steps: [
            ["Start Meta setup from WhatsNexus", "Select Set up WhatsApp with Meta. Do not create or paste an access token in this page for this flow."],
            ["Sign in as the business administrator", "Use a Meta account with admin access to the business portfolio. Choose an existing portfolio or create one in the popup."],
            ["Create or select the WhatsApp Business Account", "Follow the popup to select or create the WhatsApp Business Account and provide the display name and business details Meta requires."],
            ["Add and verify a phone number", "Enter the business number, choose SMS or call verification, and complete the code verification in Meta."],
            ["Finish and test", "Complete the popup and return here. WhatsNexus stores the Meta connection and subscribes its app; send a test message once the account shows Connected."],
        ],
    },
    {
        id: "coexistence",
        title: "Embedded coexistence — keep the WhatsApp Business App",
        description: "Use “Connect Existing WhatsApp Business App” for an eligible number already used in the Business App.",
        steps: [
            ["Confirm the number is ready", "Use the same number currently active in WhatsApp Business. Keep the Business App installed and updated; Meta confirms eligibility during setup."],
            ["Start Business App connection", "Select Connect Existing WhatsApp Business App in WhatsNexus. If replacing a connection, confirm the replacement before continuing."],
            ["Choose the existing business and number", "In Meta’s popup, sign in as an administrator and select the business portfolio, WhatsApp Business Account, and the existing Business App number."],
            ["Approve coexistence", "Review Meta’s coexistence terms and complete verification in the popup. Do not delete the Business App account or re-register the number while it is processing."],
            ["Verify new activity", "After WhatsNexus shows Connected, send one message from the Business App and one from WhatsNexus. Pre-existing Business App chat history is not imported automatically."],
        ],
    },
] as const;

export const MetaSetupGuide = ({ isDarkMode }: MetaSetupGuideProps) => {
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    return (
        <div className="space-y-4 sticky top-8">
            <div className={cn(
                "p-6 rounded-xl border backdrop-blur-xl",
                isDarkMode ? "bg-white/[0.02] border-white/10" : "bg-white border-slate-200",
            )}>
                <div className="flex items-start space-x-3 mb-4">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        isDarkMode ? "bg-white/10" : "bg-slate-100",
                    )}>
                        <Building2 className={cn("text-slate-500", isDarkMode && "text-white")} size={20} />
                    </div>
                    <div className="flex-1">
                        <h3 className={cn("font-semibold mb-1", isDarkMode ? "text-white" : "text-slate-900")}>
                            WhatsApp connection guides
                        </h3>
                        <p className={cn("text-sm", isDarkMode ? "text-white/60" : "text-slate-600")}>
                            Choose the flow that matches how this business number is connected.
                        </p>
                    </div>
                </div>

                <div className="space-y-5">
                    {guides.map((guide) => (
                        <section key={guide.id}>
                            <h4 className={cn("text-sm font-semibold mb-1", isDarkMode ? "text-white" : "text-slate-900")}>{guide.title}</h4>
                            <p className={cn("text-xs mb-2", isDarkMode ? "text-white/60" : "text-slate-600")}>{guide.description}</p>
                            <div className="space-y-2">
                                {guide.steps.map(([title, detail], index) => {
                                    const id = `${guide.id}-${index}`;
                                    const expanded = expandedSection === id;
                                    return (
                                        <div key={id} className={cn("rounded-lg border overflow-hidden", isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200")}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedSection(expanded ? null : id)}
                                                className={cn("w-full px-4 py-3 flex items-center justify-between text-left transition-colors", isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50")}
                                            >
                                                <span className="flex items-center space-x-3">
                                                    <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", isDarkMode ? "bg-white/10 text-white/60" : "bg-slate-100 text-slate-500")}>{index + 1}</span>
                                                    <span className={cn("font-medium text-sm", isDarkMode ? "text-white" : "text-slate-900")}>{title}</span>
                                                </span>
                                                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            {expanded && (
                                                <div className={cn("px-4 pb-4 pt-2 text-sm leading-relaxed", isDarkMode ? "text-white/70" : "text-slate-600")}>
                                                    {detail}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <a
                    href="https://developers.facebook.com/docs/whatsapp/embedded-signup/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 text-sm text-blue-500 hover:underline inline-flex items-center"
                >
                    Open Meta Embedded Signup documentation <ExternalLink size={12} className="ml-1" />
                </a>
            </div>
        </div>
    );
};