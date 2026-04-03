import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import BackButton from '../components/BackButton';

const pillars = [
  {
    title: 'Ignite',
    description: 'LAST GEAR began as a bigger company idea. Fashion became the first startup under that universe because clothing is where energy, identity, and ambition can be felt instantly.',
  },
  {
    title: 'Shift',
    description: 'We want people to feel a transition when they enter LAST GEAR Fashion, from ordinary online shopping into a sharper, more premium environment with attitude and intent.',
  },
  {
    title: 'Arrive',
    description: 'Every collection is designed to help customers look like they know where they are going. Stronger presence, premium feel, and pieces that carry momentum.',
  },
];

const values = [
  {
    icon: Sparkles,
    title: 'Distinct Direction',
    description: 'We are not building a forgettable storefront. LAST GEAR is meant to feel cinematic, creative, and memorable from the first scroll.',
  },
  {
    icon: Rocket,
    title: 'Founder Energy',
    description: 'This brand carries first-startup hunger. The page, products, and communication all need to feel like the beginning of something ambitious.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust + Quality',
    description: 'Premium visuals only matter when matched by customer confidence, strong product quality, and clear support.',
  },
];

const About = () => {
  return (
    <div className="bg-[#f3efe7] text-[#120e0b]">
      <section className="relative overflow-hidden border-b border-black/10 bg-[#120e0b] py-24 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,145,70,0.34),transparent_28%),linear-gradient(120deg,rgba(18,14,11,0.96),rgba(18,14,11,0.72),rgba(18,14,11,0.92))]" />
        <div className="lastgear-grid absolute inset-0 opacity-20" />

        <div className="relative mx-auto max-w-7xl px-4 md:px-6">
          <BackButton label="Back" className="mb-8 text-white" />
          <div className="max-w-4xl">
            <p className="font-nav text-sm text-[#d99146]">About LAST GEAR</p>
            <h1 className="mt-5 font-nav text-[2.8rem] leading-[0.94] text-[#f8f2ea] md:text-[4.5rem]">
              More Than A Brand.
              <span className="block text-transparent stroke-text">A Beginning.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
              LAST GEAR is our company vision. LAST GEAR Fashion is the first startup under that vision, created to make fashion feel bold, fresh, and alive with creative energy.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="font-nav text-sm text-[#8d5f32]">Our Story</p>
            <h2 className="mt-3 font-nav text-4xl leading-[1] text-[#120e0b] md:text-5xl">
              Why LAST GEAR
              <span className="block">Fashion Came First</span>
            </h2>
          </div>
          <div className="space-y-6 text-base leading-8 text-black/68">
            <p>
              LAST GEAR Fashion is our first real step into building something of our own. We wanted the first startup in our life to carry originality, confidence, and a strong visual signature.
            </p>
            <p>
              Fashion became the starting point because it lets people experience a brand immediately. What they see, what they wear, and how they feel in it all become part of the same identity.
            </p>
            <p>
              That is why LAST GEAR is not just about selling products. It is about creating a premium environment where the customer feels the brand attitude before they even choose a piece.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#e6ddcf] py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-12 max-w-3xl">
            <p className="font-nav text-sm text-[#8d5f32]">How We Think</p>
            <h2 className="mt-3 font-nav text-4xl leading-[1] text-[#120e0b] md:text-5xl">
              The LAST GEAR
              <span className="block">Mindset</span>
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {pillars.map((pillar, index) => (
              <div key={pillar.title} className="rounded-[32px] border border-black/10 bg-white/75 p-8 shadow-[0_18px_50px_rgba(15,10,6,0.08)]">
                <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#120e0b] text-[#f1e6d8]">
                  <span className="font-nav text-2xl">{index + 1}</span>
                </div>
                <h3 className="font-nav text-3xl text-[#120e0b]">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-7 text-black/68">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-nav text-sm text-[#8d5f32]">What We Want People To Feel</p>
            <h2 className="mt-3 font-nav text-4xl leading-[1] text-[#120e0b] md:text-5xl">
              Built To Leave
              <span className="block">An Impression</span>
            </h2>
          </div>
          <p className="max-w-xl text-base leading-8 text-black/64">
            The creativity is not there just for us. It is there so the customer feels they landed somewhere premium, unique, and worth remembering.
          </p>
        </div>

        <div className="grid gap-6">
          {values.map((value) => {
            const Icon = value.icon;

            return (
              <div key={value.title} className="rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-[0_16px_44px_rgba(15,10,6,0.06)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#120e0b] text-[#f1e6d8]">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-nav text-3xl text-[#120e0b]">{value.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-black/68">{value.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-black/10 bg-[#120e0b] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/8 px-4 py-2 font-nav text-xs text-white/70">
                <Compass size={14} />
                <span>The First Chapter</span>
              </div>
              <h2 className="font-nav text-4xl leading-[1] text-[#f8f2ea] md:text-5xl">
                LAST GEAR Fashion
                <span className="block text-[#d99146]">Starts Here</span>
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/68">
                The homepage shows the products first. This page tells the deeper story behind them. Together, they make LAST GEAR feel both premium and purposeful.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row lg:justify-end">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#f1e6d8] px-8 py-4 font-nav text-sm text-[#120e0b] transition hover:bg-white"
              >
                Shop Products
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 px-8 py-4 font-nav text-sm text-white transition hover:bg-white/10"
              >
                Back To Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
