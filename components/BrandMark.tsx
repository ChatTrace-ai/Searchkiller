import Link from 'next/link';
import { Play } from 'lucide-react';

export function BrandMark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 text-gray-950" suppressHydrationWarning>
      <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-blue-600 text-blue-600">
        <Play className="h-5 w-5 fill-blue-600" />
      </span>
      <span className="whitespace-nowrap text-lg font-bold sm:text-xl">Laplace&apos;s Demon</span>
    </Link>
  );
}
