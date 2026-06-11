import Image from 'next/image';
import Link from 'next/link';

export function BrandMark() {
  return (
    <Link href="/" className="flex shrink-0 items-center" suppressHydrationWarning>
      <Image
        src="/logo2.png"
        alt="Laplace's Demon"
        width={360}
        height={90}
        className="h-24 w-auto"
        priority
      />
    </Link>
  );
}
