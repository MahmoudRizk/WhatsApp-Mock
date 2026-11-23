import React, { useEffect, useRef, useState } from 'react';
import { Chat, LocationPayload, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChatSettingsModal } from './ChatSettingsModal';
import { LocationPickerModal } from './LocationPickerModal';
import { FlowCompleteModal, FlowFormValues } from './FlowCompleteModal';
import { Settings, Trash2 } from 'lucide-react';
import api from '../services/api';
import { getFlowSendFromMessage, getLastFlowSend } from '../utils/messagePayload';

interface Props {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onSendAudio?: (blob: Blob) => void;
  onSendMedia?: (file: File) => void;
  onSendLocation?: (location: LocationPayload, contextWamid?: string) => void;
  onShareContact?: (contextWamid?: string) => void;
  onCompleteFlow?: (values: FlowFormValues, contextWamid?: string) => Promise<void> | void;
  onUpdateChat: (chat: Chat) => void;
  onDeleteChat: (chatId: string) => void;
}

export const ChatWindow: React.FC<Props> = ({ chat, messages, onSendMessage, onSendAudio, onSendMedia, onSendLocation, onShareContact, onCompleteFlow, onUpdateChat, onDeleteChat }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [locationPicker, setLocationPicker] = useState<{ open: boolean; contextWamid?: string }>({ open: false });
  const [flowModal, setFlowModal] = useState<{ open: boolean; contextWamid?: string }>({ open: false });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDelete = () => {
    if (chat && window.confirm('Are you sure you want to delete this chat?')) {
      onDeleteChat(chat.id);
    }
  };

  const handleSaveSettings = async (updatedData: Partial<Chat> & { contactPhone?: string }) => {
    if (!chat) return;
    try {
      const res = await api.put(`/chats/${chat.id}`, updatedData);
      onUpdateChat(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!chat) return <div className="flex-1 flex items-center justify-center bg-[#efeae2] text-gray-500">Select a chat</div>;

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: chat.backgroundColor || '#efeae2' }}>
      <div className="bg-[#f0f2f5] px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold mr-3">
            {chat.contact?.name?.[0]?.toUpperCase() || '#'}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">{chat.contact?.name || chat.contact?.phoneNumber}</h2>
            <div className="text-xs text-gray-500">{chat.phoneNumber} (WABA)</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleDelete} 
            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-gray-200"
            title="Delete Chat"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-200"
            title="Chat Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
      
      <ChatSettingsModal 
        chat={chat} 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSaveSettings} 
      />
      
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onRequestLocation={(wamid) => setLocationPicker({ open: true, contextWamid: wamid })}
            onShareContact={(wamid) => onShareContact?.(wamid)}
            onCompleteFlow={(wamid) => setFlowModal({ open: true, contextWamid: wamid })}
          />
        ))}
      </div>

      <LocationPickerModal
        isOpen={locationPicker.open}
        onClose={() => setLocationPicker({ open: false })}
        onSend={(location) => onSendLocation?.(location, locationPicker.contextWamid)}
      />

      <FlowCompleteModal
        isOpen={flowModal.open}
        flowSend={(() => {
          const fallback = getLastFlowSend(chat.lastFlowSendJson);
          if (!flowModal.contextWamid) return fallback;
          const origin = messages.find(m => m.wamid === flowModal.contextWamid);
          return origin ? getFlowSendFromMessage(origin, fallback) : fallback;
        })()}
        onClose={() => setFlowModal({ open: false })}
        onSubmit={async (values, contextWamid) => {
          await onCompleteFlow?.(values, contextWamid);
        }}
      />

      <MessageInput
        onSend={onSendMessage}
        onSendAudio={onSendAudio}
        onSendMedia={onSendMedia}
        onShareLocation={onSendLocation ? () => setLocationPicker({ open: true }) : undefined}
      />
    </div>
  );
};
