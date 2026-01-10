import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AvatarCropDialogProps = {
  open: boolean
  imageSrc: string
  scale: number
  offset: { x: number; y: number }
  onScaleChange: (value: number) => void
  onOffsetChange: (value: { x: number; y: number }) => void
  onClose: () => void
  onApply: (blob: Blob) => void
  onReset: () => void
}

const CROP_SIZE = 240
const OUTPUT_SIZE = 256

const AvatarCropDialog = ({
  open,
  imageSrc,
  scale,
  offset,
  onScaleChange,
  onOffsetChange,
  onClose,
  onApply,
  onReset,
}: AvatarCropDialogProps) => {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragState = useRef<{
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const baseScale = useMemo(() => {
    if (!imageSize.width || !imageSize.height) return 1
    return Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height)
  }, [imageSize])

  const clampOffset = (nextOffset: { x: number; y: number }, nextScale: number) => {
    if (!imageSize.width || !imageSize.height) return nextOffset
    const displayScale = baseScale * nextScale
    const displayWidth = imageSize.width * displayScale
    const displayHeight = imageSize.height * displayScale
    const maxX = Math.max(0, (displayWidth - CROP_SIZE) / 2)
    const maxY = Math.max(0, (displayHeight - CROP_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, nextOffset.x)),
      y: Math.min(maxY, Math.max(-maxY, nextOffset.y)),
    }
  }

  useEffect(() => {
    const clamped = clampOffset(offset, scale)
    if (clamped.x === offset.x && clamped.y === offset.y) return
    onOffsetChange(clamped)
  }, [offset.x, offset.y, scale, imageSize.width, imageSize.height, onOffsetChange])

  useEffect(() => {
    if (!open) {
      setImageSize({ width: 0, height: 0 })
    }
  }, [open])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const deltaX = event.clientX - dragState.current.x
    const deltaY = event.clientY - dragState.current.y
    const nextOffset = clampOffset(
      { x: dragState.current.offsetX + deltaX, y: dragState.current.offsetY + deltaY },
      scale
    )
    onOffsetChange(nextOffset)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragState.current = null
    setIsDragging(false)
  }

  const handleImageLoad = () => {
    if (!imageRef.current) return
    setImageSize({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    })
  }

  const handleApply = async () => {
    if (!imageRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const displayScale = baseScale * scale
    const displayWidth = imageSize.width * displayScale
    const displayHeight = imageSize.height * displayScale
    const imageLeft = CROP_SIZE / 2 - displayWidth / 2 + offset.x
    const imageTop = CROP_SIZE / 2 - displayHeight / 2 + offset.y
    const sourceX = (0 - imageLeft) / displayScale
    const sourceY = (0 - imageTop) / displayScale
    const sourceSize = CROP_SIZE / displayScale
    ctx.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    )
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png', 0.92)
    )
    if (blob) {
      onApply(blob)
    }
  }

  if (!open) return null

  const displayScale = baseScale * scale

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Crop profile photo</h3>
            <p className="text-xs text-muted-foreground">
              Drag to reposition, use the slider to zoom.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="mt-4 flex justify-center">
          <div
            className={`relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900/20 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
              style={{
                width: imageSize.width ? imageSize.width * baseScale : 'auto',
                height: imageSize.height ? imageSize.height * baseScale : 'auto',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/20" />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(0,0,0,0) 0 70%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.55) 70%)',
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full border border-white/40" />
            {isDragging && (
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[length:24px_24px]" />
            )}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <span className="text-xs text-muted-foreground">
              {Math.round(displayScale * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onScaleChange(Math.max(1, scale - 0.1))}
            >
              <Minus size={14} />
            </Button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={scale}
              onChange={(event) =>
                onScaleChange(Number(event.target.value))
              }
              className="w-full accent-violet-500"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onScaleChange(Math.min(3, scale + 0.1))}
            >
              <Plus size={14} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onReset}
            >
              <RotateCcw size={14} />
            </Button>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply}>
            Apply crop
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AvatarCropDialog
