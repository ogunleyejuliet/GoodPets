'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export default function HomePage() {
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
            {/* Brand Logo */}
            <a
              href="#"
              className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl p-1"
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
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
              <a
                href="#services"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                Services
              </a>
              <a
                href="#pricing"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                Pricing
              </a>
              <a
                href="#standards"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                About Us
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                How It Works
              </a>
              <a
                href="#contact"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-2"
              >
                Contact
              </a>
            </nav>

            {/* Desktop Right Actions */}
            <div className="hidden md:flex items-center gap-4">
              <a
                href="#signin"
                className="text-sm font-bold text-primary hover:text-on-primary-container px-4 py-2.5 rounded-full transition-colors"
              >
                Sign In
              </a>
              {/* Primary CTA using secondary semantic colour role */}
              <a
                href="/book"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-95 text-sm font-bold px-6 py-2.5 rounded-full shadow-soft hover:shadow-medium transition-all"
              >
                <span>Book a Service</span>
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>

            {/* Mobile Menu Toggle Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="text-base font-semibold text-on-surface hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                Services
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-on-surface hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                Pricing Overview
              </a>
              <a
                href="#standards"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-on-surface hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                About Us & Standards
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-on-surface hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                How It Works
              </a>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-on-surface hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors"
              >
                Contact & Support
              </a>
            </nav>
            <div className="pt-4 border-t border-outline-variant flex flex-col gap-3">
              <a
                href="#signin"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 text-sm font-bold text-primary border border-outline rounded-full hover:bg-surface-container-low transition-colors"
              >
                Sign In
              </a>
              <a
                href="/book"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-3 text-sm font-bold bg-secondary text-on-secondary rounded-full shadow-soft hover:shadow-medium transition-all"
              >
                Book a Service
              </a>
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
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-6 shadow-soft">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Premium Pet Care in Lagos</span>
                </div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-on-surface leading-[1.12]">
                  Your Pet’s <span className="text-primary">Favourite</span> Place.
                </h1>

                {/* Supporting copy */}
                <p className="mt-6 text-lg sm:text-xl text-on-surface-variant leading-relaxed max-w-xl">
                  From grooming and playful daycare to comfortable overnight stays, we make every visit a happy experience for you and your pet.
                </p>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                  {/* Primary CTA using secondary semantic colour role */}
                  <a
                    href="/book"
                    className="inline-flex items-center justify-center gap-3 bg-secondary text-on-secondary hover:brightness-105 active:scale-[0.98] text-base font-bold px-8 py-4 rounded-full shadow-soft hover:shadow-medium transition-all text-center"
                  >
                    <span>Book a Service</span>
                    <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>

                  {/* Secondary CTA */}
                  <a
                    href="#services"
                    className="inline-flex items-center justify-center gap-2 bg-surface text-primary border border-outline hover:bg-surface-container-low active:scale-[0.98] text-base font-bold px-8 py-4 rounded-full transition-all text-center"
                  >
                    <span>Explore Our Services</span>
                  </a>
                </div>

                {/* Service indicator */}
                <div className="mt-10 pt-6 border-t border-outline-variant/70 flex flex-wrap items-center gap-y-2 gap-x-4 text-sm font-semibold text-on-surface-variant">
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
                  {/* Outer Decorative Glow Container */}
                  <div className="absolute -inset-2 bg-primary-container/40 rounded-[2.5rem] blur-xl opacity-70" />

                  {/* Image Frame */}
                  <div className="relative rounded-3xl overflow-hidden border border-outline-variant bg-surface shadow-medium aspect-[4/3] sm:aspect-[4/3] lg:aspect-[4/3]">
                    <Image
                      src="/images/hero-grooming.jpg"
                      alt="A happy golden retriever enjoying gentle grooming and brushing in a sunlit pet salon in Lagos"
                      fill
                      priority
                      className="object-cover object-center transform hover:scale-105 transition-transform duration-700 ease-out"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 540px"
                    />
                  </div>

                  {/* Floating Trust Badge */}
                  <div className="absolute -bottom-5 -left-3 sm:-left-6 bg-surface p-4 rounded-2xl shadow-medium border border-outline-variant flex items-center gap-3 max-w-[260px] animate-in fade-in duration-700">
                    <div className="w-10 h-10 rounded-xl bg-success-container text-on-success-container flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Verified Care & Safety</p>
                      <p className="text-[11px] text-on-surface-variant">Capacity-held spots & verified pickup</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. SERVICES SECTION
            ========================================================================= */}
        <section id="services" className="py-20 bg-background border-t border-outline-variant/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="inline-block px-3.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-3">
                Our Services
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Our Services
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                Thoughtful care for every paw, from a fresh groom to a comfortable overnight stay.
              </p>
            </div>

            {/* Three Image-Led Service Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card 1: Grooming */}
              <article className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden shadow-soft hover:shadow-medium transition-all group">
                <div className="relative aspect-[16/10] overflow-hidden bg-surface-container">
                  <Image
                    src="/images/service-grooming.jpg"
                    alt="A friendly dog enjoying a gentle bath with natural pet shampoo"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                  />
                  <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary border border-outline-variant">
                    Dogs & Cats
                  </div>
                </div>

                <div className="p-7 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-on-surface tracking-tight">
                    Grooming
                  </h3>

                  {/* Price */}
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-primary">From ₦12,000</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant italic">
                    Final price depends on selected package, species, and dog size tier.
                  </p>

                  <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">
                    Full bath, brush, styling, nail trim, and ear hygiene performed by patient, attentive groomers in dedicated 1-on-1 sessions.
                  </p>

                  <ul className="mt-6 space-y-2 text-xs font-medium text-on-surface-variant">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Basic Bath, Full Groom & Premium Spa options</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Small, Medium, and Large dog size pricing</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Fixed 2-pet slot capacity for calm care</span>
                    </li>
                  </ul>

                  <div className="mt-8 pt-6 border-t border-outline-variant mt-auto">
                    <a
                      href="#grooming"
                      className="inline-flex items-center justify-between w-full text-sm font-bold text-primary group-hover:text-on-primary-container transition-colors"
                    >
                      <span>Explore Service Details</span>
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>

              {/* Card 2: Daycare */}
              <article className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden shadow-soft hover:shadow-medium transition-all group">
                <div className="relative aspect-[16/10] overflow-hidden bg-surface-container">
                  <Image
                    src="/images/service-daycare.jpg"
                    alt="Playful dogs socializing happily in a bright, modern, supervised pet daycare lounge"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                  />
                  <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-secondary border border-outline-variant">
                    Social Daytime Care
                  </div>
                </div>

                <div className="p-7 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-on-surface tracking-tight">
                    Daycare
                  </h3>

                  {/* Price */}
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-primary">₦12,000</span>
                    <span className="text-xs font-semibold text-on-surface-variant">per pet / calendar day</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant italic">
                    Both drop-off and pickup days are counted. 07:00 – 18:00 Lagos time.
                  </p>

                  <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">
                    A vibrant, safe environment where your dog enjoys supervised socialization, interactive play, and dedicated quiet rest areas during your busy workday.
                  </p>

                  <ul className="mt-6 space-y-2 text-xs font-medium text-on-surface-variant">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Capacity-limited to 20 pets per day</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Continuous caregiver supervision</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Scheduled hydration and midday rest times</span>
                    </li>
                  </ul>

                  <div className="mt-8 pt-6 border-t border-outline-variant mt-auto">
                    <a
                      href="#daycare"
                      className="inline-flex items-center justify-between w-full text-sm font-bold text-primary group-hover:text-on-primary-container transition-colors"
                    >
                      <span>Explore Service Details</span>
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>

              {/* Card 3: Boarding */}
              <article className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden shadow-soft hover:shadow-medium transition-all group">
                <div className="relative aspect-[16/10] overflow-hidden bg-surface-container">
                  <Image
                    src="/images/service-boarding.jpg"
                    alt="A calm, relaxed dog sleeping comfortably on an orthopedic plush bed in a cozy boarding suite"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                  />
                  <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-tertiary border border-outline-variant">
                    Overnight Boarding
                  </div>
                </div>

                <div className="p-7 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-on-surface tracking-tight">
                    Boarding
                  </h3>

                  {/* Price */}
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-primary">₦25,000</span>
                    <span className="text-xs font-semibold text-on-surface-variant">per pet / night</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant italic">
                    Counted strictly by nights from check-in to check-out.
                  </p>

                  <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">
                    Peaceful, comfortable overnight care in private suites with orthopedic bedding, bedtime routines, and attentive round-the-clock staff monitoring.
                  </p>

                  <ul className="mt-6 space-y-2 text-xs font-medium text-on-surface-variant">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Private, climate-regulated sleeping suites</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Custom feeding schedules according to your routine</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Strict 10-pet overnight capacity limit</span>
                    </li>
                  </ul>

                  <div className="mt-8 pt-6 border-t border-outline-variant mt-auto">
                    <a
                      href="#boarding"
                      className="inline-flex items-center justify-between w-full text-sm font-bold text-primary group-hover:text-on-primary-container transition-colors"
                    >
                      <span>Explore Service Details</span>
                      <svg className="w-4 h-4 stroke-current stroke-2 fill-none group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. PRICING OVERVIEW
            ========================================================================= */}
        <section id="pricing" className="py-20 bg-surface-container-low border-t border-outline-variant/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-block px-3.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-3">
                Transparent Rates
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Simple, Transparent Pricing
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                No hidden charges, taxes, or surprise booking fees. Every price is fixed and verified before booking confirmation.
              </p>
            </div>

            {/* Structured Comparative Matrix */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 sm:p-8 lg:p-10 shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b border-outline-variant text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      <th className="pb-4 font-bold text-on-surface">Service</th>
                      <th className="pb-4 font-bold text-on-surface">Base Rate (NGN)</th>
                      <th className="pb-4 font-bold text-on-surface">Billing Unit</th>
                      <th className="pb-4 font-bold text-on-surface">Capacity & Terms</th>
                      <th className="pb-4 font-bold text-on-surface">Cut-Off Reschedule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-sm">
                    {/* Grooming row */}
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-5 pr-4">
                        <div className="font-bold text-base text-on-surface">Grooming</div>
                        <div className="text-xs text-on-surface-variant">Bath, Full Groom, or Premium Spa</div>
                      </td>
                      <td className="py-5 pr-4 font-bold text-primary text-base">
                        From ₦12,000
                      </td>
                      <td className="py-5 pr-4 text-on-surface-variant font-medium">
                        Per pet / session
                      </td>
                      <td className="py-5 pr-4 text-xs text-on-surface-variant leading-relaxed">
                        2 pets per slot (09:00, 12:00, 15:00)
                      </td>
                      <td className="py-5 text-xs font-semibold text-on-surface">
                        2 days before Lagos date
                      </td>
                    </tr>

                    {/* Daycare row */}
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-5 pr-4">
                        <div className="font-bold text-base text-on-surface">Daycare</div>
                        <div className="text-xs text-on-surface-variant">Supervised playtime & socialization</div>
                      </td>
                      <td className="py-5 pr-4 font-bold text-primary text-base">
                        ₦12,000
                      </td>
                      <td className="py-5 pr-4 text-on-surface-variant font-medium">
                        Per pet / calendar day
                      </td>
                      <td className="py-5 pr-4 text-xs text-on-surface-variant leading-relaxed">
                        20 pets total daily capacity
                      </td>
                      <td className="py-5 text-xs font-semibold text-on-surface">
                        1 day before Lagos date
                      </td>
                    </tr>

                    {/* Boarding row */}
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-5 pr-4">
                        <div className="font-bold text-base text-on-surface">Boarding</div>
                        <div className="text-xs text-on-surface-variant">Private overnight restful suite</div>
                      </td>
                      <td className="py-5 pr-4 font-bold text-primary text-base">
                        ₦25,000
                      </td>
                      <td className="py-5 pr-4 text-on-surface-variant font-medium">
                        Per pet / night
                      </td>
                      <td className="py-5 pr-4 text-xs text-on-surface-variant leading-relaxed">
                        10 pets total nightly capacity
                      </td>
                      <td className="py-5 text-xs font-semibold text-on-surface">
                        3 days before Lagos date
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Late Pickup & Policy Note */}
              <div className="mt-8 pt-6 border-t border-outline-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-container-low p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">i</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Late Pickup Policy & Cash Settlement
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Daycare pickups after 18:00 closing time incur a ₦5,000 late fee settled in cash at the front desk.
                    </p>
                  </div>
                </div>

                <a
                  href="/book"
                  className="inline-flex items-center gap-2 text-sm font-bold bg-secondary text-on-secondary px-6 py-2.5 rounded-full hover:brightness-105 transition-all shadow-soft shrink-0"
                >
                  <span>Book at These Rates</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. TRUST AND CARE STANDARDS
            ========================================================================= */}
        <section id="standards" className="py-20 bg-background border-t border-outline-variant/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Column: Authentic Photography */}
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="relative">
                  <div className="rounded-3xl overflow-hidden border border-outline-variant bg-surface shadow-medium aspect-[4/3]">
                    <Image
                      src="/images/care-standards.jpg"
                      alt="Compassionate pet caregiver gently comforting a happy dog and cat in a pristine pet care environment"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 500px"
                    />
                  </div>

                  {/* Highlights Callout Box */}
                  <div className="mt-4 p-5 bg-surface-container-low border border-outline-variant rounded-2xl">
                    <p className="text-xs font-bold text-on-surface flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      Vaccination Evidence Required
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      To safeguard all guests, current DHPP for dogs and FVRCP for cats are required before admission.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Standards & Values */}
              <div className="lg:col-span-7 order-1 lg:order-2 flex flex-col">
                <span className="inline-block px-3.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-3 self-start">
                  Why Good Pets
                </span>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight leading-tight">
                  Care You Can Feel Good About.
                </h2>

                <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                  We believe great pet care means happy pets, informed owners, and a dependable experience from booking to pickup.
                </p>

                {/* Three Core Themes */}
                <div className="mt-8 space-y-6">
                  {/* Theme 1: Care & Comfort */}
                  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-surface-container-low transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">Care & Comfort</h4>
                      <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                        Gentle handling tailored to your pet’s temperament, clean and temperature-controlled indoor lounges, and peaceful rest areas so every guest feels safe and loved.
                      </p>
                    </div>
                  </div>

                  {/* Theme 2: Thoughtful Care Standards */}
                  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-surface-container-low transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">Thoughtful Care Standards</h4>
                      <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                        Rigorous sanitation routines, vaccination screening, and strictly capped daily capacities to prevent overcrowding and maintain high caregiver-to-pet ratios.
                      </p>
                    </div>
                  </div>

                  {/* Theme 3: Clear & Convenient */}
                  <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-surface-container-low transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-on-surface">Clear & Convenient</h4>
                      <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                        Instant live availability, secure online payment, flexible rescheduling policies, and verified authorized pickup protocols to keep your pet secure at all times.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. HOW IT WORKS
            ========================================================================= */}
        <section id="how-it-works" className="py-20 bg-surface-container-low border-t border-outline-variant/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="inline-block px-3.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-3">
                Simple Booking
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Great Care in Three Simple Steps.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                Booking premium pet care in Victoria Island is fast, transparent, and completely confirmed before you arrive.
              </p>
            </div>

            {/* Three Step Sequence in Horizontal Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 relative shadow-soft">
                <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-extrabold text-lg shadow-soft mb-6">
                  01
                </div>
                <h3 className="text-xl font-bold text-on-surface">
                  Choose Your Service
                </h3>
                <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
                  Select grooming, daycare, or boarding. View real-time availability for open slots and pick the exact dates that suit your calendar.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 relative shadow-soft">
                <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-extrabold text-lg shadow-soft mb-6">
                  02
                </div>
                <h3 className="text-xl font-bold text-on-surface">
                  Tell Us About Your Pet
                </h3>
                <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
                  Provide pet details, breed, and weight to determine accurate pricing. Note any special dietary routines or temperaments.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 relative shadow-soft">
                <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-extrabold text-lg shadow-soft mb-6">
                  03
                </div>
                <h3 className="text-xl font-bold text-on-surface">
                  Pay & Get Confirmed
                </h3>
                <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
                  Pay securely via Paystack test mode. Capacity is held during checkout, and your booking reference is confirmed once payment verifies.
                </p>
              </div>
            </div>

            {/* Important Policy Banner */}
            <div className="mt-12 p-6 rounded-3xl bg-surface border border-outline-variant shadow-soft flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">
                    Payment & Confirmation Policy
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed max-w-2xl">
                    Full payment is required prior to arrival. A booking is confirmed only after verified payment. If plans change, bookings can be rescheduled within their applicable service cut-off windows.
                  </p>
                </div>
              </div>

              {/* Primary CTA with Secondary Semantic Colour Role */}
              <a
                href="/book"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-95 text-sm font-bold px-8 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all shrink-0"
              >
                <span>Book a Service</span>
                <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* =========================================================================
            7. TESTIMONIALS (Sample Placeholder Reviews)
            ========================================================================= */}
        <section id="testimonials" className="py-20 bg-background border-t border-outline-variant/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              {/* Clearly marked placeholder badge */}
              <span className="inline-block px-3.5 py-1 rounded-full bg-warning-container text-on-warning-container text-xs font-bold tracking-wider uppercase mb-3">
                Sample Customer Notes · For Visualisation Only
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Loved by Pets. Trusted by Their People.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-on-surface-variant leading-relaxed">
                Illustrative feedback showing the dependable experience Good Pets aims to provide to Lagos pet owners.
              </p>
            </div>

            {/* Three Testimonial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-7 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-secondary mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Grooming Experience
                    </span>
                  </div>
                  <blockquote className="text-sm text-on-surface leading-relaxed italic">
                    &ldquo;Finding gentle, reliable grooming in VI used to be stressful. The booking was clear, our Golden Retriever was handled with patience, and his coat came out fresh and soft.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-6 pt-5 border-t border-outline-variant flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
                    AO
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Amina O. & Barnaby</p>
                    <p className="text-xs text-on-surface-variant">Golden Retriever · Victoria Island</p>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-7 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-secondary mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Daycare Experience
                    </span>
                  </div>
                  <blockquote className="text-sm text-on-surface leading-relaxed italic">
                    &ldquo;The fixed 20-pet daily limit was why I chose Good Pets. My Frenchie has plenty of room to play safely, and I love having the guaranteed spot on my busy office days.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-6 pt-5 border-t border-outline-variant flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm">
                    ET
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Emeka T. & Milo</p>
                    <p className="text-xs text-on-surface-variant">French Bulldog · Oniru, Lagos</p>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-7 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-secondary mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Overnight Boarding
                    </span>
                  </div>
                  <blockquote className="text-sm text-on-surface leading-relaxed italic">
                    &ldquo;Leaving our cat for four nights was nerve-wracking, but the quiet suites and caring team kept her calm. Authorizing my sister for pickup was simple and secure.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-6 pt-5 border-t border-outline-variant flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-sm">
                    ZK
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">Zainab K. & Cleo</p>
                    <p className="text-xs text-on-surface-variant">Domestic Short Hair · Ikoyi</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-on-surface-variant mt-8">
              * Note: Feedback cards above are sample design demonstrations. Genuine client reviews will be integrated following public operations.
            </p>
          </div>
        </section>

        {/* =========================================================================
            FAQS & POLICIES OVERVIEW
            ========================================================================= */}
        <section id="faqs" className="py-20 bg-surface-container-low border-t border-outline-variant/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-block px-3.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold tracking-wider uppercase mb-3">
                Helpful Answers
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-base text-on-surface-variant">
                Everything you need to know about our services, pricing, and safety guidelines.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'What vaccination documents are required?',
                  a: 'For the safety of all pets, dogs must have current DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza) vaccines, and cats must have current FVRCP vaccines before admission. Please bring proof of vaccination on arrival.',
                },
                {
                  q: 'How does rescheduling work if my plans change?',
                  a: 'Bookings are non-refundable, but you can reschedule to a later date without penalty within the service cut-off window: at least 1 day before daycare, 2 days before grooming, and 3 days before boarding (Africa/Lagos calendar days).',
                },
                {
                  q: 'Can another person pick up my pet?',
                  a: 'Yes. You can add an Authorized Pickup Person directly within your booking details. For safety, staff verify the collector’s identity (checking a valid ID type) before your pet is released.',
                },
                {
                  q: 'What are the daycare hours and late pickup policy?',
                  a: 'Daycare operates from 07:00 to 18:00 Lagos time. Pickups after 18:00 incur a late fee of ₦5,000, settled in cash at the front desk.',
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-soft"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={faqOpen === index}
                  >
                    <span className="font-bold text-base sm:text-lg text-on-surface">
                      {item.q}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                      {faqOpen === index ? '−' : '+'}
                    </span>
                  </button>
                  {faqOpen === index && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/40 pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            8. FINAL CTA
            ========================================================================= */}
        <section className="py-20 lg:py-24 bg-surface-container border-t border-outline-variant relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
              <span className="inline-block px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold tracking-wider uppercase mb-6 shadow-soft">
                Book Your Visit
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
                Ready to Make Your Pet’s Day?
              </h2>

              <p className="mt-6 text-lg sm:text-xl text-on-surface-variant leading-relaxed max-w-2xl">
                Explore grooming, daycare, or boarding with real-time availability and transparent naira pricing at our Victoria Island location.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                {/* Primary CTA using secondary semantic role */}
                <a
                  href="/book"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-95 text-base font-bold px-8 py-4 rounded-full shadow-soft hover:shadow-medium transition-all text-center"
                >
                  <span>Book a Service</span>
                  <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>

                <a
                  href="#services"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-surface text-primary border border-outline hover:bg-surface-container-low text-base font-bold px-8 py-4 rounded-full transition-all text-center"
                >
                  <span>Explore Our Services</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          9. FOOTER
          ========================================================================= */}
      <footer id="contact" className="bg-surface-container-highest border-t border-outline-variant pt-16 pb-12 text-on-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-outline-variant">
            {/* Column 1: Brand & Location */}
            <div className="lg:col-span-2">
              <a href="#" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center p-1 border border-outline-variant">
                  <Image
                    src="/images/logo-mark.svg"
                    alt="Good Pets Logo"
                    width={32}
                    height={27}
                    className="w-auto h-6"
                  />
                </div>
                <span className="text-xl font-bold tracking-tight text-on-surface">Good Pets</span>
              </a>

              <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-sm">
                Premium, capacity-controlled pet care in Victoria Island, Lagos. Dedicated dog and cat grooming, social daycare, and comfortable overnight boarding.
              </p>

              <div className="mt-4 text-xs text-on-surface-variant space-y-1">
                <p><strong>Location:</strong> Victoria Island, Lagos, Nigeria</p>
                <p><strong>Hours:</strong> Mon – Sat: 07:00 – 18:00 (Daycare)</p>
                <p><strong>Contact:</strong> contact@goodpets.com (Placeholder)</p>
              </div>
            </div>

            {/* Column 2: Explore */}
            <div>
              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4">
                Explore
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#how-it-works" className="text-on-surface-variant hover:text-primary transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#standards" className="text-on-surface-variant hover:text-primary transition-colors">
                    About Us & Standards
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-on-surface-variant hover:text-primary transition-colors">
                    Transparent Rates
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-on-surface-variant hover:text-primary transition-colors">
                    Testimonials
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Services */}
            <div>
              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4">
                Services
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#grooming" className="text-on-surface-variant hover:text-primary transition-colors">
                    Pet Grooming
                  </a>
                </li>
                <li>
                  <a href="#daycare" className="text-on-surface-variant hover:text-primary transition-colors">
                    Dog Daycare
                  </a>
                </li>
                <li>
                  <a href="#boarding" className="text-on-surface-variant hover:text-primary transition-colors">
                    Overnight Boarding
                  </a>
                </li>
                <li>
                  <a href="/book" className="text-on-surface-variant hover:text-primary transition-colors">
                    Check Availability
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Support & Legal */}
            <div>
              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4">
                Support & Legal
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#faqs" className="text-on-surface-variant hover:text-primary transition-colors">
                    FAQs
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setAssistantModalOpen(true)}
                    className="text-on-surface-variant hover:text-primary transition-colors text-left"
                  >
                    AI Assistant
                  </button>
                </li>
                <li>
                  <a href="#privacy" className="text-on-surface-variant hover:text-primary transition-colors">
                    Privacy Policy (Placeholder)
                  </a>
                </li>
                <li>
                  <a href="#terms" className="text-on-surface-variant hover:text-primary transition-colors">
                    Terms & Conditions (Placeholder)
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant text-center sm:text-left">
            <p>© 2026 Good Pets. Built for portfolio demonstration in Victoria Island, Lagos.</p>
            <p>Payments simulated via Paystack test mode · No real funds move.</p>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          10. FLOATING AI ASSISTANT ACTION
          ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setAssistantModalOpen(true)}
          className="group flex items-center gap-2.5 bg-primary text-on-primary px-4 py-3 rounded-full shadow-medium hover:shadow-hard active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-secondary rounded-full" />
          </div>
          <span className="text-sm font-bold tracking-tight">Ask Assistant</span>
        </button>
      </div>

      {/* AI Assistant Preview Modal */}
      {assistantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-hard relative">
            <button
              type="button"
              onClick={() => setAssistantModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Close assistant modal"
            >
              <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Good Pets AI Assistant</h3>
                <p className="text-xs text-on-surface-variant">Live information on prices & availability</p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              I can help answer questions regarding grooming packages, daycare hours, overnight boarding rules, and live capacity in Victoria Island, Lagos.
            </p>

            <div className="space-y-2 mb-6">
              <p className="text-xs font-bold text-on-surface uppercase tracking-wider">Example questions:</p>
              <div className="bg-surface-container-low p-3 rounded-xl text-xs text-on-surface font-medium">
                &ldquo;What is the price for a medium dog bath?&rdquo;
              </div>
              <div className="bg-surface-container-low p-3 rounded-xl text-xs text-on-surface font-medium">
                &ldquo;Are there daycare spots available this Thursday?&rdquo;
              </div>
              <div className="bg-surface-container-low p-3 rounded-xl text-xs text-on-surface font-medium">
                &ldquo;What vaccines are required for cat boarding?&rdquo;
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant flex justify-end">
              <button
                type="button"
                onClick={() => setAssistantModalOpen(false)}
                className="bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-bold shadow-soft hover:shadow-medium transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
