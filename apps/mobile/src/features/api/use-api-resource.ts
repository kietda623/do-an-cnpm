import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "@marketplace/api-client";

export type ApiResourceState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "forbidden" }
  | { status: "success"; data: T };

export function useApiResource<T>(
  load: () => Promise<T>,
  isEmpty?: (data: T) => boolean,
) {
  const [state, setState] = useState<ApiResourceState<T>>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void load().then(
      (data) => {
        if (!active) return;
        setState(
          isEmpty?.(data) ? { status: "empty" } : { status: "success", data },
        );
      },
      (error: unknown) => {
        if (!active) return;
        setState(
          error instanceof ApiClientError && error.status === 403
            ? { status: "forbidden" }
            : { status: "error" },
        );
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, isEmpty, load]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}
