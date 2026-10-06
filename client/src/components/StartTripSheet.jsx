import React, { useState } from 'react';
import { Bus, Route as RouteIcon, User, Check, ShieldAlert, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import Drawer from './ui/Drawer.jsx';
import DriverPhotoCapture from './DriverPhotoCapture.jsx';
import { driverApi } from '../api/index.js';

/**
 * StartTripSheet
 * 3-step or guided trip startup sheet:
 * 1. Review: driver details, bus, route
 * 2. Photo: live verification capture
 * 3. Confirm: privacy disclosure & start live trip
 */
export default function StartTripSheet({
  isOpen,
  onClose,
  driver,
  bus,
  route,
  onStartTrip,
}) {
  const [acceptedPhotoBlob, setAcceptedPhotoBlob] = useState(null);
  const [acceptedPhotoUrl, setAcceptedPhotoUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handlePhotoSelected = (blob, previewUrl) => {
    setAcceptedPhotoBlob(blob);
    setAcceptedPhotoUrl(previewUrl);
    setSubmitError(null);
  };

  const handleResetPhoto = () => {
    if (acceptedPhotoUrl) URL.revokeObjectURL(acceptedPhotoUrl);
    setAcceptedPhotoBlob(null);
    setAcceptedPhotoUrl(null);
    setSubmitError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleResetPhoto();
    onClose();
  };

  const handleConfirmAndStart = async () => {
    if (!acceptedPhotoBlob) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload photo via driverApi multipart
      const formData = new FormData();
      formData.append('photo', acceptedPhotoBlob, 'driver-photo.jpg');

      const uploadRes = await driverApi.uploadPhoto(formData);
      const photoId = uploadRes.data?.photoId;

      if (!photoId) {
        throw new Error('Failed to acquire verification photo ID from server.');
      }

      // 2. Delegate to parent to emit driver:trip:start / tripsApi.start, request wakeLock & start location
      await onStartTrip(photoId);

      handleClose();
    } catch (err) {
      console.error('Trip start sequence failed:', err);
      const errorMsg =
        err.response?.data?.error?.message ||
        err.message ||
        'Could not complete photo verification and trip start. Please try again.';
      setSubmitError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Start Live Transit Trip"
      subtitle="Complete driver verification before broadcasting telemetry"
    >
      <div className="space-y-6 text-sm font-sans">
        {/* STEP 1: REVIEW TRIP SPECIFICATIONS */}
        <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
          <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Trip Assignment Review</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs">
              <span className="text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                <span>Driver</span>
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100">
                {driver?.name || 'Assigned Driver'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs">
              <span className="text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5 text-google-green" />
                <span>Assigned Bus</span>
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100 font-mono">
                {bus?.name ? `${bus.name} (${bus.plateNo})` : bus?.plateNo || '—'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs">
              <span className="text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                <RouteIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Route Line</span>
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100">
                {route?.name || '—'}
              </span>
            </div>
          </div>
        </section>

        {/* STEP 2: PHOTO CAPTURE & VERIFICATION */}
        <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Live Photo Verification</span>
            </div>
            {acceptedPhotoBlob && (
              <span className="badge-success text-[10px]">
                <Check className="w-3 h-3" />
                <span>Photo Ready</span>
              </span>
            )}
          </div>

          {acceptedPhotoUrl ? (
            <div className="p-4 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-200 dark:border-emerald-800/70 text-center space-y-3">
              <div className="w-36 h-36 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-soft-sm">
                <img
                  src={acceptedPhotoUrl}
                  alt="Verified Driver Selfie"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Photo captured & verified
              </div>
              <button
                type="button"
                onClick={handleResetPhoto}
                disabled={isSubmitting}
                className="btn-secondary rounded-full py-1.5 px-4 text-xs font-semibold"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <DriverPhotoCapture
              isOpen={isOpen}
              step="photo"
              onPhotoSelected={handlePhotoSelected}
              onCancel={handleClose}
            />
          )}
        </section>

        {/* STEP 3: PRIVACY NOTICE & CONFIRMATION */}
        <section className="p-4 rounded-3xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/70 space-y-2">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
              Your name and photo will be visible to students while this trip is live. The photo is deleted when the trip ends.
            </div>
          </div>
        </section>

        {/* Error notification if submission failed */}
        {submitError && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-google-red flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{submitError}</div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            id="confirm-start-trip-btn"
            onClick={handleConfirmAndStart}
            disabled={!acceptedPhotoBlob || isSubmitting}
            className="w-full btn-primary py-3 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-soft-sm disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Starting Live Trip...</span>
              </>
            ) : (
              <>
                <span>Confirm and start trip</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
