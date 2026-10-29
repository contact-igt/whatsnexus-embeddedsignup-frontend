"use client";

import { useState } from 'react';
import { MessageCircle, CheckCircle2, XCircle, Eye, EyeOff, Loader2, Shield, Phone, Key, Smartphone, Building2, Users, Hospital, Copy, Check, ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Organization } from "../organization/organizationView";
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useGetOnboardingConfigQuery, useGetWhatsappConfigQuery, useSaveWhatsAppConfigMutation, useStatusWhatsAppConfigQuery, useTestWhatsAppConfigQuery, useUpdateAccessTokenMutation, useUpdateWhatsappAccountMutation } from '@/hooks/useWhatsappConfigQuery';
import { WhatsappConnectionList } from './whatsappConnectionList';
import { TestMessageCard } from './testMessageCard';
import { MetaVerificationCard } from './metaVerificationCard';
import { MetaSetupGuide } from './metaSetupGuide';
import { EmbeddedSignupCard } from './embeddedSignupCard';
import { EmbeddedConnectionSummary } from './embeddedConnectionSummary';
import { WhatsAppFlowStepper } from './whatsappFlowStepper';
import { getWebhookBaseURL } from '@/helper/axios';
import { useAuth } from '@/redux/selectors/auth/authSelector';
import { useDispatch } from 'react-redux';
import { updateWebhookStatus } from '@/redux/slices/auth/authSlice';
import { toast } from '@/lib/toast';
interface WhatsAppConfig {
    waba_id: string;
    phone_number_id: string;
    whatsapp_number: string;
    access_token: string;
    app_id: string;
}

export const whatsappConnectSchema = z.object({
    waba_id: z
        .string()
        .regex(/^\d+$/, "WABA ID must contain only numbers")
        .min(8, "WABA ID is too short")
        .max(20, "WABA ID is too long"),

    phone_number_id: z
        .string()
        .regex(/^\d+$/, "Phone Number ID must contain only numbers")
        .min(8, "Phone Number ID is too short")
        .max(30, "Phone Number ID is too long"),

    whatsapp_number: z
        .string()
        .regex(/^\d+$/, "WhatsApp number must contain only numbers")
        .min(7, "WhatsApp number is too short")
        .max(15, "WhatsApp number must be at most 15 digits"),

    access_token: z
        .string()
        .min(100, "Access token is too short")
        .max(900, "Access token is too long"),

    app_id: z
        .string()
        .regex(/^\d+$/, "App ID must contain only numbers")
        .min(8, "App ID is too short")
        .max(20, "App ID is too long"),
});

export const WhatsAppConnectionView = () => {
    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<WhatsAppConfig>({
        resolver: zodResolver(whatsappConnectSchema),
        defaultValues: {
            waba_id: '',
            whatsapp_number: '',
            phone_number_id: '',
            access_token: '',
            app_id: '',
        }
    })
    const { user } = useAuth();
    const isAdmin = user?.role === 'tenant_admin';
    const dispatch = useDispatch();
    const { data: WhatsAppConnectionData, isLoading: isWhatsappLoading, refetch: refetchWhatsAppConfig } = useGetWhatsappConfigQuery();
    const { mutate: saveWhatsConfigMutate, isPending: isSaveLoading } = useSaveWhatsAppConfigMutation();
    const { mutate: testWhatsConfigMutate, isPending: isTestLoading } = useTestWhatsAppConfigQuery();
    const { mutate: updateWhatsappConfigMutate, isPending: isUpdateLoading } = useStatusWhatsAppConfigQuery();
    const { mutate: updateAccessTokenMutate, isPending: isTokenUpdateLoading } = useUpdateAccessTokenMutation();
    const { mutate: updateWhatsappAccountMutate, isPending: isAccountUpdateLoading } = useUpdateWhatsappAccountMutation();
    const { isDarkMode } = useTheme();
    // Embedded Signup options are server-approved per organization. Null / all-false => the existing manual-only page.
    const { data: onboardingConfig } = useGetOnboardingConfigQuery();
    const embeddedMethods = onboardingConfig?.methods;
    const hasEmbeddedMethod = !!(embeddedMethods?.standard || embeddedMethods?.coexistence);
    const showEmbeddedSignup = !WhatsAppConnectionData?.data?.id && hasEmbeddedMethod;
    // Existing manual (LEGACY) connection: only an explicit, user-initiated option — never automatic.
    const showEmbeddedSwitch =
        !!WhatsAppConnectionData?.data?.id &&
        WhatsAppConnectionData?.data?.whatsapp_connection_type === 'LEGACY_MANUAL' &&
        hasEmbeddedMethod;
    const isEmbeddedConnection = !!WhatsAppConnectionData?.data?.id &&
        ['EMBEDDED_STANDARD', 'EMBEDDED_COEXISTENCE'].includes(WhatsAppConnectionData.data.whatsapp_connection_type);

    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);
    const [isSubscribingWebhook, setIsSubscribingWebhook] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [webhookStatusData, setWebhookStatusData] = useState<any>(null);
    const [testConnectionSuccess, setTestConnectionSuccess] = useState(false);

    const [showAccessToken, setShowAccessToken] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    const handleTestConnection = () => {
        testWhatsConfigMutate(undefined, {
            onSuccess: () => setTestConnectionSuccess(true),
            onError: () => setTestConnectionSuccess(false),
        });
    }
    const handleDeleteClick = (id: any) => {
        // setSelectedOrgId(id);
        // setIsDeleteModalOpen(true);
    };

    const handleToggleActive = (id: any, status: string) => {
        // If trying to activate
        if (status !== 'active') {
            // Must have successful test connection first
            if (!testConnectionSuccess) {
                toast.error('Please complete a successful Connection Test first.');
                return;
            }

            // Must have verified webhook
            if (!user?.webhook_verified) {
                toast.error('Webhook verification required before activation.');
                setShowVerification(true);
                return;
            }
        }

        // If verified or deactivating, proceed with toggle
        const data = {
            status: status == "active" ? "inactive" : "active"
        }
        updateWhatsappConfigMutate({ id, data });
    }

    const handleEditClick = (connection: any) => {
        
    };

    const handleSaveEdit = (fields: { waba_id: string; phone_number_id: string; whatsapp_number: string; app_id: string; access_token: string }) => {
        if (fields.access_token && fields.access_token.length < 50) {
            toast.error('Access token is too short. Please enter a valid token.');
            return;
        }
        const payload: Record<string, string> = {};
        if (fields.waba_id) payload.waba_id = fields.waba_id;
        if (fields.phone_number_id) payload.phone_number_id = fields.phone_number_id;
        if (fields.whatsapp_number) payload.whatsapp_number = fields.whatsapp_number;
        if (fields.app_id !== undefined) payload.app_id = fields.app_id;
        if (fields.access_token) payload.access_token = fields.access_token;
        updateWhatsappAccountMutate(payload);
    };

    const getStatusColor = () => {
        if (WhatsAppConnectionData?.data?.id) return 'text-emerald-500 bg-emerald-500/10';
        return 'text-slate-500 bg-slate-500/10';
    };
    const whatsappNumber = watch("whatsapp_number");
    const getStatusIcon = () => {
        if (WhatsAppConnectionData?.data?.id) return <CheckCircle2 size={16} />;
        return <XCircle size={16} />;
    };

    const onSubmit = (data: any) => {
        saveWhatsConfigMutate({ data });
    }

    const handleCheckWebhookStatus = async () => {
        if (!user?.tenant_id) return;

        setIsCheckingWebhook(true);
        setShowVerification(true); // Always show verification card when checking
        try {
            const response = await new (await import('@/services/tenant')).TenantApiData().getWebhookStatus(user.tenant_id);
            const statusData = response?.data;
            const webhookVerified = statusData?.webhook_verified || false;
            dispatch(updateWebhookStatus(webhookVerified));
            setWebhookStatusData(statusData); // Store the status data

            if (webhookVerified) {
                await refetchWhatsAppConfig();
            }
        } catch (error: any) {
            console.error('Failed to check webhook status:', error);
        } finally {
            setIsCheckingWebhook(false);
        }
    };

    const handleSubscribeWebhooks = async () => {
        setIsSubscribingWebhook(true);
        try {
            const { whatsappConfigApiData } = await import('@/services/whatsappConfiguration');
            const response = await new whatsappConfigApiData().subscribeToWebhooks();

            if (response?.data?.success) {
                toast.success('Successfully subscribed to webhook fields (messages, message_template_status_update)');
                // Refresh the status to show updated subscription
                await handleCheckWebhookStatus();
            } else {
                toast.error(response?.data?.message || 'Failed to subscribe to webhooks');
            }
        } catch (error: any) {
            console.error('Failed to subscribe to webhooks:', error);
            toast.error(error?.response?.data?.message || 'Failed to subscribe to webhooks');
        } finally {
            setIsSubscribingWebhook(false);
        }
    };
    return (
        <div className="h-full overflow-y-auto p-8 animate-in slide-in-from-bottom-8 duration-700 mx-auto no-scrollbar pb-32">
            <div className="max-w-[1200px] mx-auto space-y-8">
                <div>
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <h1 className={cn("text-3xl font-bold tracking-tight", isDarkMode ? 'text-white' : 'text-slate-900')}>
                                WhatsApp Business API
                            </h1>
                            <p className={cn("text-sm", isDarkMode ? 'text-white/60' : 'text-slate-600')}>
                                Configure WhatsApp Business API for <span className="font-semibold">{organization?.company_name || "City Hospital"}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Main Content - Left Column */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Status Bar */}
                        <div className="flex items-center space-x-3 mb-2">
                            <div className={cn(
                                "flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium",
                                getStatusColor()
                            )}>
                                {getStatusIcon()}
                                <span>{WhatsAppConnectionData?.data?.id ? 'Connected' : 'Not Connected'}</span>
                            </div>

                            {isAdmin && !isEmbeddedConnection && (
                                <button
                                    onClick={handleCheckWebhookStatus}
                                    disabled={isCheckingWebhook || !testConnectionSuccess}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                                        isDarkMode
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100",
                                        (isCheckingWebhook || !testConnectionSuccess) && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                    )}
                                >
                                    {isCheckingWebhook ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <RefreshCw size={16} />
                                    )}
                                    <span>{isCheckingWebhook ? 'Checking...' : 'Check Webhook Status'}</span>
                                </button>
                            )}
                        </div>

                        {WhatsAppConnectionData?.data?.id && (
                            <div className={cn(
                                "p-6 rounded-xl border backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500",
                                isDarkMode
                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                    : "bg-emerald-50 border-emerald-200"
                            )}>
                                <div className="flex items-center space-x-3">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center",
                                        isDarkMode ? "bg-emerald-500/20" : "bg-emerald-100"
                                    )}>
                                        <MessageCircle className="text-emerald-500" size={24} />
                                    </div>
                                    <div>
                                        <h3 className={cn("font-semibold", isDarkMode ? "text-white" : "text-slate-900")}>
                                            WhatsApp Connected
                                        </h3>
                                        <p className={cn("text-sm", isDarkMode ? "text-white/60" : "text-slate-600")}>
                                            Last connected: {new Date().toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {WhatsAppConnectionData?.data?.id ? (
                            <div className="space-y-6">
                                {isEmbeddedConnection ? (
                                    <>
                                        <EmbeddedConnectionSummary
                                            isDarkMode={isDarkMode}
                                            account={WhatsAppConnectionData.data}
                                            health={webhookStatusData}
                                            checkingHealth={isCheckingWebhook}
                                            isAdmin={isAdmin}
                                            onCheckHealth={handleCheckWebhookStatus}
                                        />
                                        {embeddedMethods && <EmbeddedSignupCard isDarkMode={isDarkMode} isAdmin={isAdmin} methods={embeddedMethods} existingConnection />}
                                        <TestMessageCard
                                            isDarkMode={isDarkMode}
                                            isActive={WhatsAppConnectionData.data.status === 'active'}
                                            whatsappNumber={WhatsAppConnectionData.data.whatsapp_number}
                                        />
                                    </>
                                ) : <>
                                {/* Meta Verification Card - Show only when triggered by user action */}
                                {showVerification && (
                                    <MetaVerificationCard
                                        isDarkMode={isDarkMode}
                                        user={user}
                                        onCheckStatus={handleCheckWebhookStatus}
                                        isChecking={isCheckingWebhook}
                                        onSubscribeWebhooks={handleSubscribeWebhooks}
                                        isSubscribing={isSubscribingWebhook}
                                        statusData={webhookStatusData}
                                    />
                                )}

                                <WhatsappConnectionList
                                    isDarkMode={isDarkMode}
                                    handleToggleActive={handleToggleActive}
                                    handleDeleteClick={handleDeleteClick}
                                    handleEditClick={handleEditClick}
                                    WhatsAppConnectionData={WhatsAppConnectionData}
                                    onTestConnection={handleTestConnection}
                                    onSaveConfiguration={handleSaveEdit}
                                    testConnectionSuccess={testConnectionSuccess}
                                    isWebhookVerified={!!user?.webhook_verified}
                                    isAdmin={isAdmin}
                                />

                                {showEmbeddedSwitch && embeddedMethods && (
                                    <EmbeddedSignupCard isDarkMode={isDarkMode} isAdmin={isAdmin} methods={embeddedMethods} existingConnection />
                                )}

                                {/* Test MessageCard - Show if connection exists */}
                                {WhatsAppConnectionData?.data?.id && (
                                    <TestMessageCard
                                        isDarkMode={isDarkMode}
                                        isActive={WhatsAppConnectionData.data.status === 'active'}
                                        whatsappNumber={WhatsAppConnectionData.data.whatsapp_number}
                                    />
                                )}
                                </>}
                            </div>
                        ) : (
                            <>
                            {showEmbeddedSignup && embeddedMethods && (
                                <EmbeddedSignupCard isDarkMode={isDarkMode} isAdmin={isAdmin} methods={embeddedMethods} />
                            )}
                            <div className={cn(
                                "p-8 rounded-xl border backdrop-blur-xl mt-5",
                                isDarkMode
                                    ? "bg-white/[0.02] border-white/10"
                                    : "bg-white border-slate-200"
                            )}>
                                <div className="space-y-6">
                                    <div>
                                        <h2 className={cn("text-xl font-bold mb-2", isDarkMode ? "text-white" : "text-slate-900")}>
                                            API Credentials
                                        </h2>
                                        <p className={cn("text-sm", isDarkMode ? "text-white/60" : "text-slate-600")}>
                                            Enter your Meta Business API credentials to connect WhatsApp
                                        </p>
                                    </div>
                                    <form onSubmit={handleSubmit(onSubmit)}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Input
                                                {...register("waba_id")}
                                                autoComplete='new-password'
                                                isDarkMode={isDarkMode}
                                                label="WhatsApp Business Account ID"
                                                icon={Shield}
                                                placeholder="Enter WABA ID"
                                                error={errors.waba_id?.message}
                                                required
                                            />

                                            <Input
                                                {...register("phone_number_id")}
                                                autoComplete='new-password'
                                                isDarkMode={isDarkMode}
                                                label="Phone Number ID"
                                                icon={Phone}
                                                placeholder="Enter Phone Number ID"
                                                error={errors.phone_number_id?.message}
                                                required
                                            />
                                            <div className='md:col-span-2 relative'>
                                                <Input
                                                    {...register("whatsapp_number")}
                                                    autoComplete='new-password'
                                                    isDarkMode={isDarkMode}
                                                    label="Whatsapp Number"
                                                    icon={MessageCircle}
                                                    placeholder="Enter Whatsapp Number"
                                                    error={errors.whatsapp_number?.message}
                                                    required
                                                    onChange={(e) => {
                                                        const cleaned = e.target.value.replace(/[\s+]/g, '').slice(0, 15);
                                                        // Avoid validating on every keystroke to prevent showing
                                                        // "too short" errors while the user is still typing.
                                                        setValue("whatsapp_number", cleaned, { shouldValidate: false });
                                                    }}
                                                />
                                            </div>

                                            <div className="md:col-span-2 relative mb-5">
                                                <Input
                                                    {...register("access_token")}
                                                    autoComplete='new-password'
                                                    isDarkMode={isDarkMode}
                                                    label="Access Token"
                                                    icon={Key}
                                                    type={showAccessToken ? "text" : "password"}
                                                    placeholder="Enter your Meta Access Token"
                                                    error={errors?.access_token?.message}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAccessToken(!showAccessToken)}
                                                    className={cn(
                                                        "absolute right-3 top-8 p-1.5 rounded-lg transition-colors",
                                                        isDarkMode
                                                            ? "hover:bg-white/10 text-white/60 hover:text-white"
                                                            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                                                    )}
                                                >
                                                    {showAccessToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>

                                            <div className="md:col-span-2">
                                                <Input
                                                    {...register("app_id")}
                                                    autoComplete='new-password'
                                                    isDarkMode={isDarkMode}
                                                    label="Meta App ID"
                                                    icon={Building2}
                                                    placeholder="Enter Meta App ID"
                                                    error={errors.app_id?.message}
                                                    required
                                                />
                                                <p className={cn("text-[10px] mt-1.5 ml-1", isDarkMode ? "text-white/40" : "text-slate-500")}>
                                                    Providing your Meta App ID is required for Media Gallery features.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                            <div className="flex items-center space-x-3">
                                            </div>

                                            <button
                                                type='submit'
                                                className={cn(
                                                    "flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg hover:brightness-110",
                                                    isDarkMode ? "bg-emerald-600 shadow-emerald-900/20" : "bg-emerald-600 shadow-emerald-600/20"
                                                )}
                                            >
                                                <CheckCircle2 size={16} />
                                                <span>Save Configuration</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            </>
                        )}
                    </div>

                    {!isEmbeddedConnection && <div className="xl:col-span-1 space-y-6">
                        <WhatsAppFlowStepper isDarkMode={isDarkMode} />
                        <MetaSetupGuide isDarkMode={isDarkMode} user={user} />
                    </div>}
                </div>
            </div>
        </div>
    );
};
