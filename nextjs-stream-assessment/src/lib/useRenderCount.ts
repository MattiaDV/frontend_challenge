import { useRef } from "react";

// Counts how many times the calling component has rendered
export function useRenderCount() {
  const count = useRef(0);
  count.current += 1;
  return count.current;
}