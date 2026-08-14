import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput } from '@/components/ui/primitives';

/**
 * Reads standard grocery barcodes (UPC/EAN) as well as QR codes, straight
 * from the phone's camera — ZXing decodes video frames itself rather than
 * relying on the native BarcodeDetector API, which iOS Safari still doesn't
 * ship, so this works on the phone this app is actually used from.
 */
export function BarcodeScanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open || !videoRef.current) return;
    setError(null);
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result, _err, controls) => {
        stopRef.current = () => controls.stop();
        if (result && !cancelled) {
          cancelled = true;
          controls.stop();
          onScan(result.getText());
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? "Camera access was denied — allow it in your browser's site settings, or type the number in below."
            : 'Could not start the camera — type the number in below instead.',
        );
      });

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submitManual = () => {
    if (!manual.trim()) return;
    onScan(manual.trim());
    setManual('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Scan a barcode">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>
        <p className="text-center text-xs text-ink-muted">Hold the barcode steady in the frame.</p>
        {error ? <p className="text-xs text-critical">{error}</p> : null}

        <div className="flex items-end gap-2 border-t border-line pt-4">
          <Field label="Or type the number" className="flex-1">
            <TextInput
              inputMode="numeric"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              placeholder="012345678905"
            />
          </Field>
          <button type="button" className="btn-primary" disabled={!manual.trim()} onClick={submitManual}>
            Use
          </button>
        </div>
      </div>
    </Modal>
  );
}
