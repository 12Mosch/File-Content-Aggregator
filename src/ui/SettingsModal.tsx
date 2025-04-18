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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemePreference, ExportFormat } from "./vite-env.d";
import { applyTheme } from "./main";
import { CacheSettings } from "./components/CacheSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(["common", "results"]);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>("system");
  const [defaultExportFormat, setDefaultExportFormat] =
    useState<ExportFormat>("txt");
  const [fuzzySearchBooleanEnabled, setFuzzySearchBooleanEnabled] =
    useState<boolean>(true);
  const [fuzzySearchNearEnabled, setFuzzySearchNearEnabled] =
    useState<boolean>(true);
  const [wholeWordMatchingEnabled, setWholeWordMatchingEnabled] =
    useState<boolean>(false);

  // Fetch initial theme and export format preferences when modal opens
  useEffect(() => {
    if (isOpen) {
      if (window.electronAPI?.getThemePreference) {
        void window.electronAPI
          .getThemePreference()
          .then((pref) => setCurrentTheme(pref))
          .catch((err) =>
            console.error("Error fetching theme pref in modal:", err)
          );
      }
      if (window.electronAPI?.getDefaultExportFormat) {
        void window.electronAPI
          .getDefaultExportFormat()
          .then((format) => setDefaultExportFormat(format))
          .catch((err) =>
            console.error("Error fetching default export format:", err)
          );
      }
      if (window.electronAPI?.getFuzzySearchBooleanEnabled) {
        void window.electronAPI
          .getFuzzySearchBooleanEnabled()
          .then((enabled) => setFuzzySearchBooleanEnabled(enabled))
          .catch((err) =>
            console.error("Error fetching fuzzy search Boolean setting:", err)
          );
      }
      if (window.electronAPI?.getFuzzySearchNearEnabled) {
        void window.electronAPI
          .getFuzzySearchNearEnabled()
          .then((enabled) => setFuzzySearchNearEnabled(enabled))
          .catch((err) =>
            console.error("Error fetching fuzzy search NEAR setting:", err)
          );
      }
      if (window.electronAPI?.getWholeWordMatchingEnabled) {
        void window.electronAPI
          .getWholeWordMatchingEnabled()
          .then((enabled) => setWholeWordMatchingEnabled(enabled))
          .catch((err) =>
            console.error("Error fetching whole word matching setting:", err)
          );
      }
    }
  }, [isOpen]);

  const handleLanguageChange = (newLang: string) => {
    if (supportedLngs.includes(newLang) && newLang !== i18n.language) {
      console.log(`UI: Changing language to ${newLang}`);
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
      void changeLang();
    }
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    if (newTheme !== currentTheme) {
      setCurrentTheme(newTheme);
      applyTheme(newTheme);
      if (window.electronAPI?.setThemePreference) {
        const setThemePref = async () => {
          try {
            await window.electronAPI.setThemePreference(newTheme);
          } catch (error) {
            console.error("Error setting theme preference:", error);
          }
        };
        void setThemePref();
      } else {
        console.warn("setThemePreference API not available.");
      }
    }
  };

  // Handler for changing default export format
  const handleExportFormatChange = (newFormat: string) => {
    const format = newFormat as ExportFormat;
    if (format !== defaultExportFormat) {
      setDefaultExportFormat(format);
      if (window.electronAPI?.setDefaultExportFormat) {
        const setFormatPref = async () => {
          try {
            await window.electronAPI.setDefaultExportFormat(format);
          } catch (error) {
            console.error("Error setting default export format:", error);
          }
        };
        void setFormatPref();
      } else {
        console.warn("setDefaultExportFormat API not available.");
      }
    }
  };

  // Handler for changing fuzzy search in Boolean queries setting
  const handleFuzzySearchBooleanChange = (checked: boolean) => {
    setFuzzySearchBooleanEnabled(checked);
    if (window.electronAPI?.setFuzzySearchBooleanEnabled) {
      const setFuzzySearchPref = async () => {
        try {
          await window.electronAPI.setFuzzySearchBooleanEnabled(checked);
        } catch (error) {
          console.error(
            "Error setting fuzzy search Boolean preference:",
            error
          );
        }
      };
      void setFuzzySearchPref();
    } else {
      console.warn("setFuzzySearchBooleanEnabled API not available.");
    }
  };

  // Handler for changing fuzzy search in NEAR function setting
  const handleFuzzySearchNearChange = (checked: boolean) => {
    setFuzzySearchNearEnabled(checked);
    if (window.electronAPI?.setFuzzySearchNearEnabled) {
      const setFuzzySearchPref = async () => {
        try {
          await window.electronAPI.setFuzzySearchNearEnabled(checked);
        } catch (error) {
          console.error("Error setting fuzzy search NEAR preference:", error);
        }
      };
      void setFuzzySearchPref();
    } else {
      console.warn("setFuzzySearchNearEnabled API not available.");
    }
  };

  // Handler for changing whole word matching setting
  const handleWholeWordMatchingChange = (checked: boolean) => {
    setWholeWordMatchingEnabled(checked);
    if (window.electronAPI?.setWholeWordMatchingEnabled) {
      const setWholeWordMatchingPref = async () => {
        try {
          await window.electronAPI.setWholeWordMatchingEnabled(checked);
          // Dispatch a custom event to notify other components of the change
          window.dispatchEvent(new Event("whole-word-matching-changed"));
        } catch (error) {
          console.error("Error setting whole word matching preference:", error);
        }
      };
      void setWholeWordMatchingPref();
    } else {
      console.warn("setWholeWordMatchingEnabled API not available.");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("common:settingsTitle")}</DialogTitle>
          <DialogDescription>
            {t("common:settingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="py-4">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="general">
              {t("common:generalSettings")}
            </TabsTrigger>
            <TabsTrigger value="search">
              {t("common:searchSettings")}
            </TabsTrigger>
            <TabsTrigger value="cache">{t("common:cacheSettings")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Language Setting */}
            <div className="space-y-2">
              <Label htmlFor="language-select">
                {t("common:languageLabel")}
              </Label>
              <Select
                value={i18n.language}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger id="language-select" className="w-full">
                  <SelectValue placeholder={t("common:languageLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {supportedLngs.map((lng) => (
                    <SelectItem key={lng} value={lng}>
                      {t(`common:lang_${lng}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Theme Setting */}
            <div className="space-y-2">
              <Label>{t("common:themeLabel")}</Label>
              <RadioGroup
                value={currentTheme}
                onValueChange={handleThemeChange}
                className="space-y-2 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="theme-light" />
                  <Label
                    htmlFor="theme-light"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:themeLight")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="theme-dark" />
                  <Label
                    htmlFor="theme-dark"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:themeDark")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="system" id="theme-system" />
                  <Label
                    htmlFor="theme-system"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:themeSystem")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Default Export Format Setting */}
            <div className="space-y-2">
              <Label htmlFor="default-export-format-select">
                {t("common:defaultExportFormatLabel")}
              </Label>
              <Select
                value={defaultExportFormat}
                onValueChange={handleExportFormatChange}
              >
                <SelectTrigger
                  id="default-export-format-select"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={t("common:defaultExportFormatLabel")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="txt">
                    {t("results:exportFormatTXT")}
                  </SelectItem>
                  <SelectItem value="csv">
                    {t("results:exportFormatCSV")}
                  </SelectItem>
                  <SelectItem value="json">
                    {t("results:exportFormatJSON")}
                  </SelectItem>
                  <SelectItem value="md">
                    {t("results:exportFormatMD")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* Fuzzy Search Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">
                {t("common:fuzzySearchSettingsTitle")}
              </h3>

              {/* Fuzzy Search in Boolean Queries Setting */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fuzzy-search-boolean-enabled"
                    checked={fuzzySearchBooleanEnabled}
                    onCheckedChange={handleFuzzySearchBooleanChange}
                  />
                  <Label
                    htmlFor="fuzzy-search-boolean-enabled"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:fuzzySearchBooleanEnabledLabel")}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {t("common:fuzzySearchBooleanDescription")}
                </p>
              </div>

              {/* Fuzzy Search in NEAR Function Setting */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fuzzy-search-near-enabled"
                    checked={fuzzySearchNearEnabled}
                    onCheckedChange={handleFuzzySearchNearChange}
                  />
                  <Label
                    htmlFor="fuzzy-search-near-enabled"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:fuzzySearchNearEnabledLabel")}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {t("common:fuzzySearchNearDescription")}
                </p>
              </div>

              {/* Whole Word Matching Setting */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whole-word-matching-enabled"
                    checked={wholeWordMatchingEnabled}
                    onCheckedChange={handleWholeWordMatchingChange}
                  />
                  <Label
                    htmlFor="whole-word-matching-enabled"
                    className="cursor-pointer font-normal"
                  >
                    {t("common:wholeWordMatchingEnabledLabel")}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {t("common:wholeWordMatchingDescription")}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cache">
            <CacheSettings />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t("common:closeButton")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
