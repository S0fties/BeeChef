import { Loader2, Save } from 'lucide-react'

/** Sticky bottom bar shared by full-screen editors (inventory, preferences). */
function EditorSaveBar({
  changeCount,
  saving,
  onSave,
  onExit,
  noChangesLabel = 'No changes yet',
  changeLabel = (n) => `${n} unsaved change${n === 1 ? '' : 's'}`,
  saveLabel = 'Save Changes',
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex min-h-[83px] items-center border-t border-[#e0e6da] bg-white px-6 pt-[10px] pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] max-[520px]:min-h-[79px] max-[520px]:px-4">
      <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3">
        <span className="text-sm text-[#4f5d50]" aria-live="polite">
          {changeCount === 0 ? noChangesLabel : changeLabel(changeCount)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            disabled={saving}
            className="rounded-xl border border-[#d8dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#4c584e] hover:bg-[#f4f6f1] disabled:opacity-50"
          >
            {changeCount > 0 ? 'Discard' : 'Done'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || changeCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#36583b] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#2a462e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditorSaveBar