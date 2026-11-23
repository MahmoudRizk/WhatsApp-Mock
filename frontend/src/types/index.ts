export interface Contact {
  id: string;
  phoneNumber: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  contactId: string;
  contact?: Contact;
  phoneNumber: string;
  displayName: string;
  phoneNumberId: string;
  wabaId: string;
  webhookVerifyToken: string;
  webhookUrl: string;
  accessToken: string;
  tags: string;
  backgroundColor: string;
  lastFlowSendJson?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  messages?: Message[];
}

export interface Media {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  mediaType: string;
  storagePath: string;
  sha256: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface FlowActionPayloadScreen {
  screen?: string;
  data?: FlowScreenData;
}

export interface FlowScreenOption {
  id: string;
  title: string;
}

export interface FlowScreenData {
  channel_name?: string;
  customer_name?: string;
  heading?: string;
  label_name?: string;
  label_fulfillment?: string;
  cta_continue?: string;
  fulfillment_methods?: FlowScreenOption[];
  pickup_stores?: FlowScreenOption[];
  payments_delivery?: FlowScreenOption[];
  payments_pickup?: FlowScreenOption[];
}

export interface FlowActionParameters {
  flow_message_version?: string;
  flow_id?: string;
  flow_token?: string;
  flow_cta?: string;
  flow_action?: string;
  flow_action_payload?: FlowActionPayloadScreen;
  [key: string]: unknown;
}

export interface LastFlowSend {
  flow_id: string;
  flow_token: string;
  wamid: string;
  screen_data?: FlowScreenData | null;
}

export interface NfmReplyFields {
  flow_token: string;
  customer_name: string;
  fulfillment: 'delivery' | 'pickup' | string;
  payment_option_code: string;
  area: string;
  street: string;
  building_number: string;
  floor_number: string;
  apartment_number: string;
  landmark: string;
  store_id: string;
}

export interface InteractivePayload {
  type: 'location_request_message' | 'request_contact_info' | 'flow' | 'nfm_reply' | string;
  header?: { type?: string; text?: string };
  body?: { text: string };
  footer?: { text?: string };
  action?: { name?: string; parameters?: FlowActionParameters };
  nfm_reply?: {
    name?: string;
    body?: string;
    response_json?: string;
  };
}

export interface SharedContact {
  origin?: 'contact_request' | 'other' | string;
  name?: { formatted_name?: string; first_name?: string };
  phones?: { phone: string; wa_id?: string; type?: string }[];
}

export interface Message {
  id: string;
  chatId: string;
  wamid: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderPhone: string;
  recipientPhone: string;
  textBody?: string;
  type: string;
  mediaUrl?: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorMessage?: string;
  timestamp: string;
  mediaId?: string;
  media?: Media;
  mediaLink?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  payloadJson?: string | null;
  contextWamid?: string | null;
}

export interface WebhookLog {
  id: string;
  messageId: string | null;
  targetUrl: string;
  payload: string;
  responseCode: number | null;
  responseBody: string | null;
  success: boolean;
  createdAt: string;
}
