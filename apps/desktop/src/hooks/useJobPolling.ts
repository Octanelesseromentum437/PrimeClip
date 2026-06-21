import { useQuery } from "@tanstack/react-query";
import { fetchJob } from "../lib/api";

export function useJobPolling(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 2000;
    },
  });
}
