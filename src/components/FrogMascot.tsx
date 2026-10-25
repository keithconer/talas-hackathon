interface FrogMascotProps {
  size?: number
}

/** Shared TALAS mascot using the supplied pixel-art asset. */
export default function FrogMascot({ size = 160 }: FrogMascotProps) {
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/imgs/talasLogo.png" />
      <img
        src="/imgs/talas-blinking.gif"
        width={size}
        height={size}
        alt="TALAS frog mascot"
        style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated' }}
      />
    </picture>
  )
}
