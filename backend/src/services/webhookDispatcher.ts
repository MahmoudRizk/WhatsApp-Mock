import axios from 'axios';
import prisma from '../db/client';

const MEDIA_TYPES = ['image', 'document', 'audio', 'video', 'sticker'];

const parsePayload = (message: any) => {
  if (!message.payloadJson) return null;
  try {
    return JSON.parse(message.payloadJson);
  } catch {
    return null;
  }
};

const buildContext = (message: any, businessPhone: string) => {
  if (!message.contextWamid) return {};
  return {
    context: {
      from: businessPhone,
      id: message.contextWamid
    }
  };
};

const buildMessageBody = (message: any) => {
  const payload = parsePayload(message);
  const type = message.type || 'text';

  if (type === 'text') {
    return { text: { body: message.textBody } };
  }

  if (type === 'location' && payload) {
    return { location: payload };
  }

  if (type === 'contacts' && payload) {
    return { contacts: payload };
  }

  if (type === 'interactive' && payload) {
    return { interactive: payload };
  }

  if (MEDIA_TYPES.includes(type)) {
    return {
      [type]: {
        ...(message.mediaLink ? { link: message.mediaLink } : { id: message.mediaId || message.id }),
        ...(message.media?.mimeType && { mime_type: message.media.mimeType }),
        ...(message.media?.sha256 && { sha256: message.media.sha256 }),
        ...(message.mediaCaption && { caption: message.mediaCaption }),
        ...(message.mediaFilename && { filename: message.mediaFilename })
      }
    };
  }

  if (message.textBody) {
    return { text: { body: message.textBody } };
  }

  return {};
};

export const dispatchWebhook = async (message: any, contact: any) => {
  const chat = await prisma.chat.findUnique({ where: { id: message.chatId } });
  
  if (!chat || !chat.webhookUrl) return;

  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: chat.wabaId,
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: chat.phoneNumber,
            phone_number_id: chat.phoneNumberId
          },
          contacts: [{
            profile: { name: contact.name || contact.phoneNumber },
            wa_id: contact.phoneNumber
          }],
          messages: [{
            from: contact.phoneNumber,
            id: message.wamid,
            timestamp: Math.floor(message.timestamp.getTime() / 1000).toString(),
            type: message.type || "text",
            ...buildMessageBody(message),
            ...buildContext(message, chat.phoneNumber)
          }]
        }
      }]
    }]
  };

  let success = false;
  let responseCode = null;
  let responseBody = null;

  try {
    const res = await axios.post(chat.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    success = res.status >= 200 && res.status < 300;
    responseCode = res.status;
    responseBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (err: any) {
    responseCode = err.response?.status || 500;
    responseBody = err.message;
  }

  await prisma.webhookLog.create({
    data: {
      messageId: message.id,
      targetUrl: chat.webhookUrl,
      payload: JSON.stringify(payload),
      responseCode,
      responseBody,
      success
    }
  });

  return success;
};
