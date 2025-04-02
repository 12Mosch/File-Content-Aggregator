import React from "react";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "./i18n"; // Import supported languages
import "./SettingsModal.css"; // Import modal CSS

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(['common']); // Use common namespace

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = event.target.value;
    if (supportedLngs.includes(newLang) && newLang !== i18n.language) {
      console.log(`UI: Changing language to ${newLang}`);
      try {
        // 1. Change language in the renderer's i18next instance
        await i18n.changeLanguage(newLang);
        // 2. Save preference via IPC
        if (window.electronAPI?.setLanguagePreference) {
          await window.electronAPI.setLanguagePreference(newLang);
        } else {
          console.warn("setLanguagePreference API not available.");
        }
        // 3. Notify main process of the change
        if (window.electronAPI?.notifyLanguageChanged) {
          window.electronAPI.notifyLanguageChanged(newLang);
        } else {
          console.warn("notifyLanguageChanged API not available.");
        }
      } catch (error) {
        console.error("Error changing language:", error);
        // Optionally show an error message to the user
      }
    }
  };

  // Don't render anything if the modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    // Modal overlay
    <div className="settings-modal-overlay" onClick={onClose}>
      {/* Modal content box - stop propagation to prevent closing when clicking inside */}
      <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="settings-modal-header">
          <h2>{t('settingsTitle')}</h2>
          <button onClick={onClose} className="settings-modal-close-btn" aria-label={t('closeButton')}>
            &times; {/* Simple 'X' close symbol */}
          </button>
        </div>

        {/* Modal Body */}
        <div className="settings-modal-body">
          <div className="settings-group">
            <label htmlFor="language-select">{t('languageLabel')}</label>
            <select
              id="language-select"
              value={i18n.language} // Current language
              onChange={handleLanguageChange}
              className="settings-language-select"
            >
              {supportedLngs.map((lng) => (
                <option key={lng} value={lng}>
                  {/* Translate language name using key like 'lang_en' */}
                  {t(`lang_${lng}`)}
                </option>
              ))}
            </select>
          </div>
          {/* Add more settings groups here if needed */}
        </div>

        {/* Modal Footer (Optional) */}
        {/* <div className="settings-modal-footer">
          <button onClick={onClose}>{t('closeButton')}</button>
        </div> */}
      </div>
    </div>
  );
};

export default SettingsModal;
