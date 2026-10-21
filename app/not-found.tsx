import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 sm:px-8">
      <h1 className="text-[32px] font-semibold tracking-[-0.025em]">This page is not here.</h1>
      <Link href="/" className="mt-6 inline-block text-[15px] text-muted hover:text-text">
        Back to Zeep
      </Link>
    </main>
  );
}
