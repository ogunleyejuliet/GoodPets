'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);

  const toggleFaq = (index: number) => {
    setFaqOpen(faqOpen === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-sans selection:bg-secondary-container selection:text-on-secondary-container">
      {/* =========================================================================
          1. NAVIGATION
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Brand Logo - Links to Home / */}
            <Link
              href="/"
              className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl p-1 cursor-pointer"
              aria-label="Good Pets Home"
            >
              <Image
                src="/images/logo.svg"
                alt="Good Pets"
                width={160}
                height={37}
                priority
                className="h-9 sm:h-10 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop Navigation Links (Pricing consolidated into Services) */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
              <a
                href="#services"
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors py-[0.5rem] cursor-pointer"
              >
                Services & Pricing
              </a>
              <a
                href="#standards"
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors py-[0.5rem] cursor-pointer"
              >
                Standards
              </a>
              <a
                href="#how-it-works"
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors py-[0.5rem] cursor-pointer"
              >
                How It Works
              </a>
              <a
                href="#faqs"
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors py-[0.5rem] cursor-pointer"
              >
                FAQs
              </a>
              <a
                href="#contact"
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors py-[0.5rem] cursor-pointer"
              >
                Contact
              </a>
            </nav>

            {/* Desktop Right Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/book"
                className="type-label-large text-primary hover:text-on-primary-container px-[1.25rem] py-[0.625rem] rounded-full transition-colors cursor-pointer"
              >
                Sign In
              </Link>
              {/* Primary CTA using primary semantic colour role */}
              <Link
                href="/book"
                className="type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-95 px-[1.5rem] py-[0.625rem] rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
              >
                <span>Book a Service</span>
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Mobile Menu Toggle Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-[0.625rem] rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-outline-variant bg-surface px-4 pt-4 pb-6 space-y-4 shadow-medium animate-in fade-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-3" aria-label="Mobile Navigation">
              <a
                href="#services"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large text-on-surface hover:text-primary px-[0.75rem] py-[0.5rem] rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                Services & Pricing
              </a>
              <a
                href="#standards"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large text-on-surface hover:text-primary px-[0.75rem] py-[0.5rem] rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                Standards
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large text-on-surface hover:text-primary px-[0.75rem] py-[0.5rem] rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                How It Works
              </a>
              <a
                href="#faqs"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large text-on-surface hover:text-primary px-[0.75rem] py-[0.5rem] rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                FAQs
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large text-on-surface hover:text-primary px-[0.75rem] py-[0.5rem] rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                Contact & Support
              </a>
            </nav>
            <div className="pt-4 border-t border-outline-variant flex flex-col gap-3">
              <Link
                href="/book"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large w-full text-center py-[0.75rem] text-primary border border-outline rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                onClick={() => setMobileMenuOpen(false)}
                className="type-label-large w-full text-center py-[0.75rem] bg-primary text-on-primary rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
              >
                Book a Service
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* =========================================================================
            2. HERO SECTION
            ========================================================================= */}
        <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Text Content (~58% desktop width) */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2 px-[0.875rem] py-[0.375rem] rounded-full bg-primary-container text-on-primary-container type-label-small uppercase tracking-wider mb-6 shadow-soft">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Premium Pet Care in Lagos</span>
                </div>

                {/* Headline: Responsive clamp + deliberate max width */}
                <h1 className="max-w-[18ch] sm:max-w-2xl text-[clamp(2.25rem,4.5vw+1rem,3.5625rem)] font-extrabold tracking-tight text-on-surface leading-[1.18] text-balance">
                  Your Pet’s <span className="text-primary">Favourite</span> Place.
                </h1>

                {/* Supporting copy */}
                <p className="mt-6 text-lg sm:text-xl text-on-surface-variant leading-relaxed max-w-xl">
                  From grooming and playful daycare to comfortable overnight stays, we make every visit a happy experience for you and your pet.
                </p>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  {/* Primary CTA using primary semantic colour role and rem padding */}
                  <Link
                    href="/book"
                    className="type-label-large inline-flex items-center justify-center gap-3 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-[2rem] py-[0.875rem] rounded-full shadow-soft hover:shadow-medium transition-all text-center cursor-pointer"
                  >
                    <span>Book a Service</span>
                    <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>

                  {/* Secondary CTA */}
                  <a
                    href="#services"
                    className="type-label-large inline-flex items-center justify-center gap-2 bg-surface text-primary border border-outline hover:bg-surface-container-low active:scale-[0.98] px-[2rem] py-[0.875rem] rounded-full transition-all text-center cursor-pointer"
                  >
                    <span>Explore Our Services</span>
                  </a>
                </div>

                {/* Service indicator */}
                <div className="mt-10 pt-6 border-t border-outline-variant flex flex-wrap items-center gap-y-2 gap-x-4 text-sm font-semibold text-on-surface-variant">
                  <span className="text-on-surface font-bold">Services:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Grooming
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Daycare
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> Boarding
                  </span>
                </div>
              </div>

              {/* Right Column: Imagery (~42% desktop width) */}
              <div className="lg:col-span-5 relative mt-6 lg:mt-0">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  {/* Outer Glow */}
                  <div className="absolute -inset-2 bg-primary-container rounded-[2.5rem] blur-xl opacity-40" />

                  {/* Image Frame */}
                  <div className="relative rounded-3xl overflow-hidden border border-outline-variant bg-surface shadow-medium aspect-[4/3]">
                    <Image
                      src="/images/hero-grooming.jpg"
                      alt="A happy golden retriever enjoying gentle grooming and brushing in a sunlit pet salon in Lagos"
                      width={600}
                      height={450}
                      priority
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Overlay Badge */}
                  <div className="absolute -bottom-4 -left-4 sm:bottom-4 sm:-left-6 bg-surface/95 backdrop-blur-md p-4 rounded-2xl border border-outline-variant shadow-medium max-w-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-lg shrink-0">
                      ★
                    </div>
                    <div>
                      <div className="text-xs font-bold text-on-surface">5-Star Care Guaranteed</div>
                      <div className="text-[11px] text-on-surface-variant">Experienced staff & clean suites</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. CONSOLIDATED SERVICES & PRICING SECTION
            (Consolidates previous separate #services and #pricing sections)
            ========================================================================= */}
        <section id="services" className="py-20 bg-background border-t border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-block px-[0.875rem] py-[0.25rem] rounded-full bg-secondary-container text-on-secondary-container type-label-small uppercase tracking-wider mb-3">
                Transparent Rates & Tailored Care
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Our Services & Pricing
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                Clear pricing, upfront policies, and no hidden fees. All rates in Nigerian Naira (NGN).
              </p>
            </div>

            {/* 3 Core Services Cards with Built-in Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Service 1: Grooming */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-grooming.jpg"
                      alt="Gentle dog bathing and grooming in Victoria Island"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-primary text-on-primary text-xs font-bold px-[0.75rem] py-[0.25rem] rounded-full shadow-soft">
                      Dog & Cat Salon
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xl font-bold text-on-surface">Grooming</h3>
                      <div className="text-right">
                        <span className="text-xs text-on-surface-variant block">From</span>
                        <span className="text-lg font-extrabold text-primary">₦12,000</span>
                      </div>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                      Bathing, trimming, coat care, ear cleaning, and nail clipping for dogs and cats of all sizes.
                    </p>
                    <div className="border-t border-outline-variant pt-4 space-y-2.5">
                      <div className="text-xs font-bold text-on-surface">Package Overview:</div>
                      <div className="flex items-center justify-between text-xs text-on-surface-variant">
                        <span>Basic Bath (Small Dog / Cat)</span>
                        <span className="font-semibold text-on-surface">₦12,000 / ₦15,000</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-on-surface-variant">
                        <span>Full Groom (Bath + Haircut)</span>
                        <span className="font-semibold text-on-surface">From ₦20,000</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-on-surface-variant">
                        <span>Premium Groom (with Teeth & Deshed)</span>
                        <span className="font-semibold text-on-surface">From ₦25,000</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <Link
                    href="/book?service=grooming"
                    className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] py-[0.75rem] px-[1.5rem] rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
                  >
                    <span>Book Grooming</span>
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Service 2: Daycare */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-daycare.jpg"
                      alt="Energetic dogs playing safely in our daycare yard"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-secondary text-on-secondary text-xs font-bold px-[0.75rem] py-[0.25rem] rounded-full shadow-soft">
                      Supervised Play
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xl font-bold text-on-surface">Daycare</h3>
                      <div className="text-right">
                        <span className="text-xs text-on-surface-variant block">Flat Rate</span>
                        <span className="text-lg font-extrabold text-primary">₦12,000</span>
                        <span className="text-xs text-on-surface-variant"> / day</span>
                      </div>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                      Supervised play, gentle socialisation, and regular exercise while you work or run errands in Lagos.
                    </p>
                    <div className="border-t border-outline-variant pt-4 space-y-2.5">
                      <div className="text-xs font-bold text-on-surface">What is included:</div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-secondary font-bold">✓</span>
                        <span>07:00 – 19:00 hours with staff supervision</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-secondary font-bold">✓</span>
                        <span>Separated play areas for small & large pets</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-secondary font-bold">✓</span>
                        <span>Rest periods & filtered fresh drinking water</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <Link
                    href="/book?service=daycare"
                    className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] py-[0.75rem] px-[1.5rem] rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
                  >
                    <span>Book Daycare</span>
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Service 3: Boarding */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-boarding.jpg"
                      alt="Clean, cozy overnight boarding suite for pets in Lagos"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-tertiary text-on-tertiary text-xs font-bold px-[0.75rem] py-[0.25rem] rounded-full shadow-soft">
                      Overnight Stays
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xl font-bold text-on-surface">Boarding</h3>
                      <div className="text-right">
                        <span className="text-xs text-on-surface-variant block">Per Night</span>
                        <span className="text-lg font-extrabold text-primary">₦25,000</span>
                        <span className="text-xs text-on-surface-variant"> / night</span>
                      </div>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                      Private, climate-controlled suites with 24/7 on-site attendant supervision when you are travelling.
                    </p>
                    <div className="border-t border-outline-variant pt-4 space-y-2.5">
                      <div className="text-xs font-bold text-on-surface">What is included:</div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-tertiary font-bold">✓</span>
                        <span>Private kennel suite with orthopedic bedding</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-tertiary font-bold">✓</span>
                        <span>Scheduled morning, afternoon & evening care</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <span className="text-tertiary font-bold">✓</span>
                        <span>Mandatory vaccination safety (DHPP / FVRCP)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <Link
                    href="/book?service=boarding"
                    className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] py-[0.75rem] px-[1.5rem] rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
                  >
                    <span>Book Boarding</span>
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. STANDARDS & POLICIES
            ========================================================================= */}
        <section id="standards" className="py-20 bg-surface-container-low border-t border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-block px-[0.875rem] py-[0.25rem] rounded-full bg-primary-container text-on-primary-container type-label-small uppercase tracking-wider mb-3">
                Health & Safety First
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Our Pet Care Standards
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                We believe pet owners deserve complete peace of mind. Every pet in our care is protected by strict hygiene and verified safety protocols.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-soft">
                <div className="w-12 h-12 rounded-xl bg-primary-container text-primary flex items-center justify-center font-bold text-xl mb-4">
                  💉
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Mandatory Vaccinations</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  All dogs must be up to date on DHPP, and all cats on FVRCP. Evidence is verified at check-in.
                </p>
              </div>

              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-soft">
                <div className="w-12 h-12 rounded-xl bg-secondary-container text-secondary flex items-center justify-center font-bold text-xl mb-4">
                  🛡️
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Secure Pickup Authorization</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Only the registered owner or up to 3 authorized collectors with government photo ID may collect a pet.
                </p>
              </div>

              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-soft">
                <div className="w-12 h-12 rounded-xl bg-tertiary-container text-tertiary flex items-center justify-center font-bold text-xl mb-4">
                  🧹
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Hospital-Grade Sanitation</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Suites and play spaces are deep-cleaned twice daily with pet-safe veterinary disinfectants.
                </p>
              </div>

              <div className="bg-surface rounded-2xl p-6 border border-outline-variant shadow-soft">
                <div className="w-12 h-12 rounded-xl bg-warning-container text-on-warning-container flex items-center justify-center font-bold text-xl mb-4">
                  📅
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Flexible Rescheduling</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Reschedule bookings within the cut-off window at zero extra cost. Capacity is held in real time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. HOW IT WORKS
            ========================================================================= */}
        <section id="how-it-works" className="py-20 bg-background border-t border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="inline-block px-[0.875rem] py-[0.25rem] rounded-full bg-secondary-container text-on-secondary-container type-label-small uppercase tracking-wider mb-3">
                Simple & Guaranteed
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                How Booking Works
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant">
                From selecting a date to safe arrival and pickup in Victoria Island.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-xl shadow-soft mb-6">
                  1
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Choose Service</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Pick grooming, daycare, or boarding, and enter your pet’s details and size.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-xl shadow-soft mb-6">
                  2
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Instant Hold</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Real-time capacity is held immediately on our database while you checkout.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-xl shadow-soft mb-6">
                  3
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Pay Securely</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Complete payment via Paystack test mode by card or bank transfer.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-extrabold text-xl shadow-soft mb-6">
                  4
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Drop-off & Enjoy</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Check in at our Victoria Island desk with your booking reference.
                </p>
              </div>
            </div>

            <div className="mt-14 text-center">
              <Link
                href="/book"
                className="type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-95 px-[2rem] py-[0.875rem] rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer"
              >
                <span>Book Your Pet’s Visit</span>
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. FAQS SECTION
            ========================================================================= */}
        <section id="faqs" className="py-20 bg-surface-container-low border-t border-outline-variant">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="inline-block px-[0.875rem] py-[0.25rem] rounded-full bg-primary-container text-on-primary-container type-label-small uppercase tracking-wider mb-3">
                Got Questions?
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'Where are you located and what are your opening hours?',
                  a: 'Good Pets is located at 14 Plot 12, Victoria Island, Lagos. We are open Monday to Saturday from 07:00 to 19:00 for daycare and grooming. Boarding runs 24/7 with round-the-clock staff supervision.',
                },
                {
                  q: 'What vaccinations are required before booking?',
                  a: 'Dogs require up-to-date DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza). Cats require up-to-date FVRCP. You must present valid veterinary vaccination evidence upon arrival.',
                },
                {
                  q: 'Can I reschedule my booking?',
                  a: 'Yes! Confirmed bookings can be rescheduled inside the cut-off window (2 days for grooming, 1 day for daycare, 4 days for boarding) at no extra charge, subject to available capacity.',
                },
                {
                  q: 'Can someone else pick up my pet?',
                  a: 'Yes. Through your account, you can authorize up to 3 people per booking to collect your pet. Authorized collectors must present a valid government photo ID matching their registered name.',
                },
                {
                  q: 'Are refunds available if I need to cancel?',
                  a: 'Good Pets operates a strict no-refunds policy. However, you can reschedule your booking to later dates within the permitted window without losing your payment.',
                },
              ].map((faq, index) => (
                <div
                  key={index}
                  className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-soft"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between text-left p-6 gap-4 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={faqOpen === index}
                  >
                    <span className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                      {faq.q}
                    </span>
                    <span
                      className={`w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-sm font-bold transition-transform ${
                        faqOpen === index ? 'rotate-180 bg-primary text-on-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      ↓
                    </span>
                  </button>
                  {faqOpen === index && (
                    <div className="px-6 pb-6 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          7. FOOTER
          ========================================================================= */}
      <footer id="contact" className="bg-surface-container-highest border-t border-outline-variant pt-16 pb-12 text-on-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-outline-variant">
            <div className="md:col-span-1 space-y-4">
              <Link href="/" className="flex items-center gap-2 cursor-pointer" aria-label="Good Pets Home">
                <Image
                  src="/images/logo.svg"
                  alt="Good Pets"
                  width={140}
                  height={32}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Premium dog and cat care in Victoria Island, Lagos. Verified bookings, live availability, and dedicated pet specialists.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface">Quick Links</div>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#services" className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    Services & Pricing
                  </a>
                </li>
                <li>
                  <a href="#standards" className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    Safety Standards
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#faqs" className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    FAQs
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface">Contact & Visit</div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                14 Plot 12, Victoria Island, Lagos, Nigeria
              </p>
              <p className="text-xs text-on-surface-variant">Phone: +234 1 234 5678</p>
              <p className="text-xs text-on-surface-variant">Email: info@goodpets.ng</p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface">Hours & Policies</div>
              <p className="text-xs text-on-surface-variant">Mon – Sat: 07:00 – 19:00</p>
              <p className="text-xs text-on-surface-variant">Boarding: 24/7 on-site attendant</p>
              <p className="text-xs text-on-surface-variant pt-2 border-t border-outline-variant">
                Strict no-refunds policy. Reschedule inside window.
              </p>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-on-surface-variant gap-4">
            <p>© {new Date().getFullYear()} Good Pets Ltd. All rights reserved.</p>
            <p>Portfolio Project · Victoria Island, Lagos, Nigeria</p>
          </div>
        </div>
      </footer>

      {/* Floating AI Assistant Trigger */}
      <button
        type="button"
        onClick={() => setAssistantModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2.5 bg-primary text-on-primary hover:brightness-105 active:scale-95 px-[1.25rem] py-[0.75rem] rounded-full shadow-medium hover:shadow-hard transition-all type-label-large cursor-pointer group"
        aria-label="Open AI Assistant"
      >
        <span className="text-lg">🐾</span>
        <span>Ask AI Assistant</span>
      </button>

      {/* Assistant Modal */}
      {assistantModalOpen && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-3xl max-w-lg w-full p-6 shadow-hard animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold">
                  🐾
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Good Pets Assistant</h3>
                  <p className="text-xs text-on-surface-variant">Live information on prices & availability</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssistantModalOpen(false)}
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container cursor-pointer"
                aria-label="Close assistant"
              >
                ✕
              </button>
            </div>

            <div className="py-6 space-y-4 max-h-80 overflow-y-auto">
              <div className="bg-surface-container p-4 rounded-2xl text-xs text-on-surface leading-relaxed">
                Hello! I can answer questions about Good Pets grooming packages, daycare hours, boarding suites, and live availability in Victoria Island. How can I help you today?
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant flex items-center gap-3">
              <input
                type="text"
                placeholder="Ask about prices, vaccines, hours..."
                className="flex-1 bg-surface-container px-4 py-2.5 rounded-full text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant"
              />
              <button
                type="button"
                className="type-label-large bg-primary text-on-primary px-[1.25rem] py-[0.625rem] rounded-full hover:brightness-105 cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

