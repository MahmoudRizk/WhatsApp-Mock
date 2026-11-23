import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Trash2, Paperclip, MapPin } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { MediaPreview } from './MediaPreview';

interface Props {
  onSend: (text: string) => void;
  onSendAudio?: (blob: Blob) => void;
  onSendMedia?: (file: File) => void;
  onShareLocation?: () => void;
}

export const MessageInput: React.FC<Props> = ({ onSend, onSendAudio, onSendMedia, onShareLocation }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioBlob]);

  const handleSend = () => {
    if (selectedFile && onSendMedia) {
      onSendMedia(selectedFile);
      setSelectedFile(null);
    } else if (audioBlob && onSendAudio) {
      onSendAudio(audioBlob);
      setAudioBlob(null);
    } else if (text.trim()) {
      onSend(text.trim());
      setText('');
      const ta = document.getElementById('message-textarea');
      if (ta) ta.style.height = 'auto';
    }
  };

  if (isRecording) {
    return (
      <div className="bg-[#f0f2f5] p-3 flex items-center gap-2">
        <AudioRecorder 
          onRecordingComplete={(blob, sendImmediately) => {
            if (sendImmediately && onSendAudio) {
              setIsRecording(false);
              onSendAudio(blob);
            } else {
              setAudioBlob(blob);
              setIsRecording(false);
            }
          }}
          onCancel={() => setIsRecording(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-[#f0f2f5]">
      {selectedFile && (
        <div className="px-4 pt-2">
          <MediaPreview file={selectedFile} onDiscard={() => setSelectedFile(null)} />
        </div>
      )}
      
      <div className="p-3 flex items-center gap-2">
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/mp4,application/pdf,image/webp"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setSelectedFile(e.target.files[0]);
            }
          }}
        />
        
        {!audioUrl && (
          <>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-gray-700" title="Attach file">
              <Paperclip size={24} />
            </button>
            {onShareLocation && (
              <button onClick={onShareLocation} className="p-2 text-gray-500 hover:text-gray-700" title="Share location pin">
                <MapPin size={24} />
              </button>
            )}
          </>
        )}

        {audioUrl ? (
          <div className="flex-1 flex items-center gap-2 bg-white rounded-lg p-2">
            <audio src={audioUrl} controls className="h-10 flex-1" />
            <button onClick={() => setAudioBlob(null)} className="p-2 text-red-500 hover:text-red-700">
              <Trash2 size={20} />
            </button>
          </div>
        ) : (
          <textarea
            id="message-textarea"
            className="flex-1 rounded-lg border-none px-4 py-2 outline-none resize-none min-h-[40px] max-h-[120px]"
            placeholder="Type a message"
            rows={1}
            value={text}
            onChange={e => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                  return;
                } else {
                  e.preventDefault();
                  handleSend();
                }
              }
            }}
          />
        )}
        
        {text.trim() || audioBlob || selectedFile ? (
          <button onClick={handleSend} className="p-2 text-green-500 hover:text-green-700">
            <Send size={24} />
          </button>
        ) : (
          <button onClick={() => setIsRecording(true)} className="p-2 text-gray-500 hover:text-gray-700">
            <Mic size={24} />
          </button>
        )}
      </div>
    </div>
  );
};
