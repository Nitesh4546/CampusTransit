import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Upload, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import useCamera from '../hooks/useCamera.js';

/**
 * DriverPhotoCapture
 * - Uses useCamera hook for robust getUserMedia lifecycle management
 * - Always renders the <video> element to prevent blank preview bugs
 * - Mirrored live video preview with circular face guide overlay
 * - Square center-crop & 480x480 canvas export as JPEG (quality ~0.82)
 * - Fallback file input with capture="user"
 * - Automatically stops camera when photo is captured or component closes
 */
export default function DriverPhotoCapture({
  onPhotoSelected,
  onCancel,
  isOpen = true,
  step = 'photo'
}) {
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryActive, setRetryActive] = useState(true);
  const fileInputRef = useRef(null);

  // Active condition: sheet open, photo step, and no photo captured yet
  const active = isOpen && step === 'photo' && !capturedBlob && retryActive;
  const { videoRef, status, error: cameraError, stop } = useCamera(active);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Square center crop & resize on 480x480 canvas
  const processImageToBlob = (source, srcWidth, srcHeight) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const minDim = Math.min(srcWidth, srcHeight);
    const sx = (srcWidth - minDim) / 2;
    const sy = (srcHeight - minDim) / 2;

    // Draw square cropped image onto 480x480 canvas
    ctx.drawImage(source, sx, sy, minDim, minDim, 0, 0, 480, 480);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas export to blob failed'));
        },
        'image/jpeg',
        0.82
      );
    });
  };

  // Capture frame from live video
  const handleCaptureVideo = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setIsProcessing(true);
    try {
      const blob = await processImageToBlob(video, video.videoWidth, video.videoHeight);
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setPreviewUrl(url);
      stop(); // Stop camera immediately after snapshot
    } catch (err) {
      console.error('Error capturing photo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback: handle file input change
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const img = new Image();
      const tempUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = tempUrl;
      });

      const blob = await processImageToBlob(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(tempUrl);

      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setPreviewUrl(url);
      stop(); // Stop camera when file is chosen
    } catch (err) {
      console.error('Error processing uploaded file:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Retake photo: clear captured blob to restart camera
  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setCapturedBlob(null);
    setRetryActive(true);
  };

  // Confirm photo selection
  const handleConfirmPhoto = () => {
    if (capturedBlob && onPhotoSelected) {
      onPhotoSelected(capturedBlob, previewUrl);
    }
  };

  // Retry camera after error
  const handleTryAgain = () => {
    setRetryActive(false);
    setTimeout(() => setRetryActive(true), 50);
  };

  const getErrorMessage = (err) => {
    if (!err) return 'Unable to access camera. Please use the upload option below.';
    if (err.message === 'CAMERA_UNSUPPORTED') {
      return 'Camera requires a secure connection (HTTPS) or is not supported by your browser.';
    }
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission denied. Allow camera access or upload a file below.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No camera found on this device. Please upload a photo instead.';
    }
    return err.message || 'Unable to access camera. Please use the upload option below.';
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="text-center">
        <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
          Driver Live Verification Photo
        </h3>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
          Take a clear selfie. This photo will be shown to students while your trip is live.
        </p>
      </div>

      {/* Viewport Card */}
      <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 aspect-square rounded-2xl overflow-hidden bg-black border-2 border-surface-200 dark:border-surface-700 shadow-soft-md flex items-center justify-center">
        {previewUrl ? (
          // Preview of captured photo
          <img
            src={previewUrl}
            alt="Driver Photo Preview"
            className="w-full aspect-square object-cover rounded-2xl"
          />
        ) : (
          <>
            {/* The video element is ALWAYS rendered while in photo step */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-square object-cover scale-x-[-1] bg-black rounded-2xl"
            />

            {/* Overlay: Starting camera */}
            {status === 'starting' && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-white space-y-2 z-10">
                <RefreshCw className="w-7 h-7 text-primary-400 animate-spin" />
                <span className="text-xs font-semibold">Starting camera...</span>
              </div>
            )}

            {/* Overlay: Error */}
            {status === 'error' && (
              <div className="absolute inset-0 bg-surface-900/95 flex flex-col items-center justify-center p-4 text-center text-white space-y-3 z-10">
                <AlertCircle className="w-8 h-8 text-google-red" />
                <div className="text-xs text-surface-200 max-w-xs leading-relaxed">
                  {getErrorMessage(cameraError)}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="btn-secondary text-xs py-1.5 px-3.5 rounded-full"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary text-xs py-1.5 px-3.5 rounded-full"
                  >
                    Choose file
                  </button>
                </div>
              </div>
            )}

            {/* Circular Face Guide Overlay while camera is live */}
            {status === 'live' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <div className="w-48 h-48 rounded-full border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
          </>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden fallback file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/*"
        capture="user"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera note */}
      <div className="text-[11px] text-surface-500 dark:text-surface-400 text-center flex items-center justify-center gap-1.5 px-2">
        <ShieldAlert className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
        <span>Camera requires HTTPS or localhost. Center your face in the circle.</span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {previewUrl ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary rounded-full py-2 px-5 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retake</span>
            </button>
            <button
              type="button"
              id="confirm-use-photo-btn"
              onClick={handleConfirmPhoto}
              className="btn-primary rounded-full py-2 px-6 text-xs font-bold flex items-center gap-1.5 shadow-soft-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use this photo</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              id="capture-live-photo-btn"
              onClick={handleCaptureVideo}
              disabled={status !== 'live' || isProcessing}
              className="btn-primary rounded-full py-2.5 px-6 text-xs font-bold flex items-center gap-2 shadow-soft-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-subtle rounded-full py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
              title="Upload existing photo file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

