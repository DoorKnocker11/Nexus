import React, { useRef, useState } from 'react'
import { isImageFile } from '../lib/images.js'

/** File-picker + drag-and-drop image input with preview. */
export default function ImageDrop({ label, hint, previewUrl, onFile, square }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    const file = [...files].find(isImageFile)
    if (file) onFile(file)
  }

  return (
    <div
      className={`image-drop ${square ? 'image-drop--square' : ''} ${dragging ? 'is-dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click() }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt={label} className="image-drop__preview" />
      ) : (
        <div className="image-drop__empty">
          <span className="image-drop__label">{label}</span>
          <span className="image-drop__hint">{hint || 'Click or drop an image'}</span>
        </div>
      )}
    </div>
  )
}
