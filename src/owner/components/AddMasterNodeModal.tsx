import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Upload, X, Loader2, CheckCircle2, AlertTriangle, QrCode, RotateCcw } from 'lucide-react';
import { ownerApi, OwnerApiError } from '../api';

interface AddMasterNodeModalProps {
  onClose: () => void;
  /** Called once a node has been successfully linked to this owner's account. */
  onLinked: (node: any) => void;
}

type Mode = 'choose' | 'camera' | 'linking' | 'linked';

// "Add Master Node": lets an owner who already has an account attach
// ANOTHER hub to their mesh themselves, by scanning the same QR sticker
// Super Admin printed for it (src/superadmin/pages/SuperAdminQrCodesPage.tsx),
// instead of only being able to link one node at sign-up
// (src/owner/pages/SignupPage.tsx). Two ways to read the code, same as
// AvatarUpload's "camera roll or take a picture" pattern: a live camera
// scan (getUserMedia + jsQR on each frame) or browsing for a photo of
// the sticker (jsQR on a single decoded image). Either way we end up
// with the same signup-URL/nodeId text and hand it to POST
// /owner/nodes/link, which is the only place that actually validates
// and writes the link -- this component just gets a string out of a
// picture.
export const AddMasterNodeModal: React.FC<AddMasterNodeModalProps> = ({ onClose, onLinked }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [linkedNode, setLinkedNode] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Shared by both the camera loop and the file-upload path: everything
  // upstream of this just needs to produce whatever text was encoded in
  // the QR (a full "/owner/signup?nodeId=..." URL off a sticker, or a
  // bare node id) -- the server's extractNodeId() pulls the id out of
  // either shape, so no parsing needed here.
  const submitDecoded = useCallback(
    async (text: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      stopCamera();
      setError(null);
      setMode('linking');
      try {
        const res = await ownerApi.linkNode(text);
        setLinkedNode(res.node);
        setMode('linked');
        // Hand the newly-linked node up right away (not only when the
        // user clicks "Done") so a scan-scan-scan session where they hit
        // "Add Another" each time doesn't lose the earlier ones.
        onLinked(res.node);
      } catch (err) {
        setError(err instanceof OwnerApiError ? err.message : 'Could not link that master node. Please try again.');
        setMode('choose');
      } finally {
        submittingRef.current = false;
      }
    },
    [stopCamera, onLinked]
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setCameraStarting(true);
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview is not ready.');
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!video || !canvas || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height);
        if (code && code.data) {
          submitDecoded(code.data);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      setMode('choose');
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera access was denied. You can still upload a photo of the QR sticker instead.'
          : 'Could not start the camera. Try uploading a photo of the QR sticker instead.'
      );
    } finally {
      setCameraStarting(false);
    }
  }, [stopCamera, submitDecoded]);

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('Please choose an image file.');
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onerror = () => setError('Could not read that file.');
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => setError('That file is not a readable image.');
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data) {
            submitDecoded(code.data);
          } else {
            setError("No QR code was found in that photo. Try a clearer, well-lit picture of the sticker.");
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [submitDecoded]
  );

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded bg-[#141414] border border-[#262626] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">Add Master Node</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-[#1A1A1A] text-[#808080] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {mode !== 'linked' && (
            <p className="text-xs text-[#808080] leading-relaxed">
              Scan the QR sticker on the new hub, or upload a photo of it. It'll be added straight to your master node mesh.
            </p>
          )}

          {error && (
            <div className="rounded bg-[#2B1B1B] border border-[#F44336]/40 p-3 text-xs text-[#F44336] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'choose' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startCamera}
                disabled={cameraStarting}
                className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] hover:border-[#D4AF37]/50 text-white font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {cameraStarting ? (
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-[#D4AF37]" />
                )}
                Scan with Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] hover:border-[#D4AF37]/50 text-white font-semibold text-xs transition-colors"
              >
                <Upload className="w-5 h-5 text-[#D4AF37]" />
                Browse Files
              </button>
            </div>
          )}

          {mode === 'camera' && (
            <div className="space-y-3">
              <div className="relative w-full aspect-square rounded overflow-hidden bg-black border border-[#262626]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-6 border-2 border-[#D4AF37]/70 rounded pointer-events-none" />
              </div>
              <p className="text-center text-[11px] text-[#808080]">Point the camera at the master node's QR sticker…</p>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode('choose');
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {mode === 'linking' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
              <p className="text-xs text-[#808080]">Linking master node to your account…</p>
            </div>
          )}

          {mode === 'linked' && linkedNode && (
            <div className="space-y-4">
              <div className="py-6 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#4CAF50]" />
                <div>
                  <p className="font-mono text-sm font-bold text-white">{linkedNode.id}</p>
                  <p className="text-xs text-[#808080] mt-1">Added to your master node mesh.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('choose');
                    setLinkedNode(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#1A1A1A] hover:bg-[#222222] border border-[#262626] text-[#E0E0E0] font-semibold text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Add Another
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-black font-bold text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
