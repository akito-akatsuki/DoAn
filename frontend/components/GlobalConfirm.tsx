"use client";
import { useEffect, useState } from "react";

type ConfirmConfig = {
  message: string;
  onConfirm: () => void;
};

// Biến toàn cục để lưu hàm kích hoạt Modal
let confirmAction: (config: ConfirmConfig) => void;

export const showConfirm = (message: string, onConfirm: () => void) => {
  if (confirmAction) {
    confirmAction({ message, onConfirm });
  }
};

export default function GlobalConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    confirmAction = (newConfig: ConfirmConfig) => {
      setConfig(newConfig);
      setIsOpen(true);
    };
  }, []);

  if (!isOpen || !config) return null;

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white dark:bg-[#262626] rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <h3 className="text-[17px] font-bold text-gray-900 dark:text-gray-100 mb-1.5">
            Xác nhận
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            {config.message}
          </p>
        </div>
        <div className="flex border-t border-gray-200 dark:border-neutral-800">
          <button
            className="flex-1 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors border-r border-gray-200 dark:border-neutral-800"
            onClick={() => setIsOpen(false)}
          >
            Hủy
          </button>
          <button
            className="flex-1 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            onClick={() => {
              setIsOpen(false);
              config.onConfirm();
            }}
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
}
