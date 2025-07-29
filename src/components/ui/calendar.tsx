import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DayPicker,
  type PropsSingle,
  type DayPickerProps,
  type Matcher,
} from "react-day-picker";
import { format, addMonths, addYears, type Locale } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CalendarView = "days" | "months" | "years";

// CustomCaptionProps defines only the props needed for our custom caption logic
interface CustomCaptionProps {
  displayMonth: Date;
  onViewChange: (view: CalendarView) => void;
  onMonthChange: (date: Date) => void;
  currentView: CalendarView;
  locale?: Locale;
}

function CustomCaption(props: CustomCaptionProps) {
  const { displayMonth, onViewChange, onMonthChange, currentView, locale } =
    props;

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
    <div className="relative mb-2 flex h-10 w-full items-center justify-between pt-1">
      {/* Year Navigation */}
      <button
        type="button"
        onClick={handlePrevYear}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "absolute left-1 size-7 bg-transparent p-0",
          currentView !== "days"
            ? "cursor-not-allowed opacity-30"
            : "opacity-50 hover:opacity-100"
        )}
        aria-label="Previous year"
      >
        <ChevronsLeft className="size-4" />
      </button>

      {/* Month Navigation */}
      <button
        type="button"
        onClick={handlePrevMonth}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "absolute left-9 size-7 bg-transparent p-0",
          currentView !== "days"
            ? "cursor-not-allowed opacity-30"
            : "opacity-50 hover:opacity-100"
        )}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Centered Month/Year Label Container */}
      <div className="flex flex-grow items-center justify-center text-sm font-medium">
        {currentView === "years" ? (
          <button
            type="button"
            onClick={() => onViewChange("years")}
            className="cursor-default px-2 py-1"
          >
            {format(displayMonth, "yyyy", { locale })}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleMonthClick}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto px-2 py-1 text-sm font-medium",
                currentView === "months" && "text-primary underline"
              )}
            >
              {format(displayMonth, "MMMM", { locale })}
            </button>
            <button
              type="button"
              onClick={handleYearClick}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto px-2 py-1 text-sm font-medium",
                // @ts-expect-error - Comparison is intentional for styling
                currentView === "years" && "text-primary underline"
              )}
            >
              {format(displayMonth, "yyyy", { locale })}
            </button>
          </>
        )}
      </div>

      {/* Month Navigation */}
      <button
        type="button"
        onClick={handleNextMonth}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "absolute right-9 size-7 bg-transparent p-0",
          currentView !== "days"
            ? "cursor-not-allowed opacity-30"
            : "opacity-50 hover:opacity-100"
        )}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Year Navigation */}
      <button
        type="button"
        onClick={handleNextYear}
        disabled={currentView !== "days"}
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "absolute right-1 size-7 bg-transparent p-0",
          currentView !== "days"
            ? "cursor-not-allowed opacity-30"
            : "opacity-50 hover:opacity-100"
        )}
        aria-label="Next year"
      >
        <ChevronsRight className="size-4" />
      </button>
    </div>
  );
}

// --- Main Calendar Component ---
interface CalendarProps
  extends Omit<
    DayPickerProps,
    | "mode"
    | "selected"
    | "onSelect"
    | "month"
    | "onMonthChange"
    | "captionLayout"
    | "components"
  > {
  mode?: "single";
  selected?: PropsSingle["selected"];
  onSelect?: PropsSingle["onSelect"];
  locale?: Locale;
  initialMonth?: Date;
  disabled?: Matcher | Matcher[];
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  initialMonth,
  selected,
  onSelect,
  mode = "single",
  disabled,
  ...props
}: CalendarProps) {
  const [view, setView] = React.useState<CalendarView>("days");
  const [displayDate, setDisplayDate] = React.useState<Date>(
    initialMonth || (selected as Date) || new Date()
  );

  React.useEffect(() => {
    if (initialMonth) {
      setDisplayDate(initialMonth);
    }
    if (!selected) {
      setView("days");
    }
  }, [initialMonth, selected]);

  React.useEffect(() => {
    if (selected instanceof Date && !isNaN(selected.getTime())) {
      if (
        selected.getFullYear() !== displayDate.getFullYear() ||
        selected.getMonth() !== displayDate.getMonth()
      ) {
        setDisplayDate(selected);
        setView("days");
      }
    }
  }, [selected, displayDate]);

  const handleDaySelect: PropsSingle["onSelect"] = (
    day,
    selectedDay,
    activeModifiers,
    e
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
      format(new Date(2000, i, 1), "MMMM", { locale })
    );
  }, [locale]);

  const currentYear = displayDate.getFullYear();
  const startDecadeYear = Math.floor(currentYear / 10) * 10;
  const years = Array.from({ length: 12 }).map((_, i) => startDecadeYear + i);

  return (
    <div className={cn("p-3", className)}>
      {/* Render CustomCaption directly */}
      <CustomCaption
        displayMonth={displayDate}
        onViewChange={setView}
        onMonthChange={setDisplayDate}
        currentView={view}
        locale={locale}
      />

      {/* Conditional rendering based on the current view */}
      {view === "days" && (
        <DayPicker
          mode={mode}
          showOutsideDays={showOutsideDays}
          month={displayDate}
          onMonthChange={setDisplayDate}
          selected={selected}
          onSelect={handleDaySelect}
          locale={locale}
          disabled={disabled}
          classNames={{
            caption: "hidden",
            nav: "hidden",
            months: "flex flex-col sm:flex-row gap-2",
            month: "flex flex-col gap-4",
            caption_label: "text-sm font-medium",
            table: "w-full border-collapse",
            head_row: "flex justify-around mb-2",
            head_cell:
              "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] uppercase",
            row: "flex w-full mt-1 justify-around",
            day: cn(
              "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
              "[&:has([aria-selected])]:rounded-md"
            ),
            day_button: cn(
              buttonVariants({ variant: "ghost" }),
              "size-8 p-0 font-normal aria-selected:opacity-100 rounded-md"
            ),
            selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
            today: "bg-accent text-accent-foreground rounded-md",
            outside:
              "day-outside text-muted-foreground/50 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
            disabled: "text-muted-foreground opacity-50",
            hidden: "invisible",
            ...classNames,
          }}
          {...props}
        />
      )}

      {/* Month View */}
      {view === "months" && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {monthNames.map((monthName, index) => (
            <button
              key={monthName}
              type="button"
              onClick={() => handleMonthSelect(index)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 w-full justify-center text-sm",
                displayDate.getMonth() === index &&
                  "bg-accent text-accent-foreground"
              )}
            >
              {monthName}
            </button>
          ))}
        </div>
      )}

      {/* Year View */}
      {view === "years" && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setDisplayDate(addYears(displayDate, -10))}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground"
            )}
            aria-label="Previous decade"
          >
            «
          </button>
          <div className="col-span-2"></div>
          <button
            type="button"
            onClick={() => setDisplayDate(addYears(displayDate, 10))}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground"
            )}
            aria-label="Next decade"
          >
            »
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => handleYearSelect(year)}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 w-full justify-center text-sm",
                displayDate.getFullYear() === year &&
                  "bg-accent text-accent-foreground"
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
