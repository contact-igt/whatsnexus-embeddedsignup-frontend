import { billingApiData, BillingLedgerParams } from "@/services/billing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/redux/selectors/auth/authSelector";
import { useSelector } from "react-redux";

const billingApis = new billingApiData();

export const useGetBillingKpiQuery = (startDate?: string, endDate?: string) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-kpi', tenantId, startDate, endDate],
        queryFn: () => billingApis.getBillingKpi(startDate, endDate),
        enabled: !!token && !isManagement,
    });
};

export const useGetBillingLedgerQuery = (params?: BillingLedgerParams & { startDate?: string; endDate?: string }) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-ledger', tenantId, params],
        queryFn: () => billingApis.getBillingLedger(params),
        enabled: !!token && !isManagement,
        placeholderData: (previousData) => previousData // Keeps old data on screen while paginating
    });
};

export const useGetBillingSpendChartQuery = (startDate?: string, endDate?: string) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-spend-chart', tenantId, startDate, endDate],
        queryFn: () => billingApis.getBillingSpendChart(startDate, endDate),
        enabled: !!token && !isManagement,
    });
};

export const useGetGstBreakdownQuery = () => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['gst-breakdown', tenantId],
        queryFn: () => billingApis.getGstBreakdown(),
        enabled: !!token && !isManagement,
        staleTime: 5 * 60 * 1000,
    });
};

export const useGetWalletBalanceQuery = () => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['wallet-balance', tenantId],
        queryFn: () => billingApis.getWalletBalance(),
        enabled: !!token && !isManagement,
    });
};

export const useGetWalletTransactionsQuery = (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) => {
    const tenantId = useSelector((state: any) => state.auth?.user?.tenant_id);
    return useQuery({
        queryKey: ['wallet-transactions', tenantId, params],
        queryFn: () => billingApis.getWalletTransactions(params)
    });
};

export const useCreatePaymentOrderMutation = () => {
    return useMutation({
        mutationFn: (amount: number) => billingApis.createPaymentOrder(amount)
    });
};

export const useVerifyPaymentMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (paymentData: any) => billingApis.verifyPayment(paymentData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-status'] });
            queryClient.invalidateQueries({ queryKey: ['billing-kpi'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['payment-history'] });
            queryClient.invalidateQueries({ queryKey: ['gst-breakdown'] });
        }
    });
};

export const useGetPaymentHistoryQuery = (params?: { page?: number; limit?: number }) => {
    const tenantId = useSelector((state: any) => state.auth?.user?.tenant_id);
    return useQuery({
        queryKey: ['payment-history', tenantId, params],
        queryFn: () => billingApis.getPaymentHistory(params)
    });
};

export const useGetPricingTableQuery = () => {
    return useQuery({
        queryKey: ['pricing-table'],
        queryFn: () => billingApis.getPricingTable()
    });
};

export const useUpdatePricingMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updateData }: { id: number; updateData: any }) => billingApis.updatePricing(id, updateData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-table'] });
        }
    });
};

export const useGetBillingTemplateStatsQuery = (startDate?: string, endDate?: string) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-template-stats', tenantId, startDate, endDate],
        queryFn: () => billingApis.getBillingTemplateStats(startDate, endDate),
        enabled: !!token && !isManagement,
    });
};

export const useGetBillingCampaignStatsQuery = (startDate?: string, endDate?: string) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-campaign-stats', tenantId, startDate, endDate],
        queryFn: () => billingApis.getBillingCampaignStats(startDate, endDate),
        enabled: !!token && !isManagement,
    });
};

export const useGetAiTokenUsageQuery = (startDate?: string, endDate?: string) => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['ai-token-usage', tenantId, startDate, endDate],
        queryFn: () => billingApis.getAiTokenUsage(startDate, endDate),
        enabled: !!token && !isManagement,
    });
};

export const useGetAutoRechargeSettingsQuery = () => {
    const tenantId = useSelector((state: any) => state.auth?.user?.tenant_id);
    return useQuery({
        queryKey: ['auto-recharge-settings', tenantId],
        queryFn: () => billingApis.getAutoRechargeSettings()
    });
};

export const useUpdateAutoRechargeSettingsMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: { enabled?: boolean; threshold?: number; amount?: number }) =>
            billingApis.updateAutoRechargeSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auto-recharge-settings'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        }
    });
};

/**
 * Tenant-scoped, purpose-specific available AI models.
 * Query key includes tenantId + purpose so Tenant A's list is never served to
 * Tenant B and the input/output/vision lists stay separate. A management caller
 * may pass an explicit tenantId or request the platform-scoped list (server-checked).
 */
export const useGetAvailableAiModelsQuery = (
    opts: { purpose?: 'input' | 'output' | 'vision'; tenantId?: string; enabled?: boolean } = {},
) => {
    const { user, token } = useAuth();
    const purpose = opts.purpose ?? 'output';
    const isManagement = user?.user_type === 'management';
    const effectiveTenantId = opts.tenantId ?? (isManagement ? undefined : user?.tenant_id);
    return useQuery({
        queryKey: ['available-ai-models', effectiveTenantId ?? 'self', purpose],
        queryFn: () => billingApis.getAvailableAiModels({ purpose, tenantId: opts.tenantId }),
        enabled: (opts.enabled ?? true) && !!token && (isManagement || !!user?.tenant_id),
        staleTime: 60 * 1000,
    });
};

export const useGetWalletStatusQuery = () => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['wallet-status', tenantId],
        queryFn: () => billingApis.getWalletStatus(),
        refetchInterval: 60000,
        enabled: !!token && !isManagement,
    });
};

export const useGetBillingModeQuery = () => {
    const { user, token } = useAuth();
    const isManagement = user?.user_type === 'management';
    const tenantId = user?.tenant_id;
    return useQuery({
        queryKey: ['billing-mode', tenantId],
        queryFn: () => billingApis.getBillingMode(),
        staleTime: 5 * 60 * 1000,
        enabled: !!token && !isManagement,
    });
};

export const useGetInvoicesQuery = (params?: { status?: string; page?: number; limit?: number }) => {
    const tenantId = useSelector((state: any) => state.auth?.user?.tenant_id);
    return useQuery({
        queryKey: ['invoices', tenantId, params],
        queryFn: () => billingApis.getInvoices(params),
        placeholderData: (previousData: unknown) => previousData,
    });
};

export const useGetInvoiceDetailQuery = (id: number) => {
    const tenantId = useSelector((state: any) => state.auth?.user?.tenant_id);
    return useQuery({
        queryKey: ['invoice-detail', tenantId, id],
        queryFn: () => billingApis.getInvoiceDetail(id),
        enabled: !!id,
    });
};

export const usePayInvoiceMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, paymentData }: { id: number; paymentData: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } }) =>
            billingApis.payInvoice(id, paymentData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['billing-mode'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
            queryClient.invalidateQueries({ queryKey: ['wallet-status'] });
        },
    });
};

// ──────────────── Super Admin Hooks ────────────────

export const useAdminForceUnlockMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { tenant_id: string; reason: string }) =>
            billingApis.adminForceUnlock(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
        },
    });
};

export const useAdminManualCreditMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { tenant_id: string; amount: number; reason: string }) =>
            billingApis.adminManualCredit(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
        },
    });
};

export const useAdminInvoiceCloseMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { invoice_id: number; reason: string }) =>
            billingApis.adminInvoiceClose(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
        },
    });
};

export const useAdminChangeBillingModeMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { tenant_id: string; new_mode: 'prepaid' | 'postpaid'; reason: string }) =>
            billingApis.adminChangeBillingMode(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-mode'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
            queryClient.invalidateQueries({ queryKey: ['admin-tenant-overview'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });
};

export const useAdminUpdateUsageLimitsMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { tenant_id: string; max_daily_messages?: number; max_monthly_messages?: number; max_daily_ai_calls?: number; max_monthly_ai_calls?: number; reason?: string }) =>
            billingApis.adminUpdateUsageLimits(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['billing-mode'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
            queryClient.invalidateQueries({ queryKey: ['admin-tenant-overview'] });
        },
    });
};

export const useAdminGetAuditLogQuery = (params?: { tenant_id?: string; page?: number; limit?: number }) => {
    return useQuery({
        queryKey: ['admin-audit-log', params],
        queryFn: () => billingApis.adminGetAuditLog(params),
        placeholderData: (previousData: unknown) => previousData,
    });
};

export const useAdminGetHealthSummaryQuery = () => {
    return useQuery({
        queryKey: ['admin-health-summary'],
        queryFn: () => billingApis.adminGetHealthSummary(),
        refetchInterval: 60000,
    });
};

export const useAdminGetTenantsQuery = (search?: string, enabled = true) => {
    return useQuery({
        queryKey: ['admin-tenants', search],
        queryFn: () => billingApis.adminGetTenants({ search }),
        enabled,
    });
};

export const useAdminGetTenantOverviewQuery = (tenant_id?: string) => {
    return useQuery({
        queryKey: ['admin-tenant-overview', tenant_id],
        queryFn: () => billingApis.adminGetTenantOverview(tenant_id!),
        enabled: !!tenant_id,
    });
};

export const useAdminResolveHealthEventMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => billingApis.adminResolveHealthEvent(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-health-summary'] });
            queryClient.invalidateQueries({ queryKey: ['admin-unresolved-events'] });
        },
    });
};

export const useAdminGetUnresolvedEventsQuery = () => {
    return useQuery({
        queryKey: ['admin-unresolved-events'],
        queryFn: () => billingApis.adminGetUnresolvedEvents(),
        refetchInterval: 60000,
    });
};

// ──────────────── GST Rate Management Hooks ────────────────

export const useAdminGetActiveGSTRateQuery = () => {
    return useQuery({
        queryKey: ['admin-gst-active'],
        queryFn: () => billingApis.adminGetActiveGSTRate(),
        staleTime: 60 * 1000,
    });
};

export const useAdminListGSTRatesQuery = (params?: { page?: number; limit?: number }) => {
    return useQuery({
        queryKey: ['admin-gst-list', params],
        queryFn: () => billingApis.adminListGSTRates(params),
        placeholderData: (prev: unknown) => prev,
    });
};

export const useAdminAddGSTRateMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { gst_rate: number; effective_from: string; notes?: string }) =>
            billingApis.adminAddGSTRate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-gst-list'] });
        },
    });
};

export const useAdminActivateGSTRateMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { id: number; force?: boolean }) =>
            billingApis.adminActivateGSTRate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-gst-active'] });
            queryClient.invalidateQueries({ queryKey: ['admin-gst-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
            queryClient.invalidateQueries({ queryKey: ['gst-breakdown'] });
        },
    });
};

export const useAdminDeactivateGSTRateMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { id: number }) =>
            billingApis.adminDeactivateGSTRate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-gst-active'] });
            queryClient.invalidateQueries({ queryKey: ['admin-gst-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
            queryClient.invalidateQueries({ queryKey: ['gst-breakdown'] });
        },
    });
};

export const useAdminUpdateGSTRateMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: { gst_rate?: number; effective_from?: string; notes?: string } }) =>
            billingApis.adminUpdateGSTRate(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-gst-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
        },
    });
};

export const useAdminDeleteGSTRateMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) =>
            billingApis.adminDeleteGSTRate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-gst-active'] });
            queryClient.invalidateQueries({ queryKey: ['admin-gst-list'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
            queryClient.invalidateQueries({ queryKey: ['gst-breakdown'] });
        },
    });
};
