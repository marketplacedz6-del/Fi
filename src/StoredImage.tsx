import { ImgHTMLAttributes, useEffect, useState } from 'react'
import { getStoredImage, isStoredImage } from './lib/imageStore'

type StoredImageProps = ImgHTMLAttributes<HTMLImageElement> & { src: string }

export default function StoredImage({ src, alt = '', ...props }: StoredImageProps) {
  const [resolvedSource, setResolvedSource] = useState(isStoredImage(src) ? '' : src)

  useEffect(() => {
    let objectUrl = ''
    let active = true
    if (!isStoredImage(src)) {
      setResolvedSource(src)
      return () => undefined
    }
    setResolvedSource('')
    void getStoredImage(src).then(blob => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setResolvedSource(objectUrl)
    }).catch(() => setResolvedSource(''))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (!resolvedSource) return <span className={`stored-image-placeholder ${props.className ?? ''}`} aria-label={String(alt)} />
  return <img src={resolvedSource} alt={alt} {...props} />
}
