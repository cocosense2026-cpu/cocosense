import React, { useState } from 'react';
import { ChevronDown, Mail, User, MapPin, HelpCircle, LifeBuoy } from 'lucide-react';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

const FAQS = [
  {
    q: 'How often do sensors sync with the dashboard?',
    a: 'Piezoelectric sensors report to their master node continuously, and master nodes push data to CocoSense every few minutes. Notifications and alerts update automatically as new readings arrive.',
  },
  {
    q: 'What should I do when a node shows offline?',
    a: 'If a node has been unresponsive for a while, message your plantation administrator to dispatch a technician for battery replacement or antenna realignment.',
  },
  {
    q: 'How is my Tree Health score calculated?',
    a: 'It blends live vibration readings, active pest alerts, and sensor uptime across all your monitored trees into a single status, refreshed on every sync cycle.',
  },
  {
    q: 'Who can I contact for hardware installation or maintenance?',
    a: 'Reach out to your assigned CocoSense field technician through the contact details below, or message your plantation administrator to schedule a site visit.',
  },
];

export const HelpPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Farm Owner Portal"
        subtitle="Help & Support"
        title="Help & Support"
        description="Quick answers to common questions about CocoSense, plus a direct line to your field support team for anything the FAQ doesn't cover."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-lg bg-[#141414] border border-[#262626] divide-y divide-[#262626] overflow-hidden">
            {FAQS.map((faq, i) => (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[#1A1A1A] transition-colors"
                  aria-expanded={openIndex === i}
                >
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#808080] flex-shrink-0 transition-transform ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openIndex === i && <p className="px-4 pb-4 text-xs text-[#A0A0A0] leading-relaxed">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-gradient-to-br from-[#1A1608] to-[#141414] border border-[#D4AF37]/30 p-5">
            <h3 className="text-sm font-bold text-white">Need more help?</h3>
            <p className="text-xs text-[#A0A0A0] mt-1.5 mb-4">
              Our support team is available Monday to Saturday, 7 AM to 7 PM.
            </p>
            <a
              href="mailto:support@cocosense.app"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black text-xs font-bold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Email Support
            </a>
          </div>

          <div className="rounded-lg bg-[#141414] border border-[#262626] p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="p-1.5 rounded bg-[#0E0E0E] border border-[#262626] text-[#D4AF37]">
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-sm font-bold text-white">Contact Details</h4>
            </div>
            <div className="space-y-2.5 text-xs text-[#A0A0A0]">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#808080]" /> support@cocosense.app
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[#808080]" /> +63 2 8888 0192
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#808080]" /> CocoSense Field Office, Quezon Province
              </div>
            </div>
          </div>
        </div>
      </div>

      <PageFooterNote
        icon={LifeBuoy}
        text="Most hardware issues (offline nodes, weak signal) are resolved by a field technician visit — message your plantation administrator to schedule one."
        action={
          <a
            href="mailto:support@cocosense.app"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D4AF37] hover:underline"
          >
            Email Support &rarr;
          </a>
        }
      />
    </div>
  );
};
