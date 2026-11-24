/** Digits roll 300ms to the new value. Width never changes per digit (tabular), so nothing reflows. */
export function NumberRoll({ text }: { text: string }) {
  return (
    <span className="roll">
      <span className="vh">{text}</span>
      <span aria-hidden="true" className="roll-in">
        {[...text].map((ch, i, all) => {
          const k = all.length - i; // keyed from the right so places line up
          if (ch < '0' || ch > '9') return <span key={'s' + k} className="roll-c">{ch}</span>;
          return <span key={'d' + k} className="roll-d"><span className="roll-s" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>{'0123456789'.split('').map((d) => <span key={d}>{d}</span>)}</span></span>;
        })}
      </span>
    </span>
  );
}
