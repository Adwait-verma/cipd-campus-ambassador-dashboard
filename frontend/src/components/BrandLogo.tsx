import Image from "next/image";

export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/cipd-logo.png"
      alt="CiPD logo"
      width={594}
      height={414}
      priority
      className={`block h-auto rounded-xl bg-white ${className}`}
    />
  );
}
