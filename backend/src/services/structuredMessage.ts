export type LocationPayload = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export type InteractiveType = 'location_request_message' | 'request_contact_info' | 'flow';

export type FlowActionParameters = {
  flow_message_version?: string;
  flow_id?: string;
  flow_token?: string;
  flow_cta?: string;
  flow_action?: string;
  [key: string]: unknown;
};

export type InteractivePayload = {
  type: string;
  header?: { type?: string; text?: string };
  body?: { text?: string };
  footer?: { text?: string };
  action?: { name?: string; parameters?: FlowActionParameters };
  nfm_reply?: {
    name?: string;
    body?: string;
    response_json?: string;
  };
};

export type FlowScreenData = {
  channel_name?: string;
  customer_name?: string;
  heading?: string;
  label_name?: string;
  label_fulfillment?: string;
  cta_continue?: string;
  fulfillment_methods?: { id: string; title: string }[];
  pickup_stores?: { id: string; title: string }[];
  payments_delivery?: { id: string; title: string }[];
  payments_pickup?: { id: string; title: string }[];
};

export type LastFlowSend = {
  flow_id: string;
  flow_token: string;
  wamid: string;
  screen_data?: FlowScreenData | null;
};

const extractFlowScreenData = (payload: InteractivePayload): FlowScreenData | null => {
  const data = payload.action?.parameters?.flow_action_payload;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const screen = data as { data?: unknown };
  if (!screen.data || typeof screen.data !== 'object' || Array.isArray(screen.data)) return null;
  return screen.data as FlowScreenData;
};

export const NFM_REPLY_KEYS = [
  'flow_token',
  'customer_name',
  'fulfillment',
  'payment_option_code',
  'area',
  'street',
  'building_number',
  'floor_number',
  'apartment_number',
  'landmark',
  'store_id'
] as const;

export type NfmReplyFieldKey = typeof NFM_REPLY_KEYS[number];
export type NfmReplyFields = Record<NfmReplyFieldKey, string>;

export type ContactShare = {
  origin?: 'contact_request' | 'other';
  name?: { formatted_name?: string; first_name?: string };
  phones?: { phone: string; wa_id?: string; type?: string }[];
};

const INTERACTIVE_DEFAULT_ACTION: Record<Exclude<InteractiveType, 'flow'>, string> = {
  location_request_message: 'send_location',
  request_contact_info: 'request_contact_info'
};

const DEFAULT_FLOW_CTA = 'Complete details';

export const isLocationPayload = (value: LocationPayload | { error: string }): value is LocationPayload =>
  !('error' in value);

export const parseLocationPayload = (location: any): LocationPayload | { error: string } => {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'location.latitude and location.longitude are required' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'location coordinates are out of range' };
  }
  const payload: LocationPayload = { latitude: lat, longitude: lng };
  if (location.name) payload.name = String(location.name);
  if (location.address) payload.address = String(location.address);
  return payload;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const parseFlowPayload = (interactive: any): { payload: InteractivePayload; bodyText: string } | { error: string } => {
  const params = interactive?.action?.parameters;
  const flowId = params?.flow_id;
  const flowToken = params?.flow_token;
  if (!flowId || typeof flowId !== 'string') {
    return { error: 'interactive.action.parameters.flow_id is required' };
  }
  if (!flowToken || typeof flowToken !== 'string') {
    return { error: 'interactive.action.parameters.flow_token is required' };
  }

  const bodyText = interactive?.body?.text;
  if (bodyText != null && typeof bodyText === 'string' && bodyText.length > 1024) {
    return { error: 'interactive.body.text exceeds 1024 characters' };
  }

  const payload = cloneJson(interactive) as InteractivePayload;
  payload.type = 'flow';
  payload.action = payload.action || { name: 'flow' };
  payload.action.name = payload.action.name || 'flow';
  payload.action.parameters = payload.action.parameters || {};
  if (!payload.action.parameters.flow_cta) {
    payload.action.parameters.flow_cta = DEFAULT_FLOW_CTA;
  }

  const preview =
    (typeof bodyText === 'string' && bodyText) ||
    payload.header?.text ||
    payload.action.parameters.flow_cta ||
    'Flow';

  return { payload, bodyText: preview };
};

export const parseInteractivePayload = (interactive: any): { payload: InteractivePayload; bodyText: string } | { error: string } => {
  const type = interactive?.type as InteractiveType;
  if (type === 'flow') {
    return parseFlowPayload(interactive);
  }
  if (type !== 'location_request_message' && type !== 'request_contact_info') {
    return { error: `Unsupported interactive type: ${interactive?.type || 'unknown'}` };
  }
  const text = interactive?.body?.text;
  if (!text || typeof text !== 'string') {
    return { error: 'interactive.body.text is required' };
  }
  if (text.length > 1024) {
    return { error: 'interactive.body.text exceeds 1024 characters' };
  }
  return {
    payload: {
      type,
      body: { text },
      action: { name: interactive?.action?.name || INTERACTIVE_DEFAULT_ACTION[type] }
    },
    bodyText: text
  };
};

export const extractLastFlowSend = (
  type: string,
  payloadJson: string | undefined,
  wamid: string
): LastFlowSend | null => {
  if (type !== 'interactive' || !payloadJson) return null;
  try {
    const payload = JSON.parse(payloadJson) as InteractivePayload;
    if (payload?.type !== 'flow') return null;
    const flowId = payload.action?.parameters?.flow_id;
    const flowToken = payload.action?.parameters?.flow_token;
    if (!flowId || !flowToken) return null;
    const screenData = extractFlowScreenData(payload);
    return {
      flow_id: flowId,
      flow_token: flowToken,
      wamid,
      ...(screenData && { screen_data: screenData })
    };
  } catch {
    return null;
  }
};

export const parseLastFlowSend = (value: string | null | undefined): LastFlowSend | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as LastFlowSend;
    if (!parsed?.flow_token || !parsed?.wamid) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const extractFlowTokenFromMessagePayload = (payloadJson: string | null | undefined): LastFlowSend | null => {
  if (!payloadJson) return null;
  try {
    const payload = JSON.parse(payloadJson) as InteractivePayload;
    const flowId = payload?.action?.parameters?.flow_id;
    const flowToken = payload?.action?.parameters?.flow_token;
    if (!flowToken) return null;
    return { flow_id: flowId || '', flow_token: flowToken, wamid: '' };
  } catch {
    return null;
  }
};

export const buildNfmReplyFields = (
  flowToken: string,
  input: Partial<Record<string, unknown>> = {}
): NfmReplyFields => {
  const fulfillment = String(input.fulfillment || '') === 'pickup' ? 'pickup' : 'delivery';
  const str = (key: string) => {
    const value = input[key];
    return value == null ? '' : String(value);
  };

  const fields: NfmReplyFields = {
    flow_token: flowToken,
    customer_name: str('customer_name'),
    fulfillment,
    payment_option_code: str('payment_option_code'),
    area: '',
    street: '',
    building_number: '',
    floor_number: '',
    apartment_number: '',
    landmark: '',
    store_id: ''
  };

  if (fulfillment === 'delivery') {
    fields.area = str('area');
    fields.street = str('street');
    fields.building_number = str('building_number');
    fields.floor_number = str('floor_number');
    fields.apartment_number = str('apartment_number');
    fields.landmark = str('landmark');
  } else {
    fields.store_id = str('store_id');
  }

  return fields;
};

export const buildNfmReplyInteractive = (fields: NfmReplyFields): InteractivePayload => ({
  type: 'nfm_reply',
  nfm_reply: {
    name: 'flow',
    body: 'Sent',
    response_json: JSON.stringify(fields)
  }
});

const isPhoneIdentity = (value: string): boolean => {
  const trimmed = (value || '').trim();
  if (!trimmed || /[A-Za-z]/.test(trimmed)) return false;
  return trimmed.replace(/\D/g, '').length >= 8;
};

/** The number Meta would return on a contact-info tap.

A username-adopter chat is identified by a BSUID, not a mobile. Sharing that
handle as ``phones[].wa_id`` is rejected by ordr (no digits). When the identity
is not a phone, mint a stable Egyptian test mobile so the Share button works.
*/
export const resolveSharePhone = (identity: string, override?: string): string => {
  const chosen = (override || '').trim();
  if (chosen && isPhoneIdentity(chosen)) {
    const digits = chosen.replace(/\D/g, '');
    return chosen.startsWith('+') ? chosen : digits;
  }
  if (isPhoneIdentity(identity)) {
    const digits = identity.replace(/\D/g, '');
    return identity.trim().startsWith('+') ? identity.trim() : digits;
  }
  let hash = 0;
  for (const ch of identity || 'mock') {
    hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  }
  return `2010${String(hash % 100000000).padStart(8, '0')}`;
};

export const buildContactShare = (name: string, phoneNumber: string, origin: 'contact_request' | 'other' = 'contact_request', overridePhone?: string): ContactShare[] => {
  const sharePhone = resolveSharePhone(phoneNumber, overridePhone);
  const digits = sharePhone.replace(/\D/g, '');
  return [{
    origin,
    name: { formatted_name: name || phoneNumber },
    phones: [{
      phone: sharePhone.startsWith('+') ? sharePhone : `+${digits}`,
      wa_id: digits,
      type: 'CELL'
    }]
  }];
};
