import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button"; // Import shadcn Button
import { History } from "lucide-react"; // Import the History icon

interface HistoryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onClick, disabled }) => {
  const { t } = useTranslation(['common']);

  return (
    // Use the shadcn Button component
    <Button
      variant="outline" // Use outline style, similar to settings button
      size="icon"       // Use icon size for a compact button
      onClick={onClick}
      disabled={disabled}
      aria-label={t('historyButtonLabel')} // Accessibility label
      title={t('historyButtonLabel')}      // Tooltip on hover
    >
      {/* Render the Lucide History icon */}
      <History className="h-4 w-4" /> {/* Standard icon size for shadcn */}
    </Button>
  );
};

export default HistoryButton;
