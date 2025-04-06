import React from "react";
import { useTranslation } from "react-i18next";
import { supportedLngs } from "./i18n"; // Import supported languages
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose, // Optional close button in footer/header
} from "@/components/ui/dialog"; // Import shadcn Dialog components
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Import shadcn Select components
import { Label } from "@/components/ui/label"; // Import shadcn Label
import { Button } from "@/components/ui/button"; // Import shadcn Button

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation(['common']); // Use common namespace

  const handleLanguageChange = async (newLang: string) => {
    // No need for event object with shadcn Select's onValueChange
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

  // Use the Dialog's controlled state
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(); // Call the parent's close handler when the dialog requests to be closed
    }
    // We don't control opening from here, only closing
  };

  return (
    // Use the shadcn Dialog component
    // Control its open state via the `open` prop
    // Handle close requests via `onOpenChange`
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* DialogContent handles the overlay and centering */}
      <DialogContent className="sm:max-w-[425px]"> {/* Adjust max width if needed */}
        {/* DialogHeader for title and optional description */}
        <DialogHeader>
          <DialogTitle>{t('settingsTitle')}</DialogTitle>
          {/* Optional: Add a description if needed */}
          {/* <DialogDescription>
            Manage your application settings here.
          </DialogDescription> */}
        </DialogHeader>

        {/* Main settings content area */}
        {/* Use Tailwind classes for layout */}
        <div className="grid gap-4 py-4">
          {/* Language Selection Group */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="language-select" className="text-right">
              {t('languageLabel')}
            </Label>
            {/* Use shadcn Select */}
            <Select
              value={i18n.language} // Current language
              onValueChange={handleLanguageChange} // Pass the new value directly
            >
              <SelectTrigger id="language-select" className="col-span-3">
                <SelectValue placeholder={t('languageLabel')} />
              </SelectTrigger>
              <SelectContent>
                {supportedLngs.map((lng) => (
                  <SelectItem key={lng} value={lng}>
                    {/* Translate language name using key like 'lang_en' */}
                    {t(`lang_${lng}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Add more settings groups here using Label and appropriate shadcn inputs */}
          {/* Example:
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="some-setting" className="text-right">
              Some Setting
            </Label>
            <Input id="some-setting" defaultValue="example" className="col-span-3" />
          </div>
          */}
        </div>

        {/* DialogFooter for action buttons */}
        <DialogFooter>
          {/* DialogClose automatically triggers the onOpenChange(false) */}
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t('closeButton')}
            </Button>
          </DialogClose>
          {/* Add other buttons like "Save Changes" if needed */}
          {/* <Button type="submit">Save changes</Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
