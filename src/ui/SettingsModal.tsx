import React from "react";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "./i18n";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, // <-- Import DialogDescription
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(['common']);

  const handleLanguageChange = async (newLang: string) => {
    if (supportedLngs.includes(newLang) && newLang !== i18n.language) {
      console.log(`UI: Changing language to ${newLang}`);
      try {
        await i18n.changeLanguage(newLang);
        if (window.electronAPI?.setLanguagePreference) {
          await window.electronAPI.setLanguagePreference(newLang);
        } else { console.warn("setLanguagePreference API not available."); }
        if (window.electronAPI?.notifyLanguageChanged) {
          window.electronAPI.notifyLanguageChanged(newLang);
        } else { console.warn("notifyLanguageChanged API not available."); }
      } catch (error) { console.error("Error changing language:", error); }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {/* Add DialogDescription here */}
        <DialogHeader>
          <DialogTitle>{t('settingsTitle')}</DialogTitle>
          {/* Add the description using the translation key */}
          <DialogDescription>
            {t('settingsDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="language-select" className="text-right">
              {t('languageLabel')}
            </Label>
            <Select
              value={i18n.language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger id="language-select" className="col-span-3">
                <SelectValue placeholder={t('languageLabel')} />
              </SelectTrigger>
              <SelectContent>
                {supportedLngs.map((lng) => (
                  <SelectItem key={lng} value={lng}>
                    {t(`lang_${lng}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Add more settings groups here if needed */}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t('closeButton')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
