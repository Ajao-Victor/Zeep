export function PhraseGrid({ words }: { words: string[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {words.map((word, index) => (
        <li key={`${word}-${index}`} className="rounded-lg border border-line bg-bg px-3 py-2">
          <span className="font-mono text-[12px] text-gold">{String(index + 1).padStart(2, "0")}</span>
          <div className="mt-1 text-[15px]">{word}</div>
        </li>
      ))}
    </ol>
  );
}

export function phraseWords(phrase: string): string[] {
  return phrase.trim().split(/\s+/);
}
