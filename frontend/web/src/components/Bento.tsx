import React from "react";
import Image from "next/image";

export default function Bento() {
  return (
    <section className="relative bg-[#0a0b0d] py-16 sm:py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-5 auto-rows-fr">
          
          <div className="bg-black border border-[#4c4c4c] rounded-[20px] md:rounded-[28px] p-4 md:p-6 flex flex-col min-h-[320px] md:min-h-[340px] lg:min-h-[378px]">
            <div className="flex-1 flex items-start justify-center pt-2">
              <div className="relative w-full aspect-[330/220] max-h-[180px] md:max-h-[200px] lg:max-h-[220px] rounded-[16px] md:rounded-[20px] overflow-hidden">
                <Image
                  src="/images/bento-solana-logo.png"
                  alt="Solana Logo"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-white text-[20px] md:text-[22px] lg:text-[24px] font-semibold leading-[1.2] tracking-[-0.48px] capitalize">
                Built On Solana
              </h3>
              <p className="text-white/70 text-[11px] md:text-[12px] leading-normal tracking-[-0.64px] font-mono">
                Customize reports and dashboards. Adjust layouts and data displays to fit team members' needs, providing insights and helping teams align with your goals.
              </p>
            </div>
          </div>

          <div className="bg-black border border-[#2e3238] rounded-[20px] md:rounded-[28px] overflow-hidden relative min-h-[320px] md:min-h-[340px] lg:min-h-[378px] md:col-span-2 flex flex-col md:block">
            {/* Mobile: Column layout */}
            <div className="flex flex-col gap-6 p-4 md:hidden">
              <div className="flex flex-col gap-2">
                <h3 className="text-white text-[20px] font-semibold leading-[1.2] tracking-[-0.48px]">
                  Built on Solana
                </h3>
                <p className="text-white/70 text-[12px] leading-[1.4] font-mono">
                  Customize reports and dashboards. Adjust layouts to fit team members' needs.
                </p>
              </div>
              
              <div className="relative w-full h-[280px] flex items-center justify-center">
                <div className="relative w-full h-full rounded-[20px] bg-[#0b0b0a] shadow-[0px_13.337px_73.354px_0px_#000000] overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[33px] overflow-hidden opacity-60">
                    <Image
                      src="/images/bento-fill-light.svg"
                      alt=""
                      width={380}
                      height={33}
                      className="w-full h-auto"
                    />
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <div className="relative w-full h-full">
                      <Image
                        src="/images/bento-device.png"
                        alt="Device Preview"
                        fill
                        className="object-contain rounded-[16px]"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </div>
                  </div>

                  <div className="absolute inset-0 pointer-events-none opacity-30">
                    <Image
                      src="/images/bento-mask-outline.svg"
                      alt=""
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tablet & Desktop: Absolute positioning layout */}
            <div className="hidden md:block absolute inset-0 bg-black" />
            
            <div className="hidden md:block absolute right-4 md:right-6 lg:right-12 top-1/2 -translate-y-1/2 w-[40%] md:w-[45%] lg:w-[48%] h-[220px] md:h-[260px] lg:h-[300px] flex items-center justify-center">
              <div className="relative w-full h-full rounded-[16px] md:rounded-[20px] bg-[#0b0b0a] shadow-[0px_13.337px_73.354px_0px_#000000] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[28px] md:h-[33px] overflow-hidden opacity-60">
                  <Image
                    src="/images/bento-fill-light.svg"
                    alt=""
                    width={380}
                    height={33}
                    className="w-full h-auto"
                  />
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center p-3 md:p-4">
                  <div className="relative w-full h-full">
                    <Image
                      src="/images/bento-device.png"
                      alt="Device Preview"
                      fill
                      className="object-contain rounded-[12px] md:rounded-[16px]"
                      sizes="50vw"
                    />
                  </div>
                </div>

                <div className="absolute inset-0 pointer-events-none opacity-30">
                  <Image
                    src="/images/bento-mask-outline.svg"
                    alt=""
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="hidden md:block absolute left-4 md:left-6 lg:left-11 top-1/2 -translate-y-1/2 w-[50%] md:w-[48%] lg:w-[45%] max-w-[220px] md:max-w-[260px] lg:max-w-[327px] z-10 pr-2">
              <h3 className="text-white text-[18px] md:text-[22px] lg:text-[24px] font-semibold leading-[1.2] tracking-[-0.48px] mb-1">
                Built on Solana
              </h3>
              <p className="text-white/70 text-[10px] md:text-[11px] lg:text-[12px] leading-[1.4] font-mono">
                Customize reports and dashboards. Adjust layouts and data displays to fit team members' needs, providing insights and helping teams align with your goals.
              </p>
            </div>
          </div>

          <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[20px] md:rounded-[28px] p-4 md:p-6 flex flex-col min-h-[320px] md:min-h-[340px] lg:min-h-[378px]">
            <div className="flex-1 flex items-start justify-center pt-2">
              <div className="relative w-full aspect-[330/249] max-h-[200px] md:max-h-[220px] lg:max-h-[249px] rounded-[16px] md:rounded-[20px] overflow-hidden">
                <Image
                  src="/images/bento-shield.png"
                  alt="Security Shield"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 md:mt-5">
              <h3 className="text-white text-[20px] md:text-[22px] lg:text-[24px] font-semibold leading-[1.2] tracking-[-0.48px] capitalize">
                Secure And Protected
              </h3>
              <p className="text-white/70 text-[11px] md:text-[12px] leading-normal tracking-[-0.64px] font-mono">
                Customize reports and dashboards. Adjust layouts and data displays to fit team members' needs, providing insights and helping teams align with your goals.
              </p>
            </div>
          </div>

          <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[20px] md:rounded-[28px] p-4 md:p-6 flex items-center justify-center min-h-[320px] md:min-h-[340px] lg:min-h-[378px]">
            <h3 className="text-white text-[24px] md:text-[26px] lg:text-[30px] font-semibold leading-[1.2] tracking-[-0.6px] capitalize text-center whitespace-nowrap">
              Open Source
            </h3>
          </div>

          <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[20px] md:rounded-[28px] p-4 md:p-6 flex flex-col min-h-[320px] md:min-h-[340px] lg:min-h-[378px]">
            <div className="flex-1 flex items-start justify-center pt-2">
              <div className="relative w-full aspect-[330/260] max-h-[210px] md:max-h-[230px] lg:max-h-[260px] rounded-[16px] md:rounded-[20px] overflow-hidden">
                <Image
                  src="/images/bento-octopus.png"
                  alt="Best Prices"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 md:mt-5">
              <h3 className="text-white text-[20px] md:text-[22px] lg:text-[24px] font-semibold leading-[1.2] tracking-[-0.48px] capitalize">
                Get The Best Prices
              </h3>
              <p className="text-white/70 text-[11px] md:text-[12px] leading-normal tracking-[-0.64px] font-mono">
                Customize reports and dashboards. Adjust layouts and data displays to fit team members' needs, providing insights and helping teams align with your goals.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

