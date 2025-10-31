import React from "react";
import Image from "next/image";

export default function Hero() {
  return (
    // Mobile can be taller; desktop remains min-h-screen
    <div className="relative min-h-[120vh] lg:min-h-screen -mt-14 sm:-mt-16 pt-14 sm:pt-16 overflow-hidden">
      {/* Background godrays (desktop only) */}
      <div className="absolute right-20 top-10 hidden lg:block pointer-events-none">
        <Image
          src="/images/godrays.png"
          alt="Hero Background"
          width={1400}
          height={1400}
          className="h-auto w-[50rem] xl:w-[50rem]"
          priority
        />
      </div>

      {/* Content container */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: stack toward top with big bottom padding so phone never overlaps.
            Tablet (md): phone moves right, so only small bottom padding is needed.
            Desktop (lg): same as before. */}
        <div className="flex items-start lg:items-center lg:h-[calc(100vh-4rem)] pb-[52vh] sm:pb-[40vh] md:pb-10 lg:pb-0 pt-6 lg:pt-0">
          <div className="relative z-20 max-w-3xl lg:pr-8">
            <h1 className="font-semibold text-4xl sm:text-5xl lg:text-[64px] lg:leading-[72px] leading-tight text-white md:tracking-[-2.56px] tracking-[-1.4px]">
              The fastest way to bet smarter on solana.
            </h1>

            <p className="mt-4 text-[12px] sm:text-[14px] md:leading-[24px] text-white/70 tracking-[-0.32px] max-w-[692px] font-mono">
              The market is fragmented. One platform to access, compare and copy
              trades across popular prediction markets.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="bg-white flex items-center gap-[10px] px-6 py-3 rounded-[8px] hover:bg-gray-100 transition-colors cursor-pointer">
                <span className="font-medium text-[14px] leading-[22px] text-black font-mono">
                  Trade Now
                </span>
              </button>

              <button className="border-2 border-white flex items-center gap-[10px] px-6 py-3 rounded-[8px] hover:bg-white/10 transition-colors font-mono cursor-pointer">
                <span className="font-medium text-[14px] leading-[22px] text-white">
                  Get App
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex absolute bottom-10 left-6 sm:left-10 lg:left-16 items-center gap-2 z-20 lg:hidden sm:hidden">
        <Image src="/icons/solana-sol.svg" alt="Solana" width={24} height={24} />
        <p className="font-medium leading-[24px] text-[16px] text-white">
          Built on Solana
        </p>
      </div>
      </div>

      {/* Phone mockup */}
      <div
        className={[
          // Mobile: centered at bottom
          "pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[70vw] max-w-[360px]",
          // Small screens: a bit wider
          "sm:w-[420px]",
          // Tablet md+: move to right so it no longer sits under the text
          "md:left-auto md:right-12 md:translate-x-0 md:w-[320px]",
          // Desktop lg+: keep your original placement/sizing
          "lg:right-60 lg:w-[360px]",
        ].join(" ")}
      >
        <Image
          src="/images/hero-mobile.png"
          alt="iPhone 15 Pro"
          width={1000}
          height={1000}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Built on Solana — hidden on mobile, visible from sm+ */}
      <div className="hidden sm:flex absolute bottom-10 left-6 sm:left-10 lg:left-16 items-center gap-2 z-20 lg:hidden">
        <Image src="/icons/solana-sol.svg" alt="Solana" width={24} height={24} />
        <p className="font-medium leading-[24px] text-[16px] text-white">
          Built on Solana
        </p>
      </div>
    </div>
  );
}
