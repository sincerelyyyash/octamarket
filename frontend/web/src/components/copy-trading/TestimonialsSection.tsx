import React from 'react';
import Marquee from 'react-fast-marquee';
import TestimonialCard from './TestimonialCard';

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Ashish',
      content: 'We offer two different trading strategies. If you primarily pursue safety and low risk, choose Perpetual Futures and use the Pos...',
    },
    {
      name: 'Yash',
      content: 'Amazing platform! The copy trading feature has helped me learn from the best traders while minimizing my risk.',
    },
    {
      name: 'Harkirat',
      content: 'The interface is intuitive and the performance tracking is excellent. Highly recommend for beginners.',
    },
    {
      name: 'Raman',
      content: 'Been using this for 6 months now. The community insights and trader analytics are incredibly valuable.',
    },
    {
      name: 'Anirudha',
      content: 'Great way to diversify my portfolio by following successful trading strategies automatically.',
    },
    {
      name: 'Aman',
      content: 'The risk management tools and stop-loss features give me peace of mind while copy trading.',
    },
  ];

  return (
    <section className="mb-12 sm:mb-16">
      <div className="mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tightest mb-2">Traders say...</h2>
      </div>

      <Marquee
        speed={50}
        className="py-4"
        pauseOnHover={true}
      >
        {testimonials.map((testimonial, index) => (
          <div key={index} className="mr-4 sm:mr-6 flex-shrink-0 w-72 sm:w-80">
            <TestimonialCard name={testimonial.name} content={testimonial.content} />
          </div>
        ))}
      </Marquee>
    </section>
  );
}

