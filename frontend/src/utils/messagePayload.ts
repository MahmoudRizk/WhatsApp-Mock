import {
  FlowScreenData,
  InteractivePayload,
  LastFlowSend,
  LocationPayload,
  Message,
  SharedContact
} from '../types';

const DEFAULT_FULFILLMENT_OPTIONS = [
  { id: 'delivery', title: 'Delivery' },
  { id: 'pickup', title: 'Pickup' }
] as const;

export const getFlowScreenDataFromInteractive = (
  interactive: InteractivePayload | null | undefined
): FlowScreenData | null => {
  const data = interactive?.action?.parameters?.flow_action_payload?.data;
  if (!data || typeof data !== 'object') return null;
  return data as FlowScreenData;
};

export const getFlowScreenData = (message: Message): FlowScreenData | null =>
  getFlowScreenDataFromInteractive(getInteractivePayload(message));

export const getFulfillmentOptions = (screenData: FlowScreenData | null | undefined) => {
  const methods = screenData?.fulfillment_methods?.filter(o => o?.id && o?.title);
  if (methods?.length) return methods;
  return [...DEFAULT_FULFILLMENT_OPTIONS];
};

export const getPaymentOptions = (
  screenData: FlowScreenData | null | undefined,
  fulfillment: string
) => {
  const list =
    fulfillment === 'pickup' ? screenData?.payments_pickup : screenData?.payments_delivery;
  return list?.filter(o => o?.id && o?.title) ?? [];
};

export const parseMessagePayload = <T>(message: Message): T | null => {
  if (!message.payloadJson) return null;
  try {
    return JSON.parse(message.payloadJson) as T;
  } catch {
    return null;
  }
};

export const getLocationPayload = (message: Message): LocationPayload | null =>
  parseMessagePayload<LocationPayload>(message);

export const getInteractivePayload = (message: Message): InteractivePayload | null =>
  parseMessagePayload<InteractivePayload>(message);

export const getSharedContacts = (message: Message): SharedContact[] => {
  const parsed = parseMessagePayload<SharedContact[] | SharedContact>(message);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
};

export const getLastFlowSend = (chatLastFlowSendJson?: string | null): LastFlowSend | null => {
  if (!chatLastFlowSendJson) return null;
  try {
    const parsed = JSON.parse(chatLastFlowSendJson) as LastFlowSend;
    if (!parsed?.flow_token) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getFlowSendFromMessage = (message: Message, fallback?: LastFlowSend | null): LastFlowSend | null => {
  const interactive = getInteractivePayload(message);
  const token = interactive?.action?.parameters?.flow_token || fallback?.flow_token;
  if (!token) return null;
  const screenData = getFlowScreenDataFromInteractive(interactive) ?? fallback?.screen_data ?? null;
  return {
    flow_id: interactive?.action?.parameters?.flow_id || fallback?.flow_id || '',
    flow_token: token,
    wamid: message.wamid || fallback?.wamid || '',
    screen_data: screenData
  };
};

export const DEFAULT_FLOW_CTA = 'Complete details';
