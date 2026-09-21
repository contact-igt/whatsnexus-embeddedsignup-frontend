import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { readApiError } from "@/lib/metaEmbeddedSignup";
import { WhatsappCapabilities, WhatsappCapabilitiesApiData } from "@/services/whatsappCapabilities";

const api = new WhatsappCapabilitiesApiData();

export const useGetWhatsappCapabilitiesQuery = (tenantId?: string) =>
    useQuery({
        queryKey: ["whatsapp-capabilities", tenantId],
        enabled: !!tenantId,
        queryFn: () => api.getCapabilities(tenantId as string),
        retry: false,
        // _axios resolves the response body: { message, data }
        select: (res): WhatsappCapabilities | null => res?.data ?? null,
    });

export const useUpdateWhatsappCapabilitiesMutation = (tenantId?: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<WhatsappCapabilities>) => api.updateCapabilities(tenantId as string, data),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-capabilities", tenantId] });
            toast.success(response?.message || "WhatsApp capabilities updated");
        },
        onError: (error: unknown) => {
            toast.error(readApiError(error).message || "Failed to update WhatsApp capabilities");
        },
    });
};
