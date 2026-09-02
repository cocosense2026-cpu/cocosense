import React, { useState } from 'react';
import { OutboxEmail } from '../types';
import { 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  FileText, 
  User, 
  Sparkles,
  X,
  AlertCircle
} from 'lucide-react';

interface OutboxViewProps {
  outbox: OutboxEmail[];
  onSendBroadcast: (recipient: string, subject: string, body: string) => void;
}

export const OutboxView: React.FC<OutboxViewProps> = ({
  outbox,
  onSendBroadcast,
}) => {
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [recipient, setRecipient] = useState<string>('all-owners@cocosense.ph');
  const [subject, setSubject] = useState<string>('URGENT: Bioacoustic Alert Threshold Advisory');
  const [body, setBody] = useState<string>('Dear Plantation Owner,\n\nOur ASCOT bioacoustic monitoring stations have observed elevated wood-boring larval acoustic signatures in Sector Alpha. Please review your dashboard and prepare pheromone lure traps.\n\nRegards,\nCocoSense Monitoring Team');
  const [selectedEmail, setSelectedEmail] = useState<OutboxEmail | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !body) return;
    onSendBroadcast(recipient, subject, body);
    setIsComposerOpen(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase serif flex items-center gap-2.5">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
            SMTP Outbox &amp; Super Admin Messenger
          </h1>
          <p className="text-xs text-[#808080] mt-1 font-light">
            Queued and dispatched invitation emails, credential deliveries, and agronomic broadcast alerts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsComposerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          <Send className="w-4 h-4" />
          <span>Compose Field Broadcast</span>
        </button>
      </div>

      {/* Outbox List */}
      <div className="rounded bg-[#141414] border border-[#262626] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[#0E0E0E] border-b border-[#262626] text-[#808080] font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Dispatch Status</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {outbox.map(email => (
                <tr key={email.id} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="py-4 px-5">
                    <div className="font-bold text-white text-xs">{email.to || email.toEmail}</div>
                    <div className="text-[10px] text-[#808080] font-mono">
                      {typeof email.id === 'number' ? `EM-${email.id}` : email.id} &middot; {email.toName || 'User'}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium text-[#E0E0E0]">{email.subject}</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#141414] text-[#4CAF50] border border-[#4CAF50]/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="capitalize">{email.status || email.deliveryStatus || 'Sent'}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-[#808080]">{email.sentAt || email.createdAt}</td>
                  <td className="py-4 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedEmail(email)}
                      className="px-3 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#D4AF37] font-semibold text-xs"
                    >
                      View Body
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Composer Modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded bg-[#141414] border border-[#262626] p-6 md:p-8 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white uppercase serif flex items-center gap-2">
                <Send className="w-5 h-5 text-[#D4AF37]" />
                Dispatch Email Broadcast
              </h3>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-[#808080] mb-1">To</label>
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="w-full px-3.5 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[#808080] mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[#808080] mb-1">Message Content</label>
                <textarea
                  rows={5}
                  required
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full px-3.5 py-2 rounded bg-[#0A0A0A] border border-[#262626] text-white focus:border-[#D4AF37] focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold uppercase tracking-wider"
                >
                  Send via SMTP Gateway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Body Inspector Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded bg-[#141414] border border-[#262626] p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white uppercase serif">{selectedEmail.subject}</h3>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 rounded bg-[#1A1A1A] text-[#808080] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs space-y-2">
              <p className="text-[#808080]">To: <strong className="text-white">{selectedEmail.to || selectedEmail.toEmail}</strong></p>
              <p className="text-[#808080]">Dispatched: <strong className="text-white">{selectedEmail.sentAt || selectedEmail.createdAt}</strong></p>
              <pre className="p-4 rounded bg-[#0A0A0A] border border-[#262626] text-[#E0E0E0] whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {selectedEmail.body}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
