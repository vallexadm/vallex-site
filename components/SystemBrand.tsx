import Image from "next/image";

export default function SystemBrand() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/vallex-logo.png"
        alt="VALLEX"
        width={7271}
        height={5879}
        priority
        className="h-[54px] w-[66px] object-contain"
      />
      <span className="text-xl font-bold text-purple-200">ServiçoFácil</span>
    </div>
  );
}
