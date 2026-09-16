export default function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`stat ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
