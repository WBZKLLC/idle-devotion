// /app/frontend/components/ui/useConfirmModal.ts
// Phase 3.19.11: Reusable confirm modal hook - eliminates boilerplate across screens
import React, { useState, useCallback, useMemo } from 'react';
import { ConfirmModal, ConfirmModalData } from './ConfirmModal';

type UseConfirmModalOptions = {
  /** Default busy state - can be overridden per-call */
  defaultBusy?: boolean;
};

type UseConfirmModalReturn = {
  /** Open the confirm modal with the given data */
  openConfirm: (data: ConfirmModalData) => void;
  /** Close the confirm modal programmatically */
  closeConfirm: () => void;
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Whether the modal is in busy state */
  isBusy: boolean;
  /** Set busy state manually (for async operations) */
  setBusy: (busy: boolean) => void;
  /** The modal JSX node - render this in your component */
  confirmNode: React.ReactElement;
};

/**
 * useConfirmModal - Reusable hook for confirmation modals
 * 
 * Usage:
 * ```tsx
 * const { openConfirm, confirmNode } = useConfirmModal();
 * 
 * const handleDelete = () => {
 *   openConfirm({
 *     title: 'Delete Item?',
 *     message: 'This cannot be undone.',
 *     tone: 'danger',
 *     confirmText: 'Delete',
 *     onConfirm: async () => {
 *       await deleteItem();
 *       toast.success('Deleted!');
 *     },
 *   });
 * };
 * 
 * return (
 *   <>
 *     <Button onPress={handleDelete} title="Delete" />
 *     {confirmNode}
 *   </>
 * );
 * ```
 */
export function useConfirmModal(options: UseConfirmModalOptions = {}): UseConfirmModalReturn {
  const [confirmData, setConfirmData] = useState<ConfirmModalData | null>(null);
  const [isBusy, setIsBusy] = useState(options.defaultBusy ?? false);

  const closeConfirm = useCallback(() => {
    setConfirmData(null);
    setIsBusy(false);
  }, []);

  const openConfirm = useCallback((data: ConfirmModalData) => {
    setConfirmData({
      ...data,
      onConfirm: async () => {
        // Close modal first to prevent double-tap
        setConfirmData(null);
        // Then execute the callback
        await data.onConfirm?.();
      },
      onCancel: () => {
        data.onCancel?.();
        closeConfirm();
      },
    });
  }, [closeConfirm]);

  const setBusy = useCallback((busy: boolean) => {
    setIsBusy(busy);
  }, []);

  const confirmNode = useMemo(() => 
    React.createElement(ConfirmModal, {
      visible: !!confirmData,
      data: confirmData,
      onClose: closeConfirm,
      busy: isBusy,
    }),
  [confirmData, closeConfirm, isBusy]);

  return {
    openConfirm,
    closeConfirm,
    isOpen: !!confirmData,
    isBusy,
    setBusy,
    confirmNode,
  };
}

export default useConfirmModal;
