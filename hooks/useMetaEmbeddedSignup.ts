"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
    whatsappConfigApiData,
    EmbeddedConnectionType,
    EmbeddedSignupResult,
    EmbeddedSignupStartResult,
} from "@/services/whatsappConfiguration";
import {
    EmbeddedSignupSessionEvent,
    EmbeddedSignupStatus,
    isTrustedMetaOrigin,
    launchEmbeddedSignup,
    launchMatchesPublicEnv,
    loadFacebookSdk,
    parseEmbeddedSignupMessage,
    readApiError,
} from "@/lib/metaEmbeddedSignup";

const api = new whatsappConfigApiData();

// Server-issued session tokens live 30 min; refresh a little earlier.
const PREPARED_TTL_MS = 20 * 60 * 1000;
// After Meta returns the auth code, the matching session event should follow immediately.
const SESSION_EVENT_WAIT_MS = 15_000;

interface Prepared {
    start: EmbeddedSignupStartResult;
    at: number;
}

type FinishEvent = Extract<EmbeddedSignupSessionEvent, { kind: "finish" }>;

interface ActiveSession {
    type: EmbeddedConnectionType;
    start: EmbeddedSignupStartResult;
    code: string | null;
    finish: FinishEvent | null;
    done: boolean;
    timer: ReturnType<typeof setTimeout> | null;
}

export interface UseMetaEmbeddedSignupResult {
    status: EmbeddedSignupStatus;
    error: string | null;
    errorCode: string | null;
    /** true once the server gate passed AND the Meta SDK is ready for that mode */
    ready: Record<EmbeddedConnectionType, boolean>;
    /** why a mode could not be prepared (e.g. platform not configured) */
    unavailable: Record<EmbeddedConnectionType, string | null>;
    /** Server's history decision for the last successful connection. */
    result: EmbeddedSignupResult | null;
    launch: (type: EmbeddedConnectionType) => void;
    reset: () => void;
}

const emptyMap = <T,>(v: T): Record<EmbeddedConnectionType, T> => ({
    EMBEDDED_STANDARD: v,
    EMBEDDED_COEXISTENCE: v,
});

export const useMetaEmbeddedSignup = (
    methods: { standard: boolean; coexistence: boolean },
    options: { confirmSwitch?: boolean } = {},
): UseMetaEmbeddedSignupResult => {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<EmbeddedSignupStatus>("NOT_STARTED");
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [ready, setReady] = useState(emptyMap(false));
    const [unavailable, setUnavailable] = useState<Record<EmbeddedConnectionType, string | null>>(emptyMap(null));

    const prepared = useRef<Record<EmbeddedConnectionType, Prepared | null>>(emptyMap<Prepared | null>(null));
    const preparing = useRef<Record<EmbeddedConnectionType, boolean>>(emptyMap(false));
    const session = useRef<ActiveSession | null>(null);
    const [result, setResult] = useState<EmbeddedSignupResult | null>(null);
    // The user's explicit confirmation to replace an existing connection (server re-checks it).
    const confirmRef = useRef(false);
    confirmRef.current = !!options.confirmSwitch;

    const fail = useCallback((message: string, code: string | null = null) => {
        const s = session.current;
        if (s) {
            s.done = true;
            s.code = null;
            if (s.timer) clearTimeout(s.timer);
        }
        setError(message);
        setErrorCode(code);
        setStatus("FAILED");
    }, []);

    const cancel = useCallback((message?: string) => {
        const s = session.current;
        if (s) {
            s.done = true;
            s.code = null;
            if (s.timer) clearTimeout(s.timer);
        }
        setError(message ?? null);
        setErrorCode(null);
        setStatus("CANCELLED");
    }, []);

    const maybeComplete = useCallback(() => {
        const s = session.current;
        if (!s || s.done || !s.code || !s.finish) return;

        const code = s.code;
        s.code = null; // single-use; never kept longer than needed
        if (s.timer) clearTimeout(s.timer);
        s.done = true;
        setStatus("PROCESSING");

        api
            .completeEmbeddedSignup({
                session_token: s.start.session_token,
                code,
                waba_id: s.finish.waba_id,
                phone_number_id: s.finish.phone_number_id,
                business_id: s.finish.business_id,
                event: s.finish.event,
                // consistency claim only; the server completes with the mode of its own session
                connection_type: s.type,
                ...(confirmRef.current ? { confirm_switch: true } : {}),
            })
            .then((res: { data?: EmbeddedSignupResult }) => {
                const decision = res?.data ?? null;
                setResult(decision);
                setStatus("CONNECTED");
                toast.success(
                    decision?.previous_history_hidden
                        ? "WhatsApp connected. Conversations from your previous number are kept safely but are not shown under the new number."
                        : decision?.migration_mode === "SAME_NUMBER"
                            ? "WhatsApp connected. Your existing chats and contacts were kept."
                            : "WhatsApp connected successfully",
                    // The card unmounts once the new connection loads, so keep this readable.
                    { duration: decision?.previous_history_hidden ? 15000 : 5000 },
                );
                queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
                queryClient.invalidateQueries({ queryKey: ["whatsapp-onboarding-config"] });
            })
            .catch((err: unknown) => {
                const { message, code } = readApiError(err);
                setError(message || "We could not connect WhatsApp. Please try again.");
                setErrorCode(code);
                setStatus("FAILED");
            });
    }, [queryClient]);

    // Session events from Meta's Embedded Signup popup.
    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (!isTrustedMetaOrigin(event.origin)) return;
            const s = session.current;
            if (!s || s.done) return; // no active onboarding — ignore stray messages

            const parsed = parseEmbeddedSignupMessage(event.data);
            if (!parsed) return;

            switch (parsed.kind) {
                case "finish":
                    s.finish = parsed;
                    maybeComplete();
                    break;
                case "only_waba":
                    fail("No phone number was added during setup. Please try again and add a phone number.", "PHONE_NOT_RETURNED");
                    break;
                case "cancel":
                    cancel();
                    break;
                case "error":
                    fail(parsed.message || "Meta reported a problem during setup. Please try again.", "META_SESSION_ERROR");
                    break;
            }
        };
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("message", onMessage);
            if (session.current?.timer) clearTimeout(session.current.timer);
        };
    }, [maybeComplete, fail, cancel]);

    // Prefetch the server gate + load the SDK so FB.login runs synchronously on
    // click (async work before it can get the popup blocked).
    const prepare = useCallback(async (type: EmbeddedConnectionType) => {
        if (preparing.current[type]) return;
        preparing.current[type] = true;
        try {
            const res = await api.startEmbeddedSignup({ connection_type: type });
            const start: EmbeddedSignupStartResult = res?.data; // _axios resolves the response body
            if (!launchMatchesPublicEnv(start)) {
                // deliberately no ids in the message
                throw new Error("WhatsApp setup is not configured correctly. Please contact support.");
            }
            await loadFacebookSdk(start.app_id, start.graph_api_version);
            prepared.current[type] = { start, at: Date.now() };
            setReady((r) => ({ ...r, [type]: true }));
            setUnavailable((u) => ({ ...u, [type]: null }));
        } catch (err: unknown) {
            prepared.current[type] = null;
            setReady((r) => ({ ...r, [type]: false }));
            setUnavailable((u) => ({
                ...u,
                [type]: readApiError(err).message || "Unavailable right now.",
            }));
        } finally {
            preparing.current[type] = false;
        }
    }, []);

    useEffect(() => {
        if (methods.standard) void prepare("EMBEDDED_STANDARD");
        if (methods.coexistence) void prepare("EMBEDDED_COEXISTENCE");
    }, [methods.standard, methods.coexistence, prepare]);

    const launch = useCallback(
        (type: EmbeddedConnectionType) => {
            const p = prepared.current[type];
            if (!p || Date.now() - p.at > PREPARED_TTL_MS || !window.FB) {
                // Stale — refresh in the background and ask the user to click again.
                prepared.current[type] = null;
                setReady((r) => ({ ...r, [type]: false }));
                void prepare(type);
                toast.error("Preparing secure setup — please try again in a moment.");
                return;
            }

            setError(null);
            setErrorCode(null);
            setStatus("STARTED");
            const active: ActiveSession = { type, start: p.start, code: null, finish: null, done: false, timer: null };
            session.current = active;

            launchEmbeddedSignup(
                window.FB,
                { config_id: p.start.config_id, extras: p.start.extras },
                (res) => {
                    if (session.current !== active || active.done) return;
                    const code = res?.authResponse?.code;
                    if (!code) {
                        // No code: popup closed / login refused — nothing was changed.
                        cancel();
                        return;
                    }
                    active.code = code;
                    setStatus("AUTHORIZATION_RECEIVED");
                    if (!active.finish) {
                        active.timer = setTimeout(() => {
                            if (session.current === active && !active.done) {
                                fail("The WhatsApp setup did not finish. Nothing was connected — please try again.", "SESSION_INCOMPLETE");
                            }
                        }, SESSION_EVENT_WAIT_MS);
                    }
                    maybeComplete();
                },
            );
        },
        [prepare, maybeComplete, cancel, fail],
    );

    const reset = useCallback(() => {
        if (session.current?.timer) clearTimeout(session.current.timer);
        session.current = null;
        setError(null);
        setErrorCode(null);
        setResult(null);
        setStatus("NOT_STARTED");
    }, []);

    return { status, error, errorCode, ready, unavailable, result, launch, reset };
};
