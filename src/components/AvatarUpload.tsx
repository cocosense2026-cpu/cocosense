import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';

const MAX_DIMENSION = 320; // px -- plenty for any chip/header size we render at
const JPEG_QUALITY = 0.85;

// Resizes/compresses an image file down to a small square-ish JPEG data
// URL entirely in the browser, so the request the server receives is
// always well under its 2MB cap (see validateAvatarDataUrl in
// server/utils.js) no matter how large the original photo was.
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that image.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface AvatarUploadProps {
  avatarUrl?: string | null;
  initials?: string | null;
  color?: string | null;
  textColor?: string;
  name?: string | null;
  /** Called with a data URL once a picture is chosen/compressed, or null when removed. */
  onChange: (dataUrl: string | null) => void;
  size?: 'lg' | 'xl';
  disabled?: boolean;
}

// Drop-in "click the picture to change it" widget used on every
// profile/settings page (admin, super admin, farm owner). Handles the
// file picker, client-side resize/compress, and a remove button --
// callers just wire onChange into whatever local form state they're
// about to PATCH to the server.
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  initials,
  color,
  textColor,
  name,
  onChange,
  size = 'lg',
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <Avatar
          avatarUrl={avatarUrl}
          initials={initials}
          color={color}
          textColor={textColor}
          name={name}
          size={size}
        />
        {processing && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || processing}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1A1A1A] hover:bg-[#222] border border-[#333333] text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" />
            {avatarUrl ? 'Change Picture' : 'Upload Picture'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={disabled || processing}
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2B1B1B] hover:bg-[#331F1F] border border-[#F44336]/30 text-[#F44336] text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#808080]">PNG, JPEG, WEBP, or GIF. Max 2MB.</p>
        {error && <p className="text-[11px] text-[#F44336]">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};
