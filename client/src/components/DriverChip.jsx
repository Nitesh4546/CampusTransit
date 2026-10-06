import React, { useState } from 'react';
import { User, Bus, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal.jsx';

/**
 * DriverChip
 * - Circular 40px photo with initials fallback
 * - Driver name & small Bus # label
 * - Clicking the avatar opens a Modal showing the full-size photo and name
 * - Styled with Chrome tokens, light & dark mode, responsive down to 360px
 */
export default function DriverChip({
  driver,
  busLabel,
  compact = false,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const driverName = (typeof driver === 'object' ? driver?.name : driver) || 'Assigned Driver';
  const photoUrl = typeof driver === 'object' ? driver?.photoUrl : null;

  // Extract initials
  const initials = driverName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'D';

  const handleAvatarClick = (e) => {
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <div
        className={`flex items-center gap-2.5 min-w-0 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Circular Avatar (40px) */}
        <button
          type="button"
          onClick={handleAvatarClick}
          className="relative w-10 h-10 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-950/80 border-2 border-surface-200 dark:border-surface-700 flex-shrink-0 flex items-center justify-center hover:ring-2 hover:ring-primary-500/40 transition-all cursor-pointer shadow-soft-xs"
          title={`View photo of ${driverName}`}
        >
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={driverName}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold text-xs text-primary-800 dark:text-primary-200">
              {initials}
            </span>
          )}
        </button>

        {/* Text Information */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-surface-900 dark:text-surface-100 truncate block">
              {driverName}
            </span>
            {photoUrl && (
              <CheckCircle2
                className="w-3 h-3 text-emerald-500 flex-shrink-0"
                title="Verified live driver photo"
              />
            )}
          </div>
          {busLabel && (
            <div className="text-[10px] text-surface-500 dark:text-surface-400 font-mono truncate">
              {busLabel}
            </div>
          )}
        </div>
      </div>

      {/* Driver Photo & Verification Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Driver Verification"
        subtitle="Active transit vehicle operator"
        maxWidth="max-w-sm"
      >
        <div className="space-y-5 text-center font-sans">
          {/* Large Photo */}
          <div className="w-48 h-48 mx-auto rounded-3xl overflow-hidden bg-surface-100 dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-700 shadow-soft-md flex items-center justify-center">
            {photoUrl && !imgError ? (
              <img
                src={photoUrl}
                alt={driverName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold text-2xl flex items-center justify-center mb-2">
                  {initials}
                </div>
                <div className="text-xs text-surface-400">No live photo available</div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
                {driverName}
              </h3>
              {photoUrl && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" title="Verified live driver" />
              )}
            </div>
            {busLabel && (
              <div className="text-xs font-mono text-surface-500 dark:text-surface-400">
                {busLabel}
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/80 dark:border-surface-700/80 text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed">
            Live photo captured by driver at trip startup. Verified and automatically removed when trip terminates.
          </div>
        </div>
      </Modal>
    </>
  );
}
