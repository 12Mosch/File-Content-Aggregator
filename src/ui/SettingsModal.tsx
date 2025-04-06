import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "./i18n"; // Correct path: same directory
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ThemePreference } from "./vite-env.d";
import { applyTheme } from "./main";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(['common']);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>('system');

  // Fetch initial theme preference when modal opens
  useEffect(() => {
    if (isOpen && window.electronAPI?.getThemePreference) {
      window.electronAPI.getThemePreference()
        .then(pref => setCurrentTheme(pref))
        .catch(err => console.error("Error fetching theme pref in modal:", err));
    }
  }, [isOpen]);

  const handleLanguageChange = async (newLang: string) => {
      if (supportedLngs.includes(newLang) && newLang !== i18n.language) {
        console.log(`UI: Changing language to ${newLang}`);
        try {
            await i18n.changeLanguage(newLang);
            if (window.electronAPI?.setLanguagePreference) await window.electronAPI.setLanguagePreference(newLang);
            else console.warn("setLanguagePreference API not available.");
            if (window.electronAPI?.notifyLanguageChanged) window.electronAPI.notifyLanguageChanged(newLang);
            else console.warn("notifyLanguageChanged API not available.");
        } catch (error) { console.error("Error changing language:", error); }
    }
   };

  // Handler for theme change
  const handleThemeChange = async (newTheme: ThemePreference) => {
    if (newTheme !== currentTheme) {
        setCurrentTheme(newTheme);
        applyTheme(newTheme); // Apply theme immediately
        if (window.electronAPI?.setThemePreference) {
            try { await window.electronAPI.setThemePreference(newTheme); }
            catch (error) { console.error("Error setting theme preference:", error); }
        } else { console.warn("setThemePreference API not available."); }
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
        <DialogHeader>
          <DialogTitle>{t('settingsTitle')}</DialogTitle>
          <DialogDescription>{t('settingsDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Language Selection */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="language-select" className="text-right">
              {t('languageLabel')}
            </Label>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language-select" className="col-span-3">
                <SelectValue placeholder={t('languageLabel')} />
              </SelectTrigger>
              <SelectContent>
                {supportedLngs.map((lng) => ( <SelectItem key={lng} value={lng}>{t(`lang_${lng}`)}</SelectItem> ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme Selection */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">
                {t('themeLabel')}
            </Label>
            <RadioGroup
                value={currentTheme}
                onValueChange={handleThemeChange}
                className="col-span-3 space-y-2"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="theme-light" />
                    <Label htmlFor="theme-light" className="cursor-pointer">{t('themeLight')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="theme-dark" />
                    <Label htmlFor="theme-dark" className="cursor-pointer">{t('themeDark')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="theme-system" />
                    <Label htmlFor="theme-system" className="cursor-pointer">{t('themeSystem')}</Label>
                </div>
            </RadioGroup>
          </div>
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
