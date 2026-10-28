
"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Organization } from "./organizationView";
import { Building2, Mail, Phone, MapPin, Users, Loader2, Cpu, Key, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateTenantMutation, useUpdateTenantMutation, useValidateOpenAIKeyMutation } from "@/hooks/useTenantQuery";
import { useGetAvailableAiModelsQuery } from "@/hooks/useBillingQuery";
import { useIndustriesQuery, usePlansQuery } from "@/hooks/useModuleAccessManagementQuery";
import { Country, State, City } from 'country-state-city';
import { sanitizePhoneInput } from "@/lib/phone";
import { IndustryType } from "./TenantFeatureAccessChecklist";
import { WhatsappCapabilitiesSection } from "./WhatsappCapabilitiesSection";

type AppointmentBookingType = 'state_machine' | 'ai_agent';

// Placeholder shown in edit/view mode so the stored OpenAI key is never exposed.
// This value is display-only — it must never be validated or sent to the backend.
const MASKED_API_KEY = '••••••••••••••••';

type OrganizationAiSettingsPayload = {
    input_model: string;
    output_model: string;
    gstin: string;
    appointment_booking_type: AppointmentBookingType;
    openai_api_key?: string;
};

interface OrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    organization?: Organization | null;
    mode: 'create' | 'edit' | 'view';
    isDarkMode: boolean;
}

export const OrganizationModal = ({
    isOpen,
    onClose,
    organization,
    mode,
    isDarkMode
}: OrganizationModalProps) => {
    const [formData, setFormData] = useState<Partial<Organization> & {
        input_model?: string;
        output_model?: string;
        openai_api_key?: string;
        gstin?: string;
        industry_type?: IndustryType;
        industry_id?: string;
        plan_id?: string;
        appointment_booking_type?: AppointmentBookingType;
    }>({
        company_name: '',
        owner_name: '',
        owner_email: '',
        owner_mobile: '',
        address: '',
        city: '',
        country: '',
        state: '',
        pincode: '',
        subscriptionStatus: 'invited',
        subscriptionPlan: 'basic',
        maxUsers: 10,
        adminName: '',
        adminEmail: '',
        isActive: true,
        industry_type: 'general',
        industry_id: '',
        plan_id: '',
        owner_country_code: '+91',
        password: '',
        input_model: 'gpt-4o-mini',
        output_model: 'gpt-4o',
        openai_api_key: '',
        gstin: '',
        appointment_booking_type: 'state_machine'
    });
    // ISO codes used to drive cascading dropdowns
    const [countryIso, setCountryIso] = useState('');
    const [stateIso, setStateIso] = useState('');
    const [isIndustryIdTouched, setIsIndustryIdTouched] = useState(false);
    const [isPlanIdTouched, setIsPlanIdTouched] = useState(false);
    // True once the admin has actually typed into the OpenAI key field in edit mode.
    // While false, the field only holds the masked placeholder and no key is saved.
    const [isApiKeyDirty, setIsApiKeyDirty] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const { mutate: createTenantMutate, isPending: isCreateTenantPending } = useCreateTenantMutation();
    const { mutate: updateTenantMutate, isPending: isUpdateTenantPending } = useUpdateTenantMutation();
    const { mutateAsync: validateOpenAIKey, isPending: isValidatingKey } = useValidateOpenAIKeyMutation();
    const {
        data: industriesResponse,
        isLoading: isIndustriesLoading,
        isError: isIndustriesError,
    } = useIndustriesQuery();
    const {
        data: plansResponse,
        isLoading: isPlansLoading,
        isError: isPlansError,
    } = usePlansQuery();

    // Organization management selects from platform-approved models. The tenant
    // credential is verified separately when an API key is entered.
    const editTenantId = mode === 'edit' ? (organization?.tenant_id || undefined) : undefined;
    const shouldLoadModels = isOpen && (mode === 'create' || !!editTenantId);
    const inputModelsQ = useGetAvailableAiModelsQuery({ purpose: 'input', enabled: shouldLoadModels });
    const outputModelsQ = useGetAvailableAiModelsQuery({ purpose: 'output', enabled: shouldLoadModels });

    const buildModelOptions = (
        q: typeof inputModelsQ,
        saved: string | undefined,
    ): { options: { label: string; value: string }[]; savedUnavailable: boolean; loading: boolean; error: boolean } => {
        if (shouldLoadModels) {
            if (q.isLoading) return { options: [], savedUnavailable: false, loading: true, error: false };
            if (q.isError) return { options: [], savedUnavailable: false, loading: false, error: true };
            const payload = q.data as { data?: { model: string }[]; meta?: { saved_selection_entry?: { unavailability_reason?: string } } } | undefined;
            const list = payload?.data ?? [];
            const options = list.map((m) => ({ label: m.model, value: m.model }));
            let savedUnavailable = false;
            if (saved && !options.some((o) => o.value === saved)) {
                savedUnavailable = true;
                const reason = payload?.meta?.saved_selection_entry?.unavailability_reason;
                options.unshift({ label: `${saved} — unavailable${reason ? ` (${reason})` : ''}`, value: saved });
            }
            return { options, savedUnavailable, loading: false, error: false };
        }
        return { options: [], savedUnavailable: false, loading: false, error: false };
    };

    const inputModelInfo = buildModelOptions(inputModelsQ, formData.input_model);
    const outputModelInfo = buildModelOptions(outputModelsQ, formData.output_model);

    const hasInvalidInputModel = inputModelInfo.savedUnavailable;
    const hasInvalidOutputModel = outputModelInfo.savedUnavailable;

    const resolveApiArray = <T,>(payload: unknown): T[] => {
        if (Array.isArray(payload)) return payload as T[];
        if (payload && typeof payload === 'object') {
            const obj = payload as Record<string, unknown>;
            if (Array.isArray(obj.data)) return obj.data as T[];
        }
        return [];
    };

    const industries = resolveApiArray<any>(industriesResponse);
    const plans = resolveApiArray<any>(plansResponse);

    const industryOptions = useMemo(() => {
        const options = [{ value: '', label: 'Not Set' }];
        for (const industry of industries) {
            options.push({
                value: industry.industry_id,
                label: `${industry.industry_name || industry.industry_key || industry.industry_id} (${industry.industry_id})`,
            });
        }

        if (formData.industry_id && !options.some((option) => option.value === formData.industry_id)) {
            options.push({
                value: formData.industry_id,
                label: `${formData.industry_id} (current)`,
            });
        }

        return options;
    }, [industries, formData.industry_id]);

    const planOptions = useMemo(() => {
        const options = [{ value: '', label: 'Not Set' }];
        for (const plan of plans) {
            options.push({
                value: plan.plan_id,
                label: `${plan.plan_name || plan.plan_key || plan.plan_id} (${plan.plan_id})`,
            });
        }

        if (formData.plan_id && !options.some((option) => option.value === formData.plan_id)) {
            options.push({
                value: formData.plan_id,
                label: `${formData.plan_id} (current)`,
            });
        }

        return options;
    }, [plans, formData.plan_id]);

    const appointmentBookingTypeOptions = [
        { value: 'state_machine', label: 'State machine appointment booking' },
        { value: 'ai_agent', label: 'AI Appointment booking' },
    ];

    const isHealthcareIndustryRecord = (industry: Record<string, unknown> | null) => {
        if (!industry) return false;
        const haystack = [
            industry.industry_id,
            industry.industry_key,
            industry.industry_name,
            industry.name,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes('health');
    };

    const isHealthcareIndustryId = (industryId: string) => {
        if (!industryId) return false;
        const industry = (industries as Array<Record<string, unknown>>).find(
            (item) => item?.industry_id === industryId
        );
        return isHealthcareIndustryRecord(industry || null);
    };

    const selectedDynamicIndustry = useMemo(() => {
        const selectedIndustryId = typeof formData.industry_id === 'string' ? formData.industry_id : '';
        if (!selectedIndustryId) return null;
        return (industries as Array<Record<string, unknown>>).find(
            (industry) => industry?.industry_id === selectedIndustryId
        ) || null;
    }, [industries, formData.industry_id]);

    const isHealthcareDynamicIndustry = isHealthcareIndustryRecord(selectedDynamicIndustry);

    const showAppointmentBookingType =
        formData.industry_type === 'healthcare' && isHealthcareDynamicIndustry;

    // Derived Location Options
    const countryOptions = Country.getAllCountries().map(c => ({
        label: c.name,
        value: c.isoCode
    }));

    const stateOptions = countryIso
        ? State.getStatesOfCountry(countryIso).map(s => ({
            label: s.name,
            value: s.isoCode
        }))
        : [];

    const cityOptions = (countryIso && stateIso)
        ? City.getCitiesOfState(countryIso, stateIso).map(c => ({
            label: c.name,
            value: c.name
        }))
        : [];

    const parseAiSettings = (value: unknown) => {
        if (!value) return {};

        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        }

        if (typeof value === 'object') {
            return value as Record<string, any>;
        }

        return {};
    };

    useEffect(() => {
        if (organization && (mode === 'edit' || mode === 'view')) {
            let profileData = {};
            try {
                if (typeof organization.profile === 'string') {
                    profileData = JSON.parse(organization.profile);
                } else if (typeof organization.profile === 'object') {
                    profileData = organization.profile || {};
                }
            } catch (e) {
                console.error("Failed to parse profile JSON", e);
            }

            // Resolve stored country name → ISO code for driving dependent dropdowns
            const storedCountry = (organization as any).country || '';
            const storedState = (organization as any).state || '';

            // Try to find matching ISO code from stored value (could be ISO already or full name)
            const matchedCountry = Country.getAllCountries().find(
                c => c.isoCode.toUpperCase() === storedCountry.toUpperCase() ||
                    c.name.toLowerCase() === storedCountry.toLowerCase()
            );
            const resolvedCountryIso = matchedCountry?.isoCode || storedCountry;

            const matchedState = resolvedCountryIso
                ? State.getStatesOfCountry(resolvedCountryIso).find(
                    s => s.isoCode.toUpperCase() === (storedState || "").toUpperCase() ||
                        s.name.toLowerCase() === (storedState || "").toLowerCase()
                ) : undefined;
            const resolvedStateIso = matchedState?.isoCode || storedState;

            setCountryIso(resolvedCountryIso);
            setStateIso(resolvedStateIso);

            // Normalize all API field aliases into formData keys
            const org = organization as any;
            const aiSettings = parseAiSettings(org.ai_settings);
            const resolvedIndustryType: IndustryType =
                org.industry_type === 'healthcare' || org.industry_type === 'education'
                    ? org.industry_type
                    : 'general';
            setFormData({
                ...org,
                ...profileData,
                // Location fields — store ISO codes in form for dropdown driving
                country: resolvedCountryIso,
                state: resolvedStateIso,
                city: org.city || '',
                pincode: org.pincode || '',
                address: org.address || '',
                // Status — API may return 'status' or 'tenant_status'
                subscriptionStatus: (org.tenant_status || org.status || org.subscriptionStatus || 'active').toLowerCase(),
                // Plan — API returns 'subscription_plan', form uses 'subscriptionPlan'
                subscriptionPlan: (org.subscription_plan || org.subscriptionPlan || 'basic').toLowerCase(),
                // Users — API returns 'max_users', form uses 'maxUsers'
                maxUsers: Number(org.max_users ?? org.maxUsers ?? 10),
                industry_id: typeof org.industry_id === 'string' ? org.industry_id : '',
                plan_id: typeof org.plan_id === 'string' ? org.plan_id : '',
                // Phone
                owner_country_code: org.owner_country_code || '+91',
                owner_mobile: org.owner_mobile || '',
                industry_type: resolvedIndustryType,
                // AI Models - extract from ai_settings
                input_model: aiSettings?.input_model || 'gpt-4o-mini',
                output_model: aiSettings?.output_model || 'gpt-4o',
                gstin: aiSettings?.gstin || '',
                // Show a masked placeholder instead of the real key. Replaced with a
                // real value only if the admin types a new one (see isApiKeyDirty).
                openai_api_key: MASKED_API_KEY,
                appointment_booking_type:
                    aiSettings?.appointment_booking_type === 'ai_agent'
                        ? 'ai_agent'
                        : 'state_machine',
            });
        } else {
            setCountryIso('');
            setStateIso('');
            setFormData({
                company_name: '',
                owner_name: '',
                owner_email: '',
                owner_mobile: '',
                address: '',
                city: '',
                country: '',
                state: '',
                pincode: '',
                subscriptionStatus: 'invited',
                subscriptionPlan: 'basic',
                maxUsers: 10,
                adminName: '',
                adminEmail: '',
                isActive: true,
                industry_type: 'general',
                industry_id: '',
                plan_id: '',
                owner_country_code: '+91',
                password: '',
                input_model: 'gpt-4o-mini',
                output_model: 'gpt-4o',
                openai_api_key: '',
                gstin: '',
                appointment_booking_type: 'state_machine'
            });
        }
        setIsIndustryIdTouched(false);
        setIsPlanIdTouched(false);
        setIsApiKeyDirty(false);
        setErrors({});
    }, [organization, mode, isOpen]);

    useEffect(() => {
        if (mode !== 'create') return;
        if (isIndustryIdTouched) return;
        if (formData.industry_id) return;

        const selectedIndustryType = formData.industry_type || 'general';
        const matchedIndustry = industries.find((industry: any) => (
            industry?.industry_id === selectedIndustryType ||
            industry?.industry_key === selectedIndustryType
        ));

        if (matchedIndustry?.industry_id) {
            setFormData((prev) => ({ ...prev, industry_id: matchedIndustry.industry_id }));
        }
    }, [mode, isIndustryIdTouched, formData.industry_id, formData.industry_type, industries]);

    useEffect(() => {
        if (mode !== 'create') return;
        if (isPlanIdTouched) return;
        if (formData.plan_id) return;

        const defaultPlan = plans.find((plan: any) => plan?.plan_id === 'default_plan');
        if (defaultPlan?.plan_id) {
            setFormData((prev) => ({ ...prev, plan_id: defaultPlan.plan_id }));
        }
    }, [mode, isPlanIdTouched, formData.plan_id, plans]);

    const handleChange = (
        field: keyof Organization | 'input_model' | 'output_model' | 'openai_api_key' | 'gstin' | 'industry_type' | 'industry_id' | 'plan_id' | 'appointment_booking_type',
        value: any
    ) => {
        let sanitizedValue = value;

        if (field === 'owner_mobile') {
            sanitizedValue = sanitizePhoneInput(value, true);
        }

        if (field === 'gstin') {
            sanitizedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
        }

        const shouldResetAppointmentBookingType =
            (field === 'industry_type' && sanitizedValue !== 'healthcare') ||
            (field === 'industry_id' && !isHealthcareIndustryId(String(sanitizedValue || '')));

        setFormData(prev => ({
            ...prev,
            [field]: sanitizedValue,
            ...(
                shouldResetAppointmentBookingType
                    ? { appointment_booking_type: 'state_machine' as AppointmentBookingType }
                    : {}
            ),
        }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.company_name?.trim()) newErrors.company_name = "Organization name is required";
        if (!formData.owner_name?.trim()) newErrors.owner_name = "Owner name is required";

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.owner_email?.trim()) {
            newErrors.owner_email = "Email is required";
        } else if (!emailRegex.test(formData.owner_email)) {
            newErrors.owner_email = "Invalid email address";
        }

        // if (!formData.adminName?.trim()) newErrors.adminName = "Admin name is required";
        // if (!formData.adminEmail?.trim()) newErrors.adminEmail = "Admin email is required";
        // if (mode === 'create' && !formData.password?.trim()) newErrors.password = "Password is required";
        if (!formData.owner_country_code) newErrors.owner_country_code = "Country code is required";

        if (!formData.owner_mobile?.trim()) {
            newErrors.owner_mobile = "Mobile number is required";
        } else if (!/^\d{10}$/.test(formData.owner_mobile)) {
            newErrors.owner_mobile = "Mobile number must be 10 digits";
        }

        const trimmedApiKey = formData.openai_api_key?.trim();
        const apiKeyProvided = !!trimmedApiKey && trimmedApiKey !== MASKED_API_KEY;
        if (!apiKeyProvided) {
            if (mode === 'create') {
                newErrors.openai_api_key = "OpenAI API key is required";
            }
        } else if (!trimmedApiKey!.startsWith('sk-')) {
            newErrors.openai_api_key = "Invalid format. OpenAI keys start with 'sk-'";
        }

        if (formData.gstin?.trim() && !/^[0-9A-Z]{15}$/.test(formData.gstin.trim())) {
            newErrors.gstin = "GSTIN must be 15 uppercase letters or numbers";
        }

        if (!formData.input_model) {
            newErrors.input_model = "Input model is required";
        } else if (hasInvalidInputModel) {
            newErrors.input_model = "Selected input model is inactive. Please choose an active model.";
        }

        if (!formData.output_model) {
            newErrors.output_model = "Output model is required";
        } else if (hasInvalidOutputModel) {
            newErrors.output_model = "Selected output model is inactive. Please choose an active model.";
        }

        const selectedIndustryId = typeof formData.industry_id === 'string' ? formData.industry_id.trim() : '';
        const selectedPlanId = typeof formData.plan_id === 'string' ? formData.plan_id.trim() : '';

        if (
            selectedIndustryId &&
            !isIndustriesLoading &&
            !isIndustriesError &&
            !industries.some((industry: any) => industry?.industry_id === selectedIndustryId)
        ) {
            newErrors.industry_id = "Selected industry_id is invalid";
        }

        if (
            selectedPlanId &&
            !isPlansLoading &&
            !isPlansError &&
            !plans.some((plan: any) => plan?.plan_id === selectedPlanId)
        ) {
            newErrors.plan_id = "Selected plan_id is invalid";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        // Validate the OpenAI key with backend if a new key is provided.
        // The masked placeholder means "keep existing key" — never send it.
        const trimmedKey = formData.openai_api_key?.trim();
        const rawKey = trimmedKey && trimmedKey !== MASKED_API_KEY ? trimmedKey : '';
        if (rawKey) {
            try {
                await validateOpenAIKey({ openai_api_key: rawKey });
                // No toast here — the final create/update result will show the outcome
            } catch {
                // Error toast is handled by useValidateOpenAIKeyMutation's onError
                return;
            }
        } else if (mode === 'create') {
            setErrors(prev => ({ ...prev, openai_api_key: 'OpenAI API key is required' }));
            return;
        }

        // Resolve ISO codes to full names for storage
        const selectedCountry = Country.getAllCountries().find(c => c.isoCode === formData.country);
        const selectedState = countryIso
            ? State.getStatesOfCountry(countryIso).find(s => s.isoCode === formData.state)
            : undefined;

        const currentIndustryType = (formData.industry_type || 'general') as IndustryType;
        const {
            address,
            city,
            country,
            state,
            pincode,
            maxUsers,
            subscriptionPlan,
            industry_id,
            plan_id,
            profile,
            input_model,
            output_model,
            openai_api_key,
            gstin,
            industry_type,
            appointment_booking_type,
            ...rest
        } = formData;
        void openai_api_key;
        void industry_type;
        const normalizedGstin = gstin?.trim().toUpperCase() || '';

        const aiSettingsPayload: OrganizationAiSettingsPayload = {
            input_model: input_model || 'gpt-4o-mini',
            output_model: output_model || 'gpt-4o',
            gstin: normalizedGstin,
            appointment_booking_type: showAppointmentBookingType
                ? appointment_booking_type || 'state_machine'
                : 'state_machine',
        };
        // Only include key in payload if user entered a new one
        if (rawKey) {
            aiSettingsPayload.openai_api_key = rawKey;
        }

        const submitData = {
            ...rest,
            address,
            city,
            country: selectedCountry?.name || country,
            state: selectedState?.name || state,
            pincode,
            maxUsers,
            subscriptionPlan,
            industry_type: currentIndustryType,
            industry_id: typeof industry_id === 'string' && industry_id.trim() ? industry_id.trim() : null,
            plan_id: typeof plan_id === 'string' && plan_id.trim() ? plan_id.trim() : null,
            profile: profile ? JSON.stringify(profile) : null,
            subscription_start_date: (organization as any)?.subscription_start_date,
            subscription_end_date: (organization as any)?.subscription_end_date,
            ai_settings: aiSettingsPayload,
        };

        if (mode === 'create') {
            createTenantMutate(submitData, {
                onSuccess: () => {
                    onClose();
                }
            });
        } else if (mode === 'edit' && (organization?.id || organization?.tenant_id)) {
            updateTenantMutate({ tenantId: organization.tenant_id, data: submitData }, {
                onSuccess: () => {
                    onClose();
                }
            });
        }
    };

    const isView = mode === 'view';

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? "Add Organization" : mode === 'edit' ? "Edit Organization" : "Organization Details"}
            description={mode === 'create' ? "Register a new organization" : "View and manage organization details"}
            isDarkMode={isDarkMode}
            className={cn(
                "max-w-xl font-sans [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']",
                isDarkMode ? 'bg-black' : 'bg-white'
            )}
            footer={
                !isView && (
                    <div className="flex justify-end font-sans space-x-3 pt-4">
                        <button
                            onClick={onClose}
                            disabled={isCreateTenantPending || isUpdateTenantPending}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isCreateTenantPending || isUpdateTenantPending || isValidatingKey}
                            className={cn(
                                "px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {(isCreateTenantPending || isUpdateTenantPending || isValidatingKey) && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isValidatingKey
                                ? 'Validating API Key...'
                                : mode === 'create'
                                    ? (isCreateTenantPending ? 'Registering...' : 'Register Organization')
                                    : (isUpdateTenantPending ? 'Saving...' : 'Save Changes')}
                        </button>
                    </div>
                )
            }
        >
            <div className="space-y-6 font-sans">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {/* <div className="col-span-full">
                        <h3 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'} uppercase tracking-wider`}>
                            Organization Details
                        </h3>
                    </div> */}

                    <Input
                        autoComplete="new-password"
                        isDarkMode={isDarkMode}
                        label="Organization Name"
                        icon={Building2}
                        placeholder="e.g. City Eye Hospital"
                        value={formData.company_name}
                        onChange={(e) => handleChange('company_name', e.target.value)}
                        error={errors.company_name}
                        disabled={isView}
                        required
                    />
                    <Input
                        autoComplete="new-password"
                        isDarkMode={isDarkMode}
                        label="Organization Owner"
                        icon={Building2}
                        placeholder="e.g. Hospital"
                        value={formData.owner_name}
                        onChange={(e) => handleChange('owner_name', e.target.value)}
                        error={errors.owner_name}
                        disabled={isView}
                        required
                    />
                    <Input
                        autoComplete="new-password"
                        isDarkMode={isDarkMode}
                        label="Email Address"
                        icon={Mail}
                        placeholder="contact@hospital.com"
                        value={formData.owner_email}
                        onChange={(e) => handleChange('owner_email', e.target.value)}
                        error={errors.owner_email}
                        disabled={isView}
                        required
                    />
                    <div className="grid grid-cols-3 gap-4">
                        <Select
                            isDarkMode={isDarkMode}
                            label="Country Code"
                            value={formData.owner_country_code ? (formData.owner_country_code.toString().startsWith('+') ? formData.owner_country_code : `+${formData.owner_country_code}`) : '+91'}
                            onChange={(value) => handleChange('owner_country_code', value)}
                            options={[
                                { value: '+91', label: 'India (+91)' },
                                { value: '+1', label: 'USA (+1)' },
                                { value: '+44', label: 'UK (+44)' },
                                { value: '+971', label: 'UAE (+971)' },
                                { value: '+61', label: 'Australia (+61)' },
                                { value: '+65', label: 'Singapore (+65)' },
                                { value: '+60', label: 'Malaysia (+60)' },
                                { value: '+966', label: 'Saudi Arabia (+966)' },
                                { value: '+974', label: 'Qatar (+974)' },
                                { value: '+49', label: 'Germany (+49)' },
                                { value: '+33', label: 'France (+33)' },
                                { value: '+81', label: 'Japan (+81)' },
                                { value: '+82', label: 'S. Korea (+82)' },
                                { value: '+55', label: 'Brazil (+55)' },
                                { value: '+27', label: 'South Africa (+27)' },
                            ]}
                            disabled={isView}
                            className="col-span-1"
                            error={errors.owner_country_code}
                            required
                        />
                        <Input
                            isDarkMode={isDarkMode}
                            label="Mobile Number"
                            icon={Phone}
                            placeholder="9876543210"
                            value={formData.owner_mobile}
                            wrapperClassName="col-span-2"
                            onChange={(e) => handleChange('owner_mobile', e.target.value)}
                            disabled={isView}
                            error={errors.owner_mobile}
                            required
                            maxLength={10}
                            hasSeparateCountryCode
                        />
                    </div>
                    <Select
                        isDarkMode={isDarkMode}
                        label="Industry Type"
                        value={(formData.industry_type || 'general') as string}
                        onChange={(value) => handleChange('industry_type', value as IndustryType)}
                        options={[
                            { value: 'general', label: 'General' },
                            { value: 'healthcare', label: 'Healthcare' },
                            { value: 'education', label: 'Education' },
                        ]}
                        disabled={isView}
                        required
                    />

                    <Select
                        isDarkMode={isDarkMode}
                        label="Dynamic Industry"
                        value={formData.industry_id || ''}
                        onChange={(value) => {
                            setIsIndustryIdTouched(true);
                            handleChange('industry_id', value);
                        }}
                        options={industryOptions}
                        disabled={isView}
                        error={errors.industry_id}
                    />

                    {showAppointmentBookingType && (
                        <div>
                            <Select
                                isDarkMode={isDarkMode}
                                label="Appointment booking type"
                                value={formData.appointment_booking_type || 'state_machine'}
                                onChange={(value) => handleChange('appointment_booking_type', value as AppointmentBookingType)}
                                options={appointmentBookingTypeOptions}
                                disabled={isView}
                            />
                            <p className={cn("mt-2 text-xs", isDarkMode ? 'text-white/50' : 'text-slate-500')}>
                                {formData.appointment_booking_type === 'ai_agent'
                                    ? 'AI collects appointment request details only; it does not create or confirm appointments.'
                                    : 'State machine creates real appointments using configured doctors and available slots.'}
                            </p>
                        </div>
                    )}

                    {/* {mode === 'create' && (
                        <Input
                            autoComplete="new-password"
                            isDarkMode={isDarkMode}
                            label="Password"
                            icon={Lock}
                            type="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => handleChange('password', e.target.value)}
                            error={errors.password}
                            required
                        />
                    )} */}

                    <Select
                        isDarkMode={isDarkMode}
                        label="Subscription Plan"
                        value={formData.subscriptionPlan || 'basic'}
                        onChange={(value) => handleChange('subscriptionPlan', value)}
                        options={[
                            { value: 'basic', label: 'Basic Plan' },
                            { value: 'pro', label: 'Pro Plan' },
                            { value: 'enterprise', label: 'Enterprise Plan' }
                        ]}
                        disabled={isView}
                        required
                    />

                    <Select
                        isDarkMode={isDarkMode}
                        label="Dynamic Plan"
                        value={formData.plan_id || ''}
                        onChange={(value) => {
                            setIsPlanIdTouched(true);
                            handleChange('plan_id', value);
                        }}
                        options={planOptions}
                        disabled={isView}
                        error={errors.plan_id}
                    />

                    <div className="col-span-full">
                        <Input
                            isDarkMode={isDarkMode}
                            label="Address"
                            icon={MapPin}
                            placeholder="Full address of the organization"
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            disabled={isView}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                        <Select
                            isDarkMode={isDarkMode}
                            label="Country"
                            value={formData.country || ''}
                            onChange={(value) => {
                                setCountryIso(value);
                                setStateIso('');
                                handleChange('country', value);
                                handleChange('state', '');
                                handleChange('city', '');
                            }}
                            options={countryOptions}
                            disabled={isView}
                        />

                        <Select
                            isDarkMode={isDarkMode}
                            label="State / Province"
                            value={formData.state || ''}
                            onChange={(value) => {
                                setStateIso(value);
                                handleChange('state', value);
                                handleChange('city', '');
                            }}
                            options={stateOptions}
                            disabled={isView || !countryIso || stateOptions.length === 0}
                        />

                        <Select
                            isDarkMode={isDarkMode}
                            label="City / Town"
                            value={formData.city || ''}
                            onChange={(value) => handleChange('city', value)}
                            options={cityOptions}
                            disabled={isView || !stateIso || cityOptions.length === 0}
                        />

                        <Input
                            isDarkMode={isDarkMode}
                            label="Pincode / Zip Code"
                            icon={MapPin}
                            placeholder="e.g. 00000"
                            value={formData.pincode}
                            onChange={(e) => handleChange('pincode', e.target.value)}
                            disabled={isView}
                        />

                        <Input
                            isDarkMode={isDarkMode}
                            label="GSTIN"
                            icon={ShieldCheck}
                            placeholder="22AAAAA0000A1Z5"
                            value={formData.gstin || ''}
                            onChange={(e) => handleChange('gstin', e.target.value)}
                            disabled={isView}
                            error={errors.gstin}
                            maxLength={15}
                        />
                    </div>

                    <p className={cn("text-[10px] ml-1", isDarkMode ? 'text-white/40' : 'text-slate-500')}>
                        State is used to decide whether recharges apply CGST/SGST or IGST. Add GSTIN if the organization is registered.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    <div className="col-span-full">
                        <h3 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'} uppercase tracking-wider`}>
                            Management Details
                        </h3>
                    </div>

                    <Input
                        isDarkMode={isDarkMode}
                        label="Max Users Allowed"
                        icon={Users}
                        type="number"
                        placeholder="e.g. 10"
                        value={formData.maxUsers}
                        onChange={(e) => handleChange('maxUsers', parseInt(e.target.value))}
                        disabled={isView}
                        required
                    />

                    <Select
                        isDarkMode={isDarkMode}
                        label="Status"
                        value={formData.subscriptionStatus}
                        onChange={(value) => handleChange('subscriptionStatus', value)}
                        options={[
                            { value: 'active', label: 'Active' },
                            { value: 'trial', label: 'Trial' },
                            { value: 'invited', label: 'Invited' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'expired', label: 'Expired' },
                            { value: 'suspended', label: 'Suspended' },
                            { value: 'pending_setup', label: 'Pending Setup' },
                            { value: 'grace_period', label: 'Grace Period' },
                            { value: 'maintenance', label: 'Maintenance' },
                        ]}
                        disabled={isView}
                        required
                    />
                </div>

                {/* AI Model Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    <div className="col-span-full">
                        <h3 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-white/40' : 'text-slate-400'} uppercase tracking-wider flex items-center gap-2`}>
                            <Cpu className="w-4 h-4" />
                            AI Model Settings
                        </h3>
                    </div>

                    <div>
                        <Select
                            isDarkMode={isDarkMode}
                            label="Input Model (Classification/Extraction)"
                            value={formData.input_model || 'gpt-4o-mini'}
                            onChange={(value) => handleChange('input_model', value)}
                            options={inputModelInfo.options}
                            disabled={isView || inputModelInfo.loading}
                            error={errors.input_model}
                        />
                        {inputModelInfo.loading && <p className={cn("text-[10px] ml-1 mt-1", isDarkMode ? 'text-white/40' : 'text-slate-400')}>Loading available models…</p>}
                        {inputModelInfo.error && <p className="text-[10px] ml-1 mt-1 text-red-500">Could not load available models.</p>}
                        {inputModelInfo.savedUnavailable && <p className="text-[10px] ml-1 mt-1 text-amber-500">The selected input model is unavailable. Choose a replacement.</p>}
                    </div>

                    <div>
                        <Select
                            isDarkMode={isDarkMode}
                            label="Output Model (Generation/Responses)"
                            value={formData.output_model || 'gpt-4o'}
                            onChange={(value) => handleChange('output_model', value)}
                            options={outputModelInfo.options}
                            disabled={isView || outputModelInfo.loading}
                            error={errors.output_model}
                        />
                        {outputModelInfo.loading && <p className={cn("text-[10px] ml-1 mt-1", isDarkMode ? 'text-white/40' : 'text-slate-400')}>Loading available models…</p>}
                        {outputModelInfo.error && <p className="text-[10px] ml-1 mt-1 text-red-500">Could not load available models.</p>}
                        {outputModelInfo.savedUnavailable && <p className="text-[10px] ml-1 mt-1 text-amber-500">The selected output model is unavailable. Choose a replacement.</p>}
                    </div>

                    {mode === 'create' && !inputModelInfo.loading && !inputModelInfo.error && !outputModelInfo.error && inputModelInfo.options.length === 0 && outputModelInfo.options.length === 0 && (
                        <p className={cn("text-[10px] ml-1 col-span-full", isDarkMode ? 'text-amber-300' : 'text-amber-700')}>
                            No active AI models are configured. Activate at least one model in the Model Catalog before creating an organization.
                        </p>
                    )}
                    <div className="col-span-full">
                        <Input
                            autoComplete="off"
                            isDarkMode={isDarkMode}
                            label="OpenAI API Key"
                            icon={Key}
                            placeholder={mode === 'create' ? 'sk-...' : 'Type a new key to replace the current one'}
                            value={formData.openai_api_key}
                            onFocus={() => {
                                if (
                                    mode !== 'create' &&
                                    !isApiKeyDirty &&
                                    formData.openai_api_key === MASKED_API_KEY
                                ) {
                                    handleChange('openai_api_key', '');
                                }
                            }}
                            onChange={(e) => {
                                if (mode !== 'create') setIsApiKeyDirty(true);
                                handleChange('openai_api_key', e.target.value.trim());
                            }}
                            onBlur={() => {
                                if (mode !== 'create' && !formData.openai_api_key?.trim()) {
                                    setIsApiKeyDirty(false);
                                    handleChange('openai_api_key', MASKED_API_KEY);
                                }
                            }}
                            error={errors.openai_api_key}
                            disabled={isView}
                            required={mode === 'create'}
                        />
                        <p className={cn("text-[10px] mt-1 ml-1", isDarkMode ? 'text-white/40' : 'text-slate-500')}>
                            {mode === 'create'
                                ? 'Required. Key will be validated with OpenAI and stored encrypted.'
                                : 'The current key is hidden. Type a new key to replace it, or leave the masked value to keep it unchanged.'}
                        </p>
                    </div>
                </div>

                {mode !== 'create' && organization?.tenant_id && (
                    <WhatsappCapabilitiesSection tenantId={organization.tenant_id} isDarkMode={isDarkMode} />
                )}
            </div>
        </Drawer>
    );
};
