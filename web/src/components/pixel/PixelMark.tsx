/** The 3×3 logo mark: a ring of pixels with a hollow tail. */
export function PixelMark({ size = 20 }: { size?: number }) {
  return (
    <svg className="pixel-mark" width={size} height={size} viewBox="0 0 11 11" aria-hidden="true" shapeRendering="crispEdges">
      {[[0, 0], [4, 0], [8, 0], [0, 4], [8, 4], [0, 8], [4, 8]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="3" height="3" fill="currentColor" />)}
      <path d="M8 8h3v3H8zM9 9v1h1V9z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
