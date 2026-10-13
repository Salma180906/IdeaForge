// Shows a word-level diff: removed words struck through, added words highlighted.
export default function DiffText({ ops }) {
  return (
    <p className="diff prose">
      {ops.map((op, i) => {
        if (op.type === 'del') return <del key={i}>{op.text}</del>;
        if (op.type === 'add') return <ins key={i}>{op.text}</ins>;
        return <span key={i}>{op.text}</span>;
      })}
    </p>
  );
}
