import { _axios } from "@/helper/axios";

// shortcut: completion waits on several sequential Meta API calls; move it to async status polling if this can exceed a minute.
const EMBEDDED_SIGNUP_COMPLETE_TIMEOUT_MS = 60_000;

export interface WhatsappConfigData {
    waba_id: string;
    phone_number_id: string;
    whatsapp_number: string;
    access_token: string;
    app_id: string;
}

export class whatsappConfigApiData {
    getWhatsAppConfig = async () => {
        return await _axios("get", "/whatsapp/whatsapp-account");
    }
    saveWhatsappConfig = async (data: WhatsappConfigData) => {
        return await _axios("post", "/whatsapp/whatsapp-account/manual", data);
    }
    testWhatsAppConfig = async (data: any) => {
        return await _axios("post", "/whatsapp/whatsapp-account/test", data);
    }
    sendTestWhatsAppConfig = async (data: any) => {
        return await _axios("post", "/whatsapp/chats/send-test", data);
    }
    updateStatusWhatsappConfig = async (id: string, status: any) => {
        return await _axios("post", `/whatsapp/whatsapp-account/activate`)
    }

    updateWhatsappAccount = async (data: { waba_id?: string; phone_number_id?: string; whatsapp_number?: string; app_id?: string; access_token?: string }) => {
        return await _axios("put", `/whatsapp/whatsapp-account`, data);
    }

    updateAccessToken = async (data: { access_token: string }) => {
        return await _axios("put", `/whatsapp/whatsapp-account/token`, data);
    }

    subscribeToWebhooks = async () => {
        return await _axios("post", `/whatsapp/whatsapp-account/subscribe-webhooks`);
    }

    getTierLimit = async () => {
        return await _axios("get", `/whatsapp/whatsapp-account/tier-limit`);
    }

    // ── Meta Embedded Signup ──
    getOnboardingConfig = async () => {
        return await _axios("get", `/whatsapp/whatsapp-account/onboarding-config`);
    }

    startEmbeddedSignup = async (data: { connection_type: EmbeddedConnectionType }) => {
        return await _axios("post", `/whatsapp/whatsapp-account/embedded-signup/start`, data);
    }

    completeEmbeddedSignup = async (data: EmbeddedSignupCompletePayload) => {
        return await _axios(
            "post",
            `/whatsapp/whatsapp-account/embedded-signup/complete`,
            data,
            "application/json",
            undefined,
            { timeout: EMBEDDED_SIGNUP_COMPLETE_TIMEOUT_MS },
        );
    }
}

export type EmbeddedConnectionType = "EMBEDDED_STANDARD" | "EMBEDDED_COEXISTENCE";

export interface OnboardingConfig {
    embedded_signup_enabled: boolean;
    coexistence_enabled: boolean;
    has_existing_connection: boolean;
    whatsapp_connection_type: string | null;
    methods: { standard: boolean; coexistence: boolean };
}

/** What Meta is asked for. Only controls Meta's launch behaviour — NEVER stored as the connection type. */
export type MetaFeatureType = "NONE" | "WHATSAPP_BUSINESS_APP_ONBOARDING";

export interface EmbeddedSignupStartResult {
    /** Server-decided onboarding mode; the browser cannot change it. */
    mode: EmbeddedConnectionType;
    connection_type: EmbeddedConnectionType;
    app_id: string;
    /** One Embedded Signup configuration serves every mode. */
    config_id: string;
    graph_api_version: string;
    feature_type: MetaFeatureType;
    /** Passed as-is to FB.login({ extras }) — already contains the Meta-compatible featureType. */
    extras: Record<string, unknown>;
    session_token: string;
}

// Only the temporary auth code + non-secret session metadata ever leave the browser.
export interface EmbeddedSignupCompletePayload {
    session_token: string;
    code: string;
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
    event?: string;
    /** Required (true) only when replacing an existing connection. */
    confirm_switch?: boolean;
    /** The mode that was launched. A consistency claim only — the server trusts its own session. */
    connection_type?: EmbeddedConnectionType;
}

/**
 * The server's decision about how the new number relates to the previous one.
 * The frontend only DISPLAYS it — it never decides whether history is kept.
 */
export interface EmbeddedSignupResult {
    migration_mode: "FIRST_CONNECTION" | "SAME_NUMBER" | "NEW_NUMBER";
    business_number: string;
    previous_business_number: string | null;
    previous_history_hidden: boolean;
}
