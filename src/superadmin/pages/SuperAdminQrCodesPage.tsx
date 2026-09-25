import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, PlusCircle, Printer, CheckCircle2, Radio, Loader2 } from 'lucide-react';
import { superAdminApi, SuperAdminMasterNode, SuperAdminApiError } from '../api';
import { PageHero } from '../../components/PageHero';
import { PageFooterNote } from '../../components/PageFooterNote';

// The Owner Portal is mounted at /owner/* in this same SPA (see
// src/main.tsx), so the QR just needs to point back at this app's own
// origin -- no separate "portal URL" env var to keep in sync.
function signupUrlFor(nodeId: string): string {
  return `${window.location.origin}/owner/signup?nodeId=${encodeURIComponent(nodeId)}`;
}

// One master node's printable QR sticker: the code itself, the node id
// underneath it (so it's still identifiable if the print smudges), and
// a per-card Print button that opens just this sticker in a new tab --
// keeps the printed page free of the console's sidebar/header chrome
// without needing a global print stylesheet.
const QrStickerCard: React.FC<{ node: SuperAdminMasterNode }> = ({ node }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const signupUrl = useMemo(() => signupUrlFor(node.id), [node.id]);
  const isAssigned = !!node.ownerName;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(signupUrl, { width: 320, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [signupUrl]);

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank', 'width=420,height=560');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${node.id} — CocoSense QR</title>
      <style>
        @page { margin: 16mm; }
        body { font-family: Arial, Helvetica, sans-serif; text-align: center; color: #0A0A0A; }
        img { width: 260px; height: 260px; margin: 12px auto; }
        h1 { font-size: 16px; letter-spacing: 0.05em; margin: 4px 0 0; }
        p { font-size: 11px; color: #444; margin: 4px 0 0; }
        .brand { font-size: 11px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; color: #8a6d1f; }
      </style>
      </head><body>
        <div class="brand">CocoSense</div>
        <img src="${dataUrl}" alt="QR code" />
        <h1>${node.id}</h1>
        <p>Scan to create your Farm Owner account and link this device.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="rounded border border-[#262626] bg-[#141414] p-5 flex flex-col items-center text-center space-y-3">
      <div className="w-full flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-[#D4AF37]">{node.id}</span>
        <span
          className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
            isAssigned
              ? 'bg-[#0F1F12] text-[#4CAF50] border border-[#4CAF50]/30'
              : 'bg-[#141414] text-[#808080] border border-[#404040]'
          }`}
        >
          {isAssigned ? 'Assigned' : 'Ready to print'}
        </span>
      </div>

      <div className="w-[176px] h-[176px] rounded bg-white flex items-center justify-center overflow-hidden">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code linking to sign-up for ${node.id}`} className="w-full h-full" />
        ) : (
          <Loader2 className="w-5 h-5 text-[#0A0A0A]/40 animate-spin" />
        )}
      </div>

      <p className="text-[10px] text-[#808080] leading-relaxed">
        {isAssigned ? (
          <>Linked to <span className="text-[#A0A0A0] font-medium">{node.ownerName}</span></>
        ) : (
          'Not yet linked to a Farm Owner account.'
        )}
      </p>

      <button
        type="button"
        onClick={handlePrint}
        disabled={!dataUrl}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#0A0A0A] hover:bg-[#1A1A1A] border border-[#262626] text-[11px] font-bold uppercase tracking-wider text-[#E0E0E0] transition-colors disabled:opacity-50"
      >
        <Printer className="w-3.5 h-3.5" /> Print Sticker
      </button>
    </div>
  );
};

export const SuperAdminQrCodesPage: React.FC = () => {
  const [nodes, setNodes] = useState<SuperAdminMasterNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    superAdminApi
      .nodes()
      .then((res) => setNodes(res || []))
      .catch((err) => setError(err instanceof SuperAdminApiError ? err.message : 'Failed to load master nodes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await superAdminApi.generateNode();
      setNodes((prev) => [res.node, ...prev]);
      setToast(`Generated ${res.node.id} — QR is ready to print.`);
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setError(err instanceof SuperAdminApiError ? err.message : 'Failed to generate a new master node.');
    } finally {
      setGenerating(false);
    }
  };

  const unassignedCount = nodes.filter((n) => !n.ownerName).length;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Super Admin Console"
        subtitle="Hardware Provisioning"
        title="Master Node QR Codes"
        description="Every master node gets a printable QR sticker. Stick it on the hub before it ships -- when a farmer scans it, the Create Account form on the Owner Portal links straight to that exact device, so no manual hardware assignment is needed afterward."
        accent="#D4AF37"
        actions={
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] disabled:opacity-60 text-black font-bold text-[11px] uppercase tracking-wider transition-colors"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
            Generate New Master Node
          </button>
        }
      />

      {error && <div className="rounded-xl bg-[#2B1B1B] border border-[#F44336]/40 p-4 text-xs text-[#F44336]">{error}</div>}

      <div className="px-3.5 py-1.5 rounded bg-[#1A1A1A] border border-[#333333] text-xs font-mono text-[#D4AF37] inline-flex items-center gap-2">
        <Radio className="w-3.5 h-3.5" />
        <span>
          <strong className="text-white">{unassignedCount}</strong> unassigned / {nodes.length} total
        </span>
      </div>

      {loading ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          Loading master nodes…
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          No master nodes yet. Generate one to print its QR code.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {nodes.map((node) => (
            <QrStickerCard key={node.id} node={node} />
          ))}
        </div>
      )}

      <PageFooterNote
        icon={QrCode}
        text="Scanning a QR takes the farmer to the Owner Portal's Create Account form, pre-linked to that node. If the QR was already used, they can still sign up normally and an admin can assign hardware afterward from Expand Nodes."
      />

      {toast && (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 rounded bg-[#141414] border border-[#D4AF37] text-white px-4 py-3 sm:px-5 sm:py-3.5 font-medium text-xs shadow-2xl flex items-center gap-3 max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
};
