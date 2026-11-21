import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  addAllergyItems,
  addAllergyLabels,
  addItemPreferences,
  deleteAllergyItems,
  deleteAllergyLabels,
  deleteItemPreferences,
  fetchPreferences,
} from '../api/preferences.js'
import AllergyLabelPicker from '../components/preferences/AllergyLabelPicker.jsx'
import PreferenceItemChip from '../components/preferences/PreferenceItemChip.jsx'
import PreferencePicker from '../components/preferences/PreferencePicker.jsx'
import PreferenceSection from '../components/preferences/PreferenceSection.jsx'
import { PREFERENCE_TONES } from '../components/preferences/preferenceTones.js'

function ItemGrid({ items, tone, pending, onRemove }) {
  if (items.length === 0) {
    return <p className="m-0 text-sm text-[#7a8075]">{PREFERENCE_TONES[tone].empty}</p>
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <PreferenceItemChip
          key={item.id}
          item={item}
          tone={tone}
          removing={pending.has(`${tone}:${item.id}`)}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function PreferencesPage() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(() => new Set())
  const [addMode, setAddMode] = useState(null) // null | 'preferred' | 'restricted' | 'allergic'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPrefs(await fetchPreferences())
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load your preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Runs one instant request; the server returns the full updated preferences.
  const runInstant = useCallback(async (key, action) => {
    setPending((prev) => new Set(prev).add(key))
    setError('')
    try {
      setPrefs(await action())
    } catch (err) {
      setError(err.message || 'Could not update your preferences')
    } finally {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  const handleToggleLabel = (label, isSelected) =>
    runInstant(`label:${label}`, () =>
      isSelected ? deleteAllergyLabels([label]) : addAllergyLabels([label]),
    )

  const handleRemoveItem = (tone) => (item) =>
    runInstant(`${tone}:${item.id}`, () =>
      tone === 'allergic' ? deleteAllergyItems([item.id]) : deleteItemPreferences([item.id]),
    )

  // Called by the picker's Save button: all selected items are sent together.
  const handleSavePicker = async (ids) => {
    let next
    if (addMode === 'allergic') {
      // Items moving to allergic must leave preferred/restricted first.
      const inPrefs = new Set([...prefs.preferred, ...prefs.restricted].map((i) => i.id))
      const moving = ids.filter((id) => inPrefs.has(id))
      if (moving.length > 0) await deleteItemPreferences(moving)
      next = await addAllergyItems(ids)
    } else {
      next = await addItemPreferences(ids.map((id) => ({ item_id: id, pref: addMode })))
    }
    setPrefs(next)
    setAddMode(null)
  }

  const removePreferred = handleRemoveItem('preferred')
  const removeRestricted = handleRemoveItem('restricted')
  const removeAllergic = handleRemoveItem('allergic')

  const isPicking = addMode !== null && prefs !== null

  return (
    <section className="w-full space-y-6">
      <div>
        {!isPicking && (
          <Link
            to="/profile"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#36583b] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to profile
          </Link>
        )}
        <h1 className="m-0 text-[clamp(32px,5vw,48px)] font-bold tracking-[-1.5px] text-[#253b2d]">
          {isPicking ? PREFERENCE_TONES[addMode].addLabel : 'Food Preferences'}
        </h1>
        <p className="m-0 mt-1 text-sm text-[#636b5f]">
          {isPicking
            ? 'Select ingredients, then save them together'
            : 'Tell us what you like, avoid, or cannot eat so recipes fit you'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm font-medium text-[#b42318]"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-[#e6ebe1] bg-white py-14 text-center text-sm text-[#697065]"
        >
          Loading preferences...
        </div>
      ) : !prefs ? (
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-[#d8dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#36583b] hover:bg-[#f2f5ee]"
        >
          Try again
        </button>
      ) : isPicking ? (
        <PreferencePicker
          key={addMode}
          mode={addMode}
          prefs={prefs}
          onSave={handleSavePicker}
          onExit={() => setAddMode(null)}
        />
      ) : (
        <div className="space-y-3">
          <PreferenceSection
            tone="preferred"
            count={prefs.preferred.length}
            onAdd={() => setAddMode('preferred')}
          >
            <ItemGrid
              items={prefs.preferred}
              tone="preferred"
              pending={pending}
              onRemove={removePreferred}
            />
          </PreferenceSection>

          <PreferenceSection
            tone="restricted"
            count={prefs.restricted.length}
            onAdd={() => setAddMode('restricted')}
          >
            <ItemGrid
              items={prefs.restricted}
              tone="restricted"
              pending={pending}
              onRemove={removeRestricted}
            />
          </PreferenceSection>

          <PreferenceSection
            tone="allergic"
            count={prefs.allergy_labels.length + prefs.allergy_items.length}
            onAdd={() => setAddMode('allergic')}
          >
            <AllergyLabelPicker
              selected={prefs.allergy_labels}
              pending={pending}
              onToggle={handleToggleLabel}
            />
            <div>
              <p className="m-0 mb-2 text-xs font-semibold text-[#697065]">Allergic ingredients</p>
              <ItemGrid
                items={prefs.allergy_items}
                tone="allergic"
                pending={pending}
                onRemove={removeAllergic}
              />
            </div>
          </PreferenceSection>
        </div>
      )}
    </section>
  )
}

export default PreferencesPage