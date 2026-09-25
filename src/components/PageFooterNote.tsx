import React from 'react';

interface PageFooterNoteProps {
  icon?: React.ComponentType<{ className?: string }>;
  /** Short contextual note tied to the page's content */
  text: React.ReactNode;
  /** Optional call-to-action rendered on the right */
  action?: React.ReactNode;
  accent?: string;
}

/**
 * Small contextual strip placed at the bottom of a page, analogous to
 * the "Diagnostic self-test CTA" / sampling-rate strips at the bottom
 * of the main Admin dashboard views. Each page passes its own icon,
 * note and (optional) action so the content stays page-specific.
 */
export const PageFooterNote: React.FC<PageFooterNoteProps> = ({ icon: Icon, text, action, accent = '#D4AF37' }) => {
  return (
    <div className="rounded-lg bg-[#141414] border border-[#262626] px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-xs text-[#808080] min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />}
        <span className="leading-relaxed">{text}</span>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};
