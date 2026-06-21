import { useQuery } from "@tanstack/react-query";
import { fetchProviders } from "../lib/api";
import { listConfiguredProviders } from "../lib/credentials";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const configured = await listConfiguredProviders();
      return fetchProviders(configured);
    },
  });
}
