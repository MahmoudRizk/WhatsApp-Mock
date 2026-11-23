import { Router, Request, Response } from 'express';
import { handleIncomingApiMessage, markMessageRead } from '../services/chatService';
import { createMedia } from '../services/mediaService';
import { uploadMedia } from '../middleware/upload';
import prisma from '../db/client';
import { getMediaTypeFromMime } from '../services/mediaService';
import { isLocationPayload, parseInteractivePayload, parseLocationPayload } from '../services/structuredMessage';

const cloudApiSuccess = (res: Response, recipient: string, wamid: string) =>
  res.json({
    messaging_product: "whatsapp",
    contacts: [{ input: recipient, wa_id: recipient }],
    messages: [{ id: wamid }]
  });

const router = Router();

router.post('/:phone_number_id/media', uploadMedia.single('file'), async (req: Request, res: Response) => {
  try {
    const { phone_number_id } = req.params;
    const messaging_product = req.body.messaging_product;
    
    if (messaging_product !== 'whatsapp') {
      return res.status(400).json({
        error: { message: "messaging_product must be 'whatsapp'", type: "OAuthException", code: 100 }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: { message: "file is required", type: "OAuthException", code: 100 }
      });
    }

    // Try to use the type from body, or derive it from the file's mimetype
    const requestedType = req.body.type;
    let mediaType = 'document';
    if (requestedType && requestedType.includes('/')) {
      mediaType = getMediaTypeFromMime(requestedType) || getMediaTypeFromMime(req.file.mimetype) || 'document';
    } else if (requestedType) {
      mediaType = requestedType; // e.g., 'image'
    } else {
      mediaType = getMediaTypeFromMime(req.file.mimetype) || 'document';
    }

    const media = await createMedia(req.file, mediaType);
    
    return res.json({ id: media.id });
  } catch (err: any) {
    console.error(err);
    if (err.statusCode && err.body) {
      return res.status(err.statusCode).json(err.body);
    }
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

router.get('/:media_id', async (req, res) => {
  try {
    const { media_id } = req.params;
    
    const media = await prisma.media.findUnique({
      where: { id: media_id }
    });

    if (media) {
      // Use configured base URL, or fall back to localhost
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      return res.json({
        url: `${baseUrl}/v22.0/media/${media.id}/download`,
        mime_type: media.mimeType,
        sha256: media.sha256,
        file_size: media.fileSize,
        id: media.id
      });
    }

    return res.status(404).json({
      error: {
        message: `No media with id ${media_id}`,
        type: "OAuthException",
        code: 100
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

router.get('/media/:media_id/download', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 }
      });
    }
    
    // In a real app we'd validate the token against the DB.
    // For this mock we just ensure it's provided.

    const { media_id } = req.params;
    const media = await prisma.media.findUnique({
      where: { id: media_id }
    });

    if (!media) {
      return res.status(404).json({
        error: { message: `No media with id ${media_id}`, type: "OAuthException", code: 100 }
      });
    }

    const fs = await import('fs');
    const path = await import('path');
    
    const absolutePath = path.join(__dirname, '../../', media.storagePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        error: { message: "File not found on disk", type: "OAuthException", code: 100 }
      });
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${media.filename}"`);
    
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: "Internal server error" } });
  }
});

router.post('/:phone_number_id/messages', async (req, res) => {
  try {
    const { phone_number_id } = req.params;
    const body = req.body;

    const mediaTypes = ['image', 'document', 'audio', 'video', 'sticker'];

    if (body.type === 'text' && body.text?.body) {
      const recipient = body.to || body.recipient;
      if (!recipient) {
        return res.status(400).json({
          error: { message: "to is required", type: "OAuthException", code: 100 }
        });
      }
      const msg = await handleIncomingApiMessage(recipient, body.text.body, 'text');
      return cloudApiSuccess(res, recipient, msg.wamid);
    } else if (mediaTypes.includes(body.type) && body[body.type]) {
      const mediaPayload = body[body.type];
      
      let mediaIdStr = undefined;
      let mediaLink = undefined;

      if (mediaPayload.id) {
        // Validate media ID exists
        const mediaRecord = await prisma.media.findUnique({ where: { id: mediaPayload.id } });
        if (!mediaRecord) {
          return res.status(400).json({
            error: { message: "Media ID not found or expired", type: "OAuthException", code: 131051 }
          });
        }
        mediaIdStr = mediaPayload.id;
      } else if (mediaPayload.link) {
        mediaLink = mediaPayload.link;
      } else {
        return res.status(400).json({
          error: { message: `Missing id or link for ${body.type}`, type: "OAuthException", code: 100 }
        });
      }

      const recipient = body.to || body.recipient;
      if (!recipient) {
        return res.status(400).json({
          error: { message: "to is required", type: "OAuthException", code: 100 }
        });
      }

      const caption = mediaPayload.caption;
      const filename = mediaPayload.filename;

      const msg = await handleIncomingApiMessage(
        recipient,
        '',
        body.type,
        mediaIdStr,
        mediaLink,
        caption,
        filename
      );

      return cloudApiSuccess(res, recipient, msg.wamid);
    } else if (body.type === 'location' && body.location) {
      const recipient = body.to || body.recipient;
      if (!recipient) {
        return res.status(400).json({
          error: { message: "to is required", type: "OAuthException", code: 100 }
        });
      }
      const parsed = parseLocationPayload(body.location);
      if (!isLocationPayload(parsed)) {
        return res.status(400).json({
          error: { message: parsed.error, type: "OAuthException", code: 100 }
        });
      }
      const msg = await handleIncomingApiMessage(
        recipient,
        parsed.name || parsed.address || `${parsed.latitude}, ${parsed.longitude}`,
        'location',
        undefined,
        undefined,
        undefined,
        undefined,
        { payloadJson: JSON.stringify(parsed) }
      );
      return cloudApiSuccess(res, recipient, msg.wamid);
    } else if (body.type === 'interactive' && body.interactive) {
      const recipient = body.to || body.recipient;
      if (!recipient) {
        return res.status(400).json({
          error: { message: "to is required", type: "OAuthException", code: 100 }
        });
      }
      const parsed = parseInteractivePayload(body.interactive);
      if ('error' in parsed) {
        return res.status(400).json({
          error: { message: parsed.error, type: "OAuthException", code: 100 }
        });
      }
      const msg = await handleIncomingApiMessage(
        recipient,
        parsed.bodyText,
        'interactive',
        undefined,
        undefined,
        undefined,
        undefined,
        { payloadJson: JSON.stringify(parsed.payload) }
      );
      return cloudApiSuccess(res, recipient, msg.wamid);
    }

    if (body.status === 'read' && body.message_id) {
      await markMessageRead(body.message_id);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: { message: "Unsupported message type" } });
  } catch (err) {
    console.error(err);
    console.error(err); res.status(500).json({ error: { message: "Internal server error" } });
  }
});

export default router;
