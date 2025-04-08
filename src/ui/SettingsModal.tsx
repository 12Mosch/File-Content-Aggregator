import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "./i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ThemePreference } from "./vite-env.d";
import { applyTheme } from "./main"; // Assuming applyTheme is exported correctly

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(["common"]);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>("system");

  // Fetch initial theme preference when modal opens
  useEffect(() => {
    if (isOpen && window.electronAPI?.getThemePreference) {
      // Use void operator for floating promise
      void window.electronAPI
        .getThemePreference()
        .then((pref) => setCurrentTheme(pref))
        .catch((err) =>
          console.error("Error fetching theme pref in modal:", err),
        );
    }
  }, [isOpen]);

  // --- Fix: Wrap async logic for event handlers ---
  const handleLanguageChange = (newLang: string) => {
    if (supportedLngs.includes(newLang) && newLang !== i18n.language) {
      console.log(`UI: Changing language to ${newLang}`);
      // Use an IIAFE (Immediately Invoked Async Function Expression) or a separate async function
      const changeLang = async () => {
        try {
          await i18n.changeLanguage(newLang);
          if (window.electronAPI?.setLanguagePreference) {
            await window.electronAPI.setLanguagePreference(newLang);
          } else {
            console.warn("setLanguagePreference API not available.");
          }
          if (window.electronAPI?.notifyLanguageChanged) {
            window.electronAPI.notifyLanguageChanged(newLang);
          } else {
            console.warn("notifyLanguageChanged API not available.");
          }
        } catch (error) {
          console.error("Error changing language:", error);
        }
      };
      void changeLang(); // Use void operator for the IIAFE call
    }
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    if (newTheme !== currentTheme) {
      setCurrentTheme(newTheme);
      applyTheme(newTheme); // Apply theme immediately (assuming this is synchronous)
      if (window.electronAPI?.setThemePreference) {
        // Use an IIAFE or separate async function
        const setThemePref = async () => {
          try {
            await window.electronAPI.setThemePreference(newTheme);
          } catch (error) {
            console.error("Error setting theme preference:", error);
          }
        };
        void setThemePref(); // Use void operator
      } else {
        console.warn("setThemePreference API not available.");
      }
    }
  };
  // --- End Fix ---

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("settingsTitle")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="language-select">{t("languageLabel")}</Label>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language-select" className="w-full">
                <SelectValue placeholder={t("languageLabel")} />
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

          <div className="space-y-2">
            <Label>{t("themeLabel")}</Label>
            <RadioGroup
              value={currentTheme}
              onValueChange={handleThemeChange} // Pass the handler directly
              className="space-y-2 pt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="theme-light" />
                <Label htmlFor="theme-light" className="cursor-pointer font-normal">
                  {t("themeLight")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark" className="cursor-pointer font-normal">
                  {t("themeDark")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="theme-system" />
                <Label htmlFor="theme-system" className="cursor-pointer font-normal">
                  {t("themeSystem")}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t("closeButton")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
