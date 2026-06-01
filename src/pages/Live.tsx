export default function Live() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-f1-red" />
        Live
      </span>
      <h1 className="mt-5 text-3xl font-bold text-white">
        No live session right now
      </h1>
      <p className="mt-3 max-w-md text-zinc-400">
        When a session is running, live timing, the track map and the timing
        tower will appear here in real time.
      </p>
    </div>
  )
}
