import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h2 className="text-2xl font-bold font-mono">Page Not Found</h2>
      <p className="text-sm text-neutral-400 mt-2">Could not find requested resource</p>
      <Link href="/" className="mt-4 text-xs font-mono underline text-amber-500">
        Return Home
      </Link>
    </div>
  );
}
