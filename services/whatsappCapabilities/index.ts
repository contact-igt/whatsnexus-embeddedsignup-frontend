import { _axios } from "@/helper/axios";

export interface WhatsappCapabilities {
    embedded_signup_enabled: boolean;
    coexistence_enabled: boolean;
}

export class WhatsappCapabilitiesApiData {
    getCapabilities = async (tenantId: string) => {
        return await _axios("get", `/management/tenant/${tenantId}/whatsapp-capabilities`);
    };

    updateCapabilities = async (tenantId: string, data: Partial<WhatsappCapabilities>) => {
        return await _axios("patch", `/management/tenant/${tenantId}/whatsapp-capabilities`, data);
    };
}
