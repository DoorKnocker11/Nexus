import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { processThumb, processPortrait } from '../lib/images.js'
import ImageDrop from './ImageDrop.jsx'

export default function CharacterEditor({ character, onClose }) {
  const { characters, saveCharacter, urlsFor } = useStore()
  const existing = character ? urlsFor(character) : {}
  const [name, setName] = useState(character?.name || '')
  const [thumb, setThumb] = useState(null)       // new processed Blob, if changed
  const [portrait, setPortrait] = useState(null)
  const [thumbUrl, setThumbUrl] = useState(existing.thumb || null)
  const [portraitUrl, setPortraitUrl] = useState(existing.portrait || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Revoke locally-created preview URLs on unmount.
  useEffect(() => () => {
    if (thumbUrl && thumbUrl !== existing.thumb) URL.revokeObjectURL(thumbUrl)
    if (portraitUrl && portraitUrl !== existing.portrait) URL.revokeObjectURL(portraitUrl)
  }, [thumbUrl, portraitUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const setThumbFile = async (file) => {
    try {
      setBusy(true)
      const blob = await processThumb(file)
      setThumb(blob)
      setThumbUrl((old) => {
        if (old && old !== existing.thumb) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    } catch (e) {
      setError('Could not read that image.')
    } finally { setBusy(false) }
  }

  const setPortraitFile = async (file) => {
    try {
      setBusy(true)
      const blob = await processPortrait(file)
      setPortrait(blob)
      setPortraitUrl((old) => {
        if (old && old !== existing.portrait) URL.revokeObjectURL(old)
        return URL.createObjectURL(blob)
      })
    } catch (e) {
      setError('Could not read that image.')
    } finally { setBusy(false) }
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give the character a name.'); return }
    const dupe = characters.some((c) => c.id !== character?.id && c.name.toLowerCase() === trimmed.toLowerCase())
    if (dupe && !window.confirm(`Another character is already named “${trimmed}”. Save anyway?`)) return

    setBusy(true)
    try {
      const patch = { name: trimmed }
      if (character?.id) patch.id = character.id
      if (thumb) patch.thumb = thumb
      if (portrait) patch.portrait = portrait
      // Derive whichever image is missing from the other one.
      if (!character?.thumb && !thumb && portrait) patch.thumb = await processThumb(portrait)
      if (!character?.portrait && !portrait && thumb) patch.portrait = thumb
      await saveCharacter(patch)
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save character.')
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal editor-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{character ? 'EDIT FIGHTER' : 'NEW FIGHTER'}</h2>
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            placeholder="e.g. Ryu"
            maxLength={40}
          />
        </label>
        <div className="editor-images">
          <div className="editor-images__col">
            <ImageDrop
              label="Thumbnail"
              hint="Square crop, shown in the grid"
              previewUrl={thumbUrl}
              onFile={setThumbFile}
              square
            />
          </div>
          <div className="editor-images__col editor-images__col--portrait">
            <ImageDrop
              label="Portrait"
              hint="Full-body splash art"
              previewUrl={portraitUrl}
              onFile={setPortraitFile}
            />
          </div>
        </div>
        <p className="editor-note">Upload either image and the other is derived automatically. Thumbnails are auto-cropped square; portraits keep their aspect ratio.</p>
        {error && <p className="editor-error">{error}</p>}
        <div className="modal__actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
