import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MasterNode } from '../types';
import { PageHero } from '../components/PageHero';
import { PageFooterNote } from '../components/PageFooterNote';
import { QrCode, Printer, Download, Copy, CheckCircle2, Radio, ScanLine } from 'lucide-react';

interface MasterNodeQRViewProps {
  nodes: MasterNode[];
}

// Every printed QR code points here -- the Owner Portal's self-service
// Create Account page (src/owner/pages/SignupPage.tsx). Scanning it is
// meant to be the very first thing a new farm owner does with a freshly
// unboxed Master Node: land straight on account creation, no app store,
// no login screen first. ?node= just tags which physical unit was
// scanned (useful later for support / provisioning); the signup flow
// itself doesn't require it.
const OWNER_SIGNUP_PATH = '/owner/signup';

function signupUrlForNode(nodeId: string): string {
  const base = `${window.location.origin}${OWNER_SIGNUP_PATH}`;
  const params = new URLSearchParams({ node: nodeId, src: 'qr' });
  return `${base}?${params.toString()}`;
}

export const MasterNodeQRView: React.FC<MasterNodeQRViewProps> = ({ nodes }) => {
  // code.svg -> inline, printable vector markup. code.png -> lazily
  // generated on "Download" click (a raster copy is what most label/
  // sticker printer software actually wants to import).
  const [svgByNode, setSvgByNode] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGenerating(true);
    Promise.all(
      nodes.map((node) =>
        QRCode.toString(signupUrlForNode(node.id), {
          type: 'svg',
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        }).then((svg) => [node.id, svg] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setSvgByNode(Object.fromEntries(entries));
      })
      .catch(() => {
        if (cancelled) return;
        setSvgByNode({});
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodes]);

  const handleCopyLink = (nodeId: string) => {
    const url = signupUrlForNode(nodeId);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(nodeId);
        setTimeout(() => setCopiedId((prev) => (prev === nodeId ? null : prev)), 1800);
      })
      .catch(() => {
        // Clipboard permission denied / insecure context -- nothing to
        // recover to here; the QR + printed link text are still usable.
      });
  };

  const handleDownloadPng = async (nodeId: string) => {
    setDownloadingId(nodeId);
    try {
      const dataUrl = await QRCode.toDataURL(signupUrlForNode(nodeId), {
        width: 900,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `cocosense-${nodeId}-signup-qr.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Best-effort -- the on-screen/printable SVG still works even if
      // the PNG export fails for some reason.
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHero
          eyebrow="Hardware Provisioning"
          subtitle="One code per physical unit"
          title="Master Node QR Codes"
          description="A ready-to-print QR code for every Master Node in the mesh. Scanning it takes a new farm owner straight to the Create Account page in the Farm Owner Portal — no app, no login screen first."
          accent="#D4AF37"
          actions={
            <div className="flex items-center gap-2.5">
              <div className="px-3.5 py-1.5 rounded bg-[#1A1A1A] border border-[#333333] text-xs font-mono text-[#D4AF37] flex items-center gap-2">
                <Radio className="w-3.5 h-3.5" />
                <span>
                  <strong className="text-white">{nodes.length}</strong> Node{nodes.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={nodes.length === 0 || generating}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-3.5 h-3.5" />
                Print All
              </button>
            </div>
          }
        />
      </div>

      {nodes.length === 0 ? (
        <div className="print:hidden rounded bg-[#141414] border border-[#262626] p-10 text-center text-xs text-[#808080]">
          No master nodes provisioned yet. Allocate hardware to a Farm Owner first (Farm Owners &rarr; Register &amp;
          Dispatch Email), then come back here to print its QR code.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2 print:gap-6">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="print:break-inside-avoid rounded-lg bg-[#141414] border border-[#262626] p-5 shadow-xl flex flex-col items-center text-center space-y-4 print:bg-white print:border-black print:border print:shadow-none print:text-black"
            >
              <div className="w-full flex items-center justify-between text-left">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-white print:text-black truncate">{node.id}</p>
                  <p className="text-[10px] text-[#808080] print:text-black/70 truncate">
                    {node.sector ? `${node.sector} Sector` : node.name}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider print:hidden ${
                    node.online
                      ? 'bg-[#0F1F12] text-[#4CAF50] border border-[#4CAF50]/30'
                      : 'bg-[#2B1B1B] text-[#F44336] border border-[#F44336]/30'
                  }`}
                >
                  {node.online ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* QR code -- inline vector SVG so it prints crisp at any size */}
              <div className="w-40 h-40 sm:w-44 sm:h-44 p-2.5 bg-white rounded flex items-center justify-center flex-shrink-0">
                {svgByNode[node.id] ? (
                  <div
                    className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                    // Markup is our own QRCode.toString() output encoding a
                    // same-origin URL we built above -- never user input.
                    dangerouslySetInnerHTML={{ __html: svgByNode[node.id] }}
                  />
                ) : (
                  <QrCode className="w-10 h-10 text-[#D4AF37] animate-pulse" />
                )}
              </div>

              <div className="space-y-1">
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#D4AF37] print:text-black uppercase tracking-wider">
                  <ScanLine className="w-3.5 h-3.5" /> Scan to Create Your Account
                </p>
                <p className="text-[10px] text-[#606060] print:text-black/60 font-mono break-all">
                  {signupUrlForNode(node.id)}
                </p>
              </div>

              <div className="w-full flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => handleCopyLink(node.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-[#0A0A0A] border border-[#262626] hover:border-[#D4AF37]/50 text-[10px] text-[#A0A0A0] hover:text-white transition-colors"
                >
                  {copiedId === node.id ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4CAF50]" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPng(node.id)}
                  disabled={downloadingId === node.id}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-[#0A0A0A] border border-[#262626] hover:border-[#D4AF37]/50 text-[10px] text-[#A0A0A0] hover:text-white transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> {downloadingId === node.id ? 'Preparing…' : 'PNG'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="print:hidden">
        <PageFooterNote
          icon={QrCode}
          text="Print this page directly (Print All) for sticker-ready cutting guides, or download a high-resolution PNG per node for label-printer software. Every code encodes a link to the Farm Owner Portal's Create Account page."
        />
      </div>
    </div>
  );
};
