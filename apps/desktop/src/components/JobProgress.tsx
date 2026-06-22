interface Props {
  progress: number;
  stage: string | null;
  status: string;
}

export function JobProgress({ progress, stage, status }: Props) {
  return (
    <div className="card p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-app-fg-muted">{stage || status}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-app-muted overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
