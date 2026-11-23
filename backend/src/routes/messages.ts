import { Router } from 'express';
import prisma from '../db/client';
import { dispatchWebhook } from '../services/webhookDispatcher';
import { getSocket } from '../ws/socketHandler';
import { uploadMedia, uploadAudio } from '../middleware/upload';
import { createMedia } from '../services/mediaService';
import {
  buildContactShare,
  buildNfmReplyFields,
  buildNfmReplyInteractive,
  extractFlowTokenFromMessagePayload,
  isLocationPayload,
  parseLastFlowSend,
  parseLocationPayload
} from '../services/structuredMessage';

const router = Router();

router.get('/:chatId/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { chatId: req.params.chatId },
      orderBy: { timestamp: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages', async (req, res) => {
  try {
    const { text } = req.body;
    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;
    
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        textBody: text,
        status: 'SENT'
      }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    
    // Fire and forget webhook
    dispatchWebhook(message, chat.contact).catch(err => {
      console.error('Webhook dispatch failed:', err);
    });
    
    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages/audio', uploadMedia.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided" });

    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId as string }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Create a proper Media record — same pipeline as images/documents
    const media = await createMedia(req.file, 'audio');

    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;
    
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        type: 'audio',
        mediaId: media.id,
        mediaUrl: media.storagePath,
        status: 'SENT'
      },
      include: { media: true }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    
    // Fire and forget webhook
    dispatchWebhook(message, chat.contact).catch(err => {
      console.error('Webhook dispatch failed:', err);
    });
    
    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages/media', async (req, res) => {
  try {
    const { type, [type]: mediaPayload } = req.body;
    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    let mediaId = undefined;
    let mediaLink = undefined;
    let mediaUrl = undefined;
    
    if (mediaPayload?.id) {
      mediaId = mediaPayload.id;
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (media) mediaUrl = media.storagePath;
    } else if (mediaPayload?.link) {
      mediaLink = mediaPayload.link;
      mediaUrl = mediaLink;
    } else {
      return res.status(400).json({ error: "No media id or link provided" });
    }

    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;
    
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        type: type || 'document',
        mediaId,
        mediaLink,
        mediaUrl,
        mediaCaption: mediaPayload.caption,
        mediaFilename: mediaPayload.filename,
        status: 'SENT'
      },
      include: { media: true }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    
    dispatchWebhook(message, chat.contact).catch(err => console.error('Webhook dispatch failed:', err));
    
    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages/location', async (req, res) => {
  try {
    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const parsed = parseLocationPayload(req.body.location || req.body);
    if (!isLocationPayload(parsed)) {
      return res.status(400).json({ error: parsed.error });
    }

    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;
    const preview = parsed.name || parsed.address || `${parsed.latitude}, ${parsed.longitude}`;

    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        type: 'location',
        textBody: preview,
        payloadJson: JSON.stringify(parsed),
        contextWamid: req.body.contextWamid || undefined,
        status: 'SENT'
      }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    dispatchWebhook(message, chat.contact).catch(err => console.error('Webhook dispatch failed:', err));

    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages/contacts', async (req, res) => {
  try {
    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const contacts = Array.isArray(req.body.contacts)
      ? req.body.contacts
      : buildContactShare(
          chat.contact.name || chat.contact.phoneNumber,
          chat.contact.phoneNumber,
          req.body.origin || 'contact_request',
          req.body.phone
        );

    const preview = contacts[0]?.name?.formatted_name || chat.contact.phoneNumber;
    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;

    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        type: 'contacts',
        textBody: preview,
        payloadJson: JSON.stringify(contacts),
        contextWamid: req.body.contextWamid || undefined,
        status: 'SENT'
      }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    dispatchWebhook(message, chat.contact).catch(err => console.error('Webhook dispatch failed:', err));

    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

router.post('/:chatId/messages/nfm-reply', async (req, res) => {
  try {
    const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, include: { contact: true } });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const contextWamid = typeof req.body.contextWamid === 'string' ? req.body.contextWamid : undefined;
    let flowToken: string | undefined;

    if (contextWamid) {
      const origin = await prisma.message.findFirst({
        where: { chatId: chat.id, wamid: contextWamid }
      });
      const fromOrigin = extractFlowTokenFromMessagePayload(origin?.payloadJson);
      if (fromOrigin?.flow_token) {
        flowToken = fromOrigin.flow_token;
      }
    }

    if (!flowToken) {
      const last = parseLastFlowSend(chat.lastFlowSendJson);
      if (last?.flow_token) {
        flowToken = last.flow_token;
      }
    }

    if (!flowToken) {
      return res.status(400).json({ error: "No Flow send found for this chat; flow_token cannot be invented" });
    }

    const fields = buildNfmReplyFields(flowToken, req.body);
    const payload = buildNfmReplyInteractive(fields);
    const wamid = `wamid.HBgL${Math.random().toString(36).substring(2, 15)}`;

    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        wamid,
        direction: 'OUTBOUND',
        senderPhone: chat.phoneNumber,
        recipientPhone: chat.contact.phoneNumber,
        type: 'interactive',
        textBody: payload.nfm_reply?.body || 'Sent',
        payloadJson: JSON.stringify(payload),
        status: 'SENT'
      }
    });

    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date() }
    });

    getSocket().emit('message:received', message);
    dispatchWebhook(message, chat.contact).catch(err => console.error('Webhook dispatch failed:', err));

    res.json({ message, webhookDelivery: { pending: true } });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Internal error" });
  }
});

export default router;
