import React, { useState } from 'react';
import { Chat } from '../types';
import { MessageSquarePlus } from 'lucide-react';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: (chatData: any) => Promise<void>;
}

const InputField = ({ label, value, onChange, hint, type = "text", required = false, autoFocus = false }: { label: string, value: string, onChange: (v: string) => void, hint: string, type?: string, required?: boolean, autoFocus?: boolean }) => (
  <div className="mb-2">
    <label className="block text-xs font-semibold text-gray-600 mb-1" title={hint}>
      {label}{required ? <span className="text-red-500"> *</span> : null} <span className="text-gray-400 font-normal cursor-help">ⓘ</span>
    </label>
    <input 
      type={type} 
      className={`w-full p-2 border rounded text-sm ${type === 'color' ? 'h-10 p-1' : ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      title={hint}
      required={required}
      autoFocus={autoFocus}
    />
  </div>
);

const GroupHeader = ({ title }: { title: string }) => (
  <div className="mt-4 mb-2">
    <h3 className="text-sm font-bold text-gray-700">{title}</h3>
    <hr className="mt-1 border-gray-200" />
  </div>
);

export const Sidebar: React.FC<Props> = ({ chats, activeChatId, onSelectChat, onNewChat }) => {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  
  const [contactPhone, setContactPhone] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('http://host.docker.internal:8000/webhook');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('mock_verify_token');
  const [phoneNumberId, setPhoneNumberId] = useState('100000000000001');
  const [wabaId, setWabaId] = useState('200000000000002');
  
  const [phoneNumber, setPhoneNumber] = useState('15550001111');
  const [displayName, setDisplayName] = useState('WhatsApp Business Mock');
  
  const [tags, setTags] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#efeae2');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = chats.filter(c => 
    c.contact?.phoneNumber.includes(search) || 
    c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    const phone = contactPhone.trim();
    if (!phone) {
      setFormError('Contact phone is required — it identifies the diner in this mock chat.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await onNewChat({
        contactPhone: phone,
        name: phone,
        webhookUrl: newWebhookUrl,
        phoneNumber,
        displayName,
        phoneNumberId,
        wabaId,
        webhookVerifyToken,
        tags,
        backgroundColor
      });
      setContactPhone('');
      setShowNewChat(false);
    } catch (err: any) {
      const detail = err?.response?.data?.error || err?.message || 'Could not create chat.';
      setFormError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-1/3 max-w-[400px] bg-white border-r flex flex-col">
      <div className="p-3 bg-[#f0f2f5] flex justify-between items-center">
        <h2 className="font-bold text-gray-700">Chats</h2>
        <button onClick={() => setShowNewChat(!showNewChat)} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full">
          <MessageSquarePlus size={20} />
        </button>
      </div>

      {showNewChat && (
        <div className="p-3 border-b bg-white flex flex-col max-h-[70vh]">
          <div className="overflow-y-auto">
          <InputField label="Contact Phone" value={contactPhone} onChange={(v) => { setContactPhone(v); setFormError(''); }} hint="The phone number of the recipient you are messaging." required autoFocus />
          {formError && <p className="mb-2 text-xs text-red-600">{formError}</p>}

          <GroupHeader title="Server Settings" />
          <InputField label="Webhook URL" value={newWebhookUrl} onChange={setNewWebhookUrl} hint="The URL where incoming messages should be sent." />
          <InputField label="Verify Token" value={webhookVerifyToken} onChange={setWebhookVerifyToken} hint="Token used to verify the webhook setup." />
          <InputField label="Phone Number ID" value={phoneNumberId} onChange={setPhoneNumberId} hint="The ID of your WABA phone number." />
          <InputField label="WABA ID" value={wabaId} onChange={setWabaId} hint="Your WhatsApp Business Account ID." />
          
          <GroupHeader title="Sender Details" />
          <InputField label="Sender Phone Number" value={phoneNumber} onChange={setPhoneNumber} hint="Your WABA phone number." />
          <InputField label="Display Name" value={displayName} onChange={setDisplayName} hint="The display name of your WhatsApp Business Account." />
          
          <GroupHeader title="Others" />
          <InputField label="Tags" value={tags} onChange={setTags} hint="Comma-separated tags for categorizing this chat." />
          <InputField label="Background Color" type="color" value={backgroundColor} onChange={setBackgroundColor} hint="Color palette for the chat background." />
          </div>

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleCreate} disabled={saving} className="flex-1 bg-green-500 text-white rounded py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Chat'}
            </button>
            <button type="button" onClick={() => { setShowNewChat(false); setFormError(''); }} className="flex-1 border rounded py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-2 border-b">
        <input 
          type="text" 
          placeholder="Search chats or tags..." 
          className="w-full p-2 bg-[#f0f2f5] rounded-lg text-sm outline-none"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(chat => (
          <div 
            key={chat.id} 
            onClick={() => onSelectChat(chat.id)}
            className={`flex items-center p-3 cursor-pointer hover:bg-[#f5f6f6] border-b ${activeChatId === chat.id ? 'bg-[#f0f2f5]' : ''}`}
          >
            <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-white font-bold mr-3">
              {chat.contact?.name?.[0]?.toUpperCase() || '#'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-medium text-gray-900 truncate">{chat.contact?.name || chat.contact?.phoneNumber}</h3>
                <span className="text-xs text-gray-500">{new Date(chat.lastMessageAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {chat.messages?.[0]?.textBody || 'No messages'}
              </p>
              {chat.tags && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {chat.tags.split(',').map(t => (
                    <span key={t} className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                      #{t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
