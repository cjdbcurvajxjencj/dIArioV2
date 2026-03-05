import React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    console.error("The element #modal-root was not found in the DOM. Modals will not be rendered.");
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-[300] p-4 animate-fade-in" aria-modal="true" role="dialog" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <i className="fas fa-exclamation-triangle text-red-600" aria-hidden="true"></i>
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-slate-100" id="modal-title">
                    {title}
                </h3>
                <div className="mt-2">
                    <div className="text-sm text-slate-500 dark:text-slate-400">{message}</div>
                </div>
            </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onConfirm}
            >
                {confirmText}
            </button>
            <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={onCancel}
            >
                {cancelText}
            </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default ConfirmationModal;