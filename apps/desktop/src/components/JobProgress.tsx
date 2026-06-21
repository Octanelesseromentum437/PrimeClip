interface Props {
  progress: number;
  stage: string | null;
  status: string;
}

export function JobProgress({ progress, stage, status }: Props) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-400">{stage || status}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
