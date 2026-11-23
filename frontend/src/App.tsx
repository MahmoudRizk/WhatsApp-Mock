import React, { useState, useEffect } from 'react';
import { WebhookLogsModal } from './components/WebhookLogsModal';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { Activity } from 'lucide-react';
import api from './services/api';
import socket from './services/socket';
import { Chat, LocationPayload, Message } from './types';
import { FlowFormValues } from './components/FlowCompleteModal';

function App() {
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const fetchChats = () => {
    api.get('/chats').then((res: any) => setChats(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchChats();

    socket.on('message:received', (msg: Message) => {
      fetchChats();
      if (activeChatId === msg.chatId) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socket.on('message:status', (updatedMsg: Message) => {
      if (activeChatId === updatedMsg.chatId) {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, status: updatedMsg.status } : m));
      }
    });

    return () => {
      socket.off('message:received');
      socket.off('message:status');
    };
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId) {
      api.get(`/chats/${activeChatId}/messages`).then((res: any) => setMessages(res.data)).catch(console.error);
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  const handleNewChat = async (chatData: any) => {
    const res = await api.post('/chats', chatData);
    fetchChats();
    setActiveChatId(res.data.id);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeChatId) return;
    try {
      const res = await api.post(`/chats/${activeChatId}/messages`, { text });
      // The socket event will append the message to the list
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (!activeChatId) return;
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      await api.post(`/chats/${activeChatId}/messages/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMedia = async (file: File) => {
    if (!activeChatId) return;
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    try {
      const { uploadMedia } = await import('./services/mediaApi');
      const { id: mediaId } = await uploadMedia(file, activeChat.phoneNumberId);
      
      let type = 'document';
      if (file.type.startsWith('image/')) type = file.type === 'image/webp' ? 'sticker' : 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const payload = {
        messaging_product: 'whatsapp',
        to: activeChat.contact?.phoneNumber || activeChat.contactId,
        type,
        [type]: {
          id: mediaId,
          ...(type === 'document' ? { filename: file.name } : {})
        }
      };

      await api.post(`/chats/${activeChatId}/messages/media`, payload);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendLocation = async (location: LocationPayload, contextWamid?: string) => {
    if (!activeChatId) return;
    try {
      await api.post(`/chats/${activeChatId}/messages/location`, { location, contextWamid });
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareContact = async (contextWamid?: string) => {
    if (!activeChatId) return;
    try {
      await api.post(`/chats/${activeChatId}/messages/contacts`, { contextWamid });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteFlow = async (values: FlowFormValues, contextWamid?: string) => {
    if (!activeChatId) return;
    await api.post(`/chats/${activeChatId}/messages/nfm-reply`, { ...values, contextWamid });
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await api.delete(`/chats/${id}`);
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <header className="bg-[#00a884] text-white p-4 flex justify-between items-center shadow-md z-10">
        <h1 className="text-xl font-bold">WhatsApp Mock Service</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsLogsOpen(true)} className="p-2 hover:bg-white/20 rounded-full" title="Webhook Logs">
            <Activity size={24} />
          </button>
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        <Sidebar 
          chats={chats} 
          activeChatId={activeChatId} 
          onSelectChat={setActiveChatId} 
          onNewChat={handleNewChat} 
        />
        <ChatWindow 
          chat={activeChat} 
          messages={messages} 
          onSendMessage={handleSendMessage}
          onSendAudio={handleSendAudio}
          onSendMedia={handleSendMedia}
          onSendLocation={handleSendLocation}
          onShareContact={handleShareContact}
          onCompleteFlow={handleCompleteFlow}
          onUpdateChat={(updatedChat) => {
            setChats(prev => prev.map(c => c.id === updatedChat.id ? { ...c, ...updatedChat } : c));
          }}
          onDeleteChat={handleDeleteChat}
        />
      </main>

      <WebhookLogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
    </div>
  );
}

export default App;
