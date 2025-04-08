import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DayPicker,
  CaptionProps,
  DayPickerSingleProps,
  SelectSingleEventHandler,
} from "react-day-picker";
import { format, addMonths, addYears, Locale } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CalendarView = "days" | "months" | "years";

function CustomCaption(
  props: CaptionProps & {
    onViewChange: (view: CalendarView) => void;
    onMonthChange: (date: Date) => void;
    currentView: CalendarView;
    locale?: Locale;
  },
) {
  const {
    displayMonth,
    onViewChange,
    onMonthChange,
    currentView,
    locale,
  } = props;

  const handleMonthClick = () => {
    if (currentView === "days") {
      onViewChange("months");
    } else if (currentView === "months") {
      onViewChange("years");
    }
  };

  const handleYearClick = () => {
    if (currentView !== "years") {
      onViewChange("years");
    }
  };

  const handlePrevMonth = () => onMonthChange(addMonths(displayMonth, -1));
  const handleNextMonth = () => onMonthChange(addMonths(displayMonth, 1));
  const handlePrevYear = () => onMonthChange(addYears(displayMonth, -1));
  const handleNextYear = () => onMonthChange(addYears(displayMonth, 1));

  return (
    // Keep parent flex justify-between to define overall space
    <div className="flex justify-between items-center pt-1 relative w-full h-10 mb-2">
      {/* Year Navigation (Absolute) */}
      <button
        type="button"
        onClick={handlePrevYear}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-7 bg-transparent p-0 absolute left-1", // Position absolute
          currentView !== "days"
            ? "opacity-30 cursor-not-allowed"
            : "opacity-50 hover:opacity-100",
        )}
        aria-label="Previous year"
      >
        <ChevronsLeft className="size-4" />
      </button>

      {/* Month Navigation (Absolute) */}
      <button
        type="button"
        onClick={handlePrevMonth}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-7 bg-transparent p-0 absolute left-9", // Position absolute
          currentView !== "days"
            ? "opacity-30 cursor-not-allowed"
            : "opacity-50 hover:opacity-100",
        )}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Centered Month/Year Label Container */}
      {/* Make this div grow and center its content */}
      <div className="flex flex-grow justify-center items-center text-sm font-medium">
        {currentView === "years" ? (
          <button
            type="button"
            onClick={() => onViewChange("years")} // No action needed if already in years view
            className="cursor-default px-2 py-1" // Style as non-interactive text
          >
            {format(displayMonth, "yyyy", { locale })}
          </button>
        ) : (
          // Keep buttons inside for clickability
          <>
            <button
              type="button"
              onClick={handleMonthClick}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto px-2 py-1 text-sm font-medium", // Keep styling
                currentView === "months" && "text-primary underline",
              )}
            >
              {format(displayMonth, "MMMM", { locale })}
            </button>
            <button
              type="button"
              onClick={handleYearClick}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto px-2 py-1 text-sm font-medium", // Keep styling
                // @ts-expect-error - TS overly strict, comparison is valid for styling intent
                currentView === "years" && "text-primary underline",
              )}
            >
              {format(displayMonth, "yyyy", { locale })}
            </button>
          </>
        )}
      </div>

      {/* Month Navigation (Absolute) */}
      <button
        type="button"
        onClick={handleNextMonth}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-7 bg-transparent p-0 absolute right-9", // Position absolute
          currentView !== "days"
            ? "opacity-30 cursor-not-allowed"
            : "opacity-50 hover:opacity-100",
        )}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Year Navigation (Absolute) */}
      <button
        type="button"
        onClick={handleNextYear}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "size-7 bg-transparent p-0 absolute right-1", // Position absolute
          currentView !== "days"
            ? "opacity-30 cursor-not-allowed"
            : "opacity-50 hover:opacity-100",
        )}
        aria-label="Next year"
      >
        <ChevronsRight className="size-4" />
      </button>
    </div>
  );
}

// --- Main Calendar Component (No changes needed below this line for this fix) ---
type CalendarProps = Omit<DayPickerSingleProps, "mode"> & {
  locale?: Locale;
  className?: string;
  classNames?: Partial<React.ComponentProps<typeof DayPicker>["classNames"]>;
  showOutsideDays?: boolean;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  month: initialMonth,
  defaultMonth,
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  const [view, setView] = React.useState<CalendarView>("days");
  const [displayDate, setDisplayDate] = React.useState<Date>(
    initialMonth || (selected as Date) || defaultMonth || new Date(),
  );

  React.useEffect(() => {
    if (initialMonth) {
      setDisplayDate(initialMonth);
    }
  }, [initialMonth]);

  const handleDaySelect: SelectSingleEventHandler = (
    day,
    selectedDay,
    activeModifiers,
    e,
  ) => {
    onSelect?.(day, selectedDay, activeModifiers, e);
    if (day) {
      setView("days");
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    setDisplayDate(new Date(displayDate.getFullYear(), monthIndex, 1));
    setView("days");
  };

  const handleYearSelect = (year: number) => {
    setDisplayDate(new Date(year, displayDate.getMonth(), 1));
    setView("months");
  };

  const monthNames = React.useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) =>
      format(new Date(2000, i, 1), "MMMM", { locale }),
    );
  }, [locale]);

  const currentYear = displayDate.getFullYear();
  const startDecadeYear = Math.floor(currentYear / 10) * 10;
  const years = Array.from({ length: 12 }).map((_, i) => startDecadeYear + i - 1);

  return (
    <div className={cn("p-3", className)}>
      <CustomCaption
        displayMonth={displayDate}
        onViewChange={setView}
        onMonthChange={setDisplayDate}
        currentView={view}
        locale={locale}
        {...(props)}
      />

      {view === "days" && (
        <DayPicker
          mode="single"
          showOutsideDays={showOutsideDays}
          month={displayDate}
          onMonthChange={setDisplayDate}
          selected={selected}
          onSelect={handleDaySelect}
          locale={locale}
          captionLayout="buttons"
          classNames={{
            caption: "hidden",
            months: "flex flex-col sm:flex-row gap-2",
            month: "flex flex-col gap-4",
            caption_label: "text-sm font-medium",
            nav: "hidden",
            table: "w-full border-collapse",
            head_row: "flex justify-around mb-2",
            head_cell:
              "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] uppercase",
            row: "flex w-full mt-1 justify-around",
            cell: cn(
              "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
              "[&:has([aria-selected])]:rounded-md",
            ),
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "size-8 p-0 font-normal aria-selected:opacity-100 rounded-md",
            ),
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
            day_today: "bg-accent text-accent-foreground rounded-md",
            day_outside:
              "day-outside text-muted-foreground/50 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
            ...classNames,
          }}
          components={{
            IconLeft: () => null,
            IconRight: () => null,
          }}
          {...props}
        />
      )}

      {view === "months" && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {monthNames.map((monthName, index) => (
            <button
              key={monthName}
              type="button"
              onClick={() => handleMonthSelect(index)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-center text-sm h-9",
                displayDate.getMonth() === index &&
                  "bg-accent text-accent-foreground",
              )}
            >
              {monthName}
            </button>
          ))}
        </div>
      )}

      {view === "years" && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => handleYearSelect(year)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-center text-sm h-9",
                displayDate.getFullYear() === year &&
                  "bg-accent text-accent-foreground",
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { Calendar };
