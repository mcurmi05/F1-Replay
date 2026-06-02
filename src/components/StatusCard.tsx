export default function StatusCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-surface p-8 text-zinc-400">
      {text}
    </div>
  )
}
