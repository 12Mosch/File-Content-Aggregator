import { useState, useEffect, useRef } from "react";

/**
 * Custom hook to debounce a value with performance optimizations.
 * @param value The value to debounce.
 * @param delay The debounce delay in milliseconds.
 * @param skipIfEqual Whether to skip debouncing if the new value equals the current value (default: true).
 * @returns The debounced value.
 */
function useDebounce<T>(
  value: T,
  delay: number,
  skipIfEqual: boolean = true
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const previousValueRef = useRef<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip debouncing if the value hasn't changed and skipIfEqual is true
    if (skipIfEqual && value === previousValueRef.current) {
      return;
    }

    // Update the previous value reference
    previousValueRef.current = value;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set up a timer to update the debounced value after the specified delay
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timerRef.current = null;
    }, delay);

    // Clean up the timer if the component unmounts
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay, skipIfEqual]); // Only re-run the effect if value, delay, or skipIfEqual changes

  return debouncedValue;
}

export default useDebounce;
