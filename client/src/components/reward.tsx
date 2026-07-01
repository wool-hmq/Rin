import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { fetchR2Json } from '../utils/r2';
import { R2_ENDPOINTS } from '../config/r2';

// 请替换为你的R2中存放的赞助信息JSON地址
const SPONSOR_R2_URL = "https://r2page.jiaoblog.dpdns.org/sponsor.json";

type SponsorData = {
  btc: {
    address: string;
    qr: string;
    label?: string;
  };
};

export function Reward() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [sponsor, setSponsor] = useState<SponsorData | null>(null);

  useEffect(() => {
    fetchR2Json<SponsorData>(SPONSOR_R2_URL).then(data => setSponsor(data));
  }, []);

  if (!sponsor) return null;

  const { btc } = sponsor;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
      >
        <span>☕</span> {t('sponsor.title')}
      </button>

      <ReactModal
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            padding: '0',
            border: 'none',
            borderRadius: '20px',
            background: 'transparent',
            maxWidth: '90vw',
            maxHeight: '90vh',
          },
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
          },
        }}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-[340px] max-w-full shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('sponsor.title')}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('sponsor.btc')}</p>
            <img
              src={btc.qr}
              alt="BTC QR"
              className="w-48 h-48 object-contain mx-auto rounded-lg border border-gray-200 dark:border-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M9 9h6v6H9z"/%3E%3C/svg%3E';
              }}
            />
            <p className="text-xs text-gray-400 mt-2 break-all">{btc.address}</p>
            {btc.label && <p className="text-xs text-gray-400 mt-1">{btc.label}</p>}
          </div>
        </div>
      </ReactModal>
    </>
  );
}
