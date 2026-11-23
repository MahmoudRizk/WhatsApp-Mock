import React from 'react';
import { Check, CheckCheck, MapPin, Phone, User } from 'lucide-react';
import { Message } from '../types';
import { parseWhatsAppMarkdown } from '../utils/whatsappMarkdownParser';
import { getInteractivePayload, getLocationPayload, getSharedContacts } from '../utils/messagePayload';

interface Props {
  message: Message;
  onRequestLocation?: (contextWamid: string) => void;
  onShareContact?: (contextWamid: string) => void;
  onCompleteFlow?: (contextWamid: string) => void;
}

export const MessageBubble: React.FC<Props> = ({ message, onRequestLocation, onShareContact, onCompleteFlow }) => {
  const isOutbound = message.direction === 'OUTBOUND';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const htmlContent = message.textBody ? parseWhatsAppMarkdown(message.textBody) : '';

  const getStatusIcon = () => {
    if (!isOutbound) return null;
    switch (message.status) {
      case 'SENT': return <Check size={14} className="text-gray-500" />;
      case 'DELIVERED': return <CheckCheck size={14} className="text-gray-500" />;
      case 'READ': return <CheckCheck size={14} className="text-blue-500" />;
      default: return null;
    }
  };

  const API_BASE = 'http://localhost:3000'; // Default API URL for media relative links
  
  const getMediaUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE}${url}`;

  const renderLocation = () => {
    const location = getLocationPayload(message);
    if (!location) return <span className="text-gray-500 italic">Location missing</span>;
    const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    return (
      <a href={mapsUrl} target="_blank" rel="noreferrer" className="block min-w-[220px] no-underline">
        <div className="bg-[#e7f8e9] rounded-md overflow-hidden">
          <div className="h-24 flex items-center justify-center bg-gradient-to-b from-green-100 to-green-50">
            <MapPin size={36} className="text-red-500" />
          </div>
          <div className="p-2">
            <p className="text-sm font-semibold text-gray-800">{location.name || 'Location pin'}</p>
            {location.address && <p className="text-xs text-gray-600">{location.address}</p>}
            <p className="text-[11px] text-gray-500 mt-1">{location.latitude}, {location.longitude}</p>
          </div>
        </div>
      </a>
    );
  };

  const renderInteractive = () => {
    const interactive = getInteractivePayload(message);
    if (interactive?.type === 'nfm_reply') {
      return (
        <div className="min-w-[180px]">
          <p className="text-xs text-gray-500 mb-1">Checkout details</p>
          <p className="text-sm text-gray-800">{interactive.nfm_reply?.body || 'Sent'}</p>
        </div>
      );
    }

    const isFlow = interactive?.type === 'flow';
    const body = interactive?.body?.text || (!isFlow ? (message.textBody || 'Information request') : '');
    const header = interactive?.header?.text;
    const footer = interactive?.footer?.text;
    const isLocationRequest = interactive?.type === 'location_request_message';
    const isContactRequest = interactive?.type === 'request_contact_info';
    const flowCta = interactive?.action?.parameters?.flow_cta || 'Complete details';
    const canAct = !isOutbound && (isLocationRequest || isContactRequest || isFlow);

    return (
      <div className="min-w-[220px]">
        {isFlow && header && (
          <p className="text-sm font-semibold text-gray-900 mb-1 break-words">{header}</p>
        )}
        {body ? (
          <p className="text-sm text-gray-800 break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: parseWhatsAppMarkdown(body) }} />
        ) : null}
        {isFlow && footer && (
          <p className="text-xs text-gray-500 mt-1">{footer}</p>
        )}
        {canAct && (
          <button
            type="button"
            onClick={() => {
              if (isFlow) onCompleteFlow?.(message.wamid);
              else if (isLocationRequest) onRequestLocation?.(message.wamid);
              else onShareContact?.(message.wamid);
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[#00a884] text-white text-sm font-medium hover:bg-[#008f6f]"
          >
            {isFlow ? null : isLocationRequest ? <MapPin size={16} /> : <Phone size={16} />}
            {isFlow ? flowCta : isLocationRequest ? 'Send location' : 'Share contact info'}
          </button>
        )}
      </div>
    );
  };

  const renderContacts = () => {
    const contacts = getSharedContacts(message);
    if (!contacts.length) return <span className="text-gray-500 italic">Contact missing</span>;
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        {contacts.map((contact, index) => (
          <div key={index} className="flex items-center gap-3 bg-black/5 rounded-md p-2">
            <div className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{contact.name?.formatted_name || 'Shared contact'}</p>
              <p className="text-xs text-gray-600">{contact.phones?.[0]?.phone || message.textBody}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (message.type === 'text') {
      return <p className="text-sm text-gray-800 break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }

    if (message.type === 'location') return renderLocation();
    if (message.type === 'interactive') return renderInteractive();
    if (message.type === 'contacts') return renderContacts();
    
    if (!message.mediaUrl) {
      return <span className="text-gray-500 italic">Media missing</span>;
    }

    const url = getMediaUrl(message.mediaUrl);
    
    switch (message.type) {
      case 'image':
      case 'sticker':
        return (
          <div className="flex flex-col gap-1">
            <img src={url} alt={message.mediaCaption || "Image"} className={`rounded max-h-64 object-contain ${message.type === 'sticker' ? 'bg-transparent' : ''}`} />
            {message.mediaCaption && <p className="text-sm text-gray-800">{message.mediaCaption}</p>}
          </div>
        );
      case 'video':
        return (
          <div className="flex flex-col gap-1">
            <video src={url} controls className="max-h-64 rounded max-w-full" />
            {message.mediaCaption && <p className="text-sm text-gray-800">{message.mediaCaption}</p>}
          </div>
        );
      case 'audio':
        return <audio src={url} controls className="h-10 mt-1 max-w-full" />;
      case 'document':
        return (
          <div className="flex flex-col gap-1">
            <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/5 p-2 rounded hover:bg-black/10">
              <span className="text-xl">📄</span>
              <span className="text-sm font-medium text-blue-600 truncate underline">{message.mediaFilename || 'Document'}</span>
            </a>
            {message.mediaCaption && <p className="text-sm text-gray-800">{message.mediaCaption}</p>}
          </div>
        );
      default:
        return <p className="text-sm text-gray-800 break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }
  };

  return (
    <div className={`flex w-full ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[70%] rounded-lg px-3 py-2 relative shadow ${isOutbound ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
        {renderContent()}
        <div className="text-[10px] text-gray-500 text-right mt-1 flex justify-end items-center gap-1">
          {time}
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
};
