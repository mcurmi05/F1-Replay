export default function StatusCard({ text, spinner = false }: { text: string; spinner?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-surface p-8 text-zinc-400">
      {spinner ? (
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-700 border-t-f1-red" />
      ) : null}
      {text}
    </div>
  )
}
