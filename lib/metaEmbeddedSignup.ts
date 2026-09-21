/* Meta Embedded Signup — browser-side helpers.
 *
 * Only public values Meta requires client-side (app id, config id) ever reach
 * this code. The App Secret and all access tokens stay on the backend; the only
 * credential handled here is the short-lived, single-use authorization code.
 */

export type EmbeddedSignupStatus =
    | "NOT_STARTED"
    | "STARTED"
    | "AUTHORIZATION_RECEIVED"
    | "PROCESSING"
    | "CONNECTED"
    | "FAILED"
    | "CANCELLED";

export const SESSION_EVENT = {
    FINISH: "FINISH",
    FINISH_COEXISTENCE: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
    FINISH_ONLY_WABA: "FINISH_ONLY_WABA",
    CANCEL: "CANCEL",
    ERROR: "ERROR",
} as const;

const KNOWN_EVENTS = new Set<string>(Object.values(SESSION_EVENT));
const ID_PATTERN = /^\d{5,32}$/;

export type EmbeddedSignupSessionEvent =
    | { kind: "finish"; event: string; waba_id: string; phone_number_id?: string; business_id?: string }
    | { kind: "only_waba" }
    | { kind: "cancel"; step?: string }
    | { kind: "error"; message: string };

/**
 * Accept messages only from Meta over HTTPS. A strict, anchored host match —
 * NOT `endsWith("facebook.com")`, which "evilfacebook.com" would satisfy.
 */
export const isTrustedMetaOrigin = (origin: string): boolean => {
    try {
        const url = new URL(origin);
        return (
            url.protocol === "https:" &&
            (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"))
        );
    } catch {
        return false;
    }
};

const cleanId = (v: unknown): string | undefined =>
    typeof v === "string" && ID_PATTERN.test(v) ? v : undefined;

/**
 * Validate the shape of a `WA_EMBEDDED_SIGNUP` message. Returns null for
 * anything that is not exactly the expected event — arbitrary
 * window.postMessage data is never trusted.
 */
export const parseEmbeddedSignupMessage = (raw: unknown): EmbeddedSignupSessionEvent | null => {
    let msg: unknown = raw;
    if (typeof raw === "string") {
        try {
            msg = JSON.parse(raw);
        } catch {
            return null;
        }
    }
    if (!msg || typeof msg !== "object") return null;

    const m = msg as Record<string, unknown>;
    if (m.type !== "WA_EMBEDDED_SIGNUP") return null;
    if (typeof m.event !== "string" || !KNOWN_EVENTS.has(m.event)) return null;

    const data = m.data && typeof m.data === "object" ? (m.data as Record<string, unknown>) : {};

    if (m.event === SESSION_EVENT.FINISH || m.event === SESSION_EVENT.FINISH_COEXISTENCE) {
        const waba_id = cleanId(data.waba_id);
        if (!waba_id) return null;
        return {
            kind: "finish",
            event: m.event,
            waba_id,
            phone_number_id: cleanId(data.phone_number_id),
            business_id: cleanId(data.business_id),
        };
    }
    if (m.event === SESSION_EVENT.FINISH_ONLY_WABA) return { kind: "only_waba" };
    if (m.event === SESSION_EVENT.CANCEL) {
        const step = typeof data.current_step === "string" ? data.current_step.slice(0, 64) : undefined;
        return { kind: "cancel", step };
    }
    // ERROR — never echo Meta's free text verbatim into the UI beyond a short, plain string.
    const message =
        typeof data.error_message === "string" ? data.error_message.replace(/[<>]/g, "").slice(0, 200) : "";
    return { kind: "error", message };
};

// ── Public (browser-safe) configuration ──

/**
 * The only Embedded Signup values that may live in the browser. Both are optional:
 * the SERVER-issued values are authoritative (the App Secret that exchanges the
 * auth code must belong to the same app that issued it), so these are used as a
 * misconfiguration guard, not as a second source of truth.
 * (NEXT_PUBLIC_* must be referenced literally so Next.js can inline them.)
 */
export const getPublicEmbeddedSignupEnv = () => ({
    appId: (process.env.NEXT_PUBLIC_WHATSNEXUS_META_APP_ID || "").trim() || null,
    configId: (process.env.NEXT_PUBLIC_WHATSNEXUS_EMBEDDED_SIGNUP_CONFIG_ID || "").trim() || null,
});

/**
 * A frontend pointing at a different Meta app / configuration than the backend would
 * make every auth code unexchangeable. Detect it up front instead of failing later.
 */
export const launchMatchesPublicEnv = (
    start: { app_id: string; config_id: string },
    env: { appId: string | null; configId: string | null } = getPublicEmbeddedSignupEnv(),
): boolean => (!env.appId || env.appId === start.app_id) && (!env.configId || env.configId === start.config_id);

// ── Facebook JS SDK loader ──

interface FbLoginResponse {
    authResponse?: { code?: string } | null;
    status?: string;
}

interface FbSdk {
    init: (opts: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
    login: (cb: (res: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
}

declare global {
    interface Window {
        FB?: FbSdk;
        fbAsyncInit?: () => void;
    }
}

const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";
let sdkPromise: Promise<FbSdk> | null = null;
let initializedKey: string | null = null;

export const loadFacebookSdk = (appId: string, version: string): Promise<FbSdk> => {
    if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
    const key = `${appId}:${version}`;

    const init = (fb: FbSdk) => {
        if (initializedKey !== key) {
            fb.init({ appId, autoLogAppEvents: true, xfbml: true, version });
            initializedKey = key;
        }
        return fb;
    };

    if (window.FB) return Promise.resolve(init(window.FB));
    if (sdkPromise) return sdkPromise.then(init);

    sdkPromise = new Promise<FbSdk>((resolve, reject) => {
        window.fbAsyncInit = () => {
            if (window.FB) resolve(window.FB);
            else reject(new Error("Facebook SDK failed to initialise"));
        };
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error("Could not load the Meta sign-up SDK"));
        };
        document.body.appendChild(script);
    });
    return sdkPromise.then(init);
};

export const launchEmbeddedSignup = (
    fb: FbSdk,
    params: { config_id: string; extras: Record<string, unknown> },
    onResponse: (res: FbLoginResponse) => void,
) => {
    fb.login((res) => onResponse(res), {
        config_id: params.config_id,
        response_type: "code",
        override_default_response_type: true,
        extras: params.extras,
    });
};

/** Minimal shape of an axios error as far as the onboarding UI cares. */
export interface ApiErrorLike {
    message?: string;
    response?: { data?: { message?: string; code?: string } };
}

export const readApiError = (err: unknown): { message: string | null; code: string | null } => {
    const e = err as ApiErrorLike | null;
    return {
        message: e?.response?.data?.message || e?.message || null,
        code: e?.response?.data?.code ?? null,
    };
};
