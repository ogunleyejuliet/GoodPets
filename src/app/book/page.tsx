'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Service types supported by Good Pets
type ServiceType = 'grooming' | 'daycare' | 'boarding';
type Species = 'dog' | 'cat';
type DogSize = 'small' | 'medium' | 'large';
type GroomingPackage = 'basic' | 'full' | 'premium';

interface BookingContext {
  service: ServiceType | null;
  species: Species;
  dogSize: DogSize;
  groomingPackage: GroomingPackage;
  calculatedPrice: number;
}

interface UserProfile {
  name: string;
  email: string;
}

const STORAGE_KEY = 'goodpets_booking_context';
const AUTH_STORAGE_KEY = 'goodpets_customer_session';

export default function BookingPage() {
  // Step in the flow:
  // 1 = Choose a Service
  // 2 = Service-Specific Options
  // 3 = Authentication Gate
  // 4 = Resume Booking / Pet Selection (Step 5 of prompt)
  const [step, setStep] = useState<number>(1);

  // Booking state
  const [service, setService] = useState<ServiceType | null>(null);
  const [species, setSpecies] = useState<Species>('dog');
  const [dogSize, setDogSize] = useState<DogSize>('small');
  const [groomingPackage, setGroomingPackage] = useState<GroomingPackage>('basic');

  // Authentication state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Sign In Form fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInErrors, setSignInErrors] = useState<{ email?: string; password?: string }>({});

  // Sign Up Form fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpErrors, setSignUpErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Pet selection mock/starter state for Step 5
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [newPetName, setNewPetName] = useState('');
  const [showAddPetForm, setShowAddPetForm] = useState(false);

  // Restore saved session & booking context from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check auth session
      const savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (savedAuth) {
        try {
          setUser(JSON.parse(savedAuth));
        } catch {
          // ignore corrupted data
        }
      }

      // Check URL search params for service preselection
      const params = new URLSearchParams(window.location.search);
      const serviceParam = params.get('service') as ServiceType | null;

      // Check saved booking context
      const savedBooking = sessionStorage.getItem(STORAGE_KEY);
      if (savedBooking) {
        try {
          const parsed = JSON.parse(savedBooking);
          if (parsed.service) {
            setService(parsed.service);
            setSpecies(parsed.species || 'dog');
            setDogSize(parsed.dogSize || 'small');
            setGroomingPackage(parsed.groomingPackage || 'basic');
            setStep(2);
          }
        } catch {
          // ignore
        }
      } else if (serviceParam && ['grooming', 'daycare', 'boarding'].includes(serviceParam)) {
        setService(serviceParam);
        setStep(2);
      }
    }
  }, []);

  // Calculate pricing based on service rules
  const getPrice = useCallback((): number => {
    if (service === 'daycare') {
      return 12000; // ₦12,000 per pet per calendar day
    }
    if (service === 'boarding') {
      return 25000; // ₦25,000 per pet per night
    }
    if (service === 'grooming') {
      if (species === 'cat') {
        if (groomingPackage === 'basic') return 15000;
        return 22000; // Full Cat Groom
      }
      // Dog Grooming Matrix
      if (groomingPackage === 'basic') {
        if (dogSize === 'small') return 12000;
        if (dogSize === 'medium') return 16000;
        return 22000; // large
      }
      if (groomingPackage === 'full') {
        if (dogSize === 'small') return 20000;
        if (dogSize === 'medium') return 27000;
        return 35000; // large
      }
      // Premium Groom
      if (dogSize === 'small') return 25000;
      if (dogSize === 'medium') return 33000;
      return 42000; // large
    }
    return 0;
  }, [service, species, dogSize, groomingPackage]);

  // Save booking context whenever it updates
  useEffect(() => {
    if (typeof window !== 'undefined' && service) {
      const context: BookingContext = {
        service,
        species,
        dogSize,
        groomingPackage,
        calculatedPrice: getPrice(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    }
  }, [service, species, dogSize, groomingPackage, getPrice]);

  // Handle service selection (Step 2 -> Step 3)
  const handleSelectService = (selected: ServiceType) => {
    setService(selected);
    setStep(2);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Continue to Auth or Step 5
  const handleContinueFromServiceOptions = () => {
    if (user) {
      // Already authenticated, proceed directly to Step 5 (resume context)
      setStep(4);
    } else {
      // Require Authentication
      setStep(3);
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Sign In handler
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    const errors: { email?: string; password?: string } = {};
    if (!signInEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signInEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!signInPassword) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setSignInErrors(errors);
      return;
    }

    setSignInErrors({});
    setAuthLoading(true);

    // Simulate authenticating against existing credentials
    setTimeout(() => {
      setAuthLoading(false);
      const loggedUser: UserProfile = {
        name: signInEmail.split('@')[0],
        email: signInEmail.trim().toLowerCase(),
      };
      setUser(loggedUser);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedUser));
      }
      setAuthSuccessMsg('Signed in successfully! Returning to your booking...');
      setTimeout(() => {
        setStep(4); // Advance to resumed booking step
      }, 700);
    }, 600);
  };

  // Sign Up handler
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);

    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!signUpName.trim() || signUpName.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    } else if (signUpName.trim().length > 100) {
      errors.name = 'Full name cannot exceed 100 characters.';
    }

    if (!signUpEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!signUpPassword) {
      errors.password = 'Password is required.';
    } else if (signUpPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (signUpPassword !== signUpConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setSignUpErrors(errors);
      return;
    }

    setSignUpErrors({});
    setAuthLoading(true);

    // Simulate creating account and establishing session
    setTimeout(() => {
      setAuthLoading(false);
      const newUser: UserProfile = {
        name: signUpName.trim(),
        email: signUpEmail.trim().toLowerCase(),
      };
      setUser(newUser);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
      }
      setAuthSuccessMsg('Account created successfully! Resuming your booking...');
      setTimeout(() => {
        setStep(4); // Advance to resumed booking step
      }, 700);
    }, 600);
  };

  const handleSignOut = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-sans selection:bg-primary-container selection:text-on-primary-container">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1"
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

            {/* Header Right */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Back to Home</span>
              </Link>

              {user ? (
                <div className="flex items-center gap-3 bg-surface-container-low px-3.5 py-1.5 rounded-full border border-outline-variant text-xs font-bold text-on-surface">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-primary hover:underline ml-1 font-semibold"
                    title="Sign Out"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('signin');
                    setStep(3);
                  }}
                  className="text-xs sm:text-sm font-bold text-primary hover:text-on-primary-container px-3 py-1.5 rounded-full border border-primary/20 hover:border-primary transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Flow Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Progress Stepper */}
        <nav aria-label="Booking progress" className="mb-8">
          <ol className="flex items-center justify-between max-w-2xl mx-auto text-xs sm:text-sm font-semibold text-on-surface-variant">
            <li className={`flex items-center gap-2 ${step >= 1 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 1
                    ? 'bg-primary text-on-primary'
                    : step === 1
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 1 ? '✓' : '1'}
              </span>
              <span>Service</span>
            </li>
            <span className="h-0.5 w-8 sm:w-16 bg-outline-variant"></span>
            <li className={`flex items-center gap-2 ${step >= 2 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 2
                    ? 'bg-primary text-on-primary'
                    : step === 2
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 2 ? '✓' : '2'}
              </span>
              <span>Details</span>
            </li>
            <span className="h-0.5 w-8 sm:w-16 bg-outline-variant"></span>
            <li className={`flex items-center gap-2 ${step >= 3 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 3
                    ? 'bg-primary text-on-primary'
                    : step === 3
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 3 ? '✓' : '3'}
              </span>
              <span>Account</span>
            </li>
            <span className="h-0.5 w-8 sm:w-16 bg-outline-variant"></span>
            <li className={`flex items-center gap-2 ${step >= 4 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 4
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                4
              </span>
              <span>Pet & Dates</span>
            </li>
          </ol>
        </nav>

        {/* STEP 1: CHOOSE A SERVICE */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                Choose a Service
              </h1>
              <p className="text-base sm:text-lg text-on-surface-variant">
                Find the right care for your pet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 pt-4">
              {/* Card 1: Grooming */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-grooming.jpg"
                      alt="Dog and Cat Professional Grooming at Good Pets"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary">
                      90 Min Sessions
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <h2 className="text-2xl font-bold text-on-surface">Grooming</h2>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      Professional grooming to keep pets clean, comfortable, and looking their best.
                    </p>
                    <div className="pt-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Starting Price
                      </span>
                      <div className="text-2xl font-extrabold text-primary">
                        ₦12,000
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleSelectService('grooming')}
                    className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-98 text-sm font-bold px-6 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all"
                  >
                    <span>Choose Grooming</span>
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Card 2: Daycare */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-daycare.jpg"
                      alt="Active Daytime Dog Daycare Play Sessions"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary">
                      8 AM – 8 PM
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <h2 className="text-2xl font-bold text-on-surface">Daycare</h2>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      A day of care, attention, and activities for your pet in Victoria Island.
                    </p>
                    <div className="pt-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Standard Rate
                      </span>
                      <div className="text-2xl font-extrabold text-primary">
                        ₦12,000{' '}
                        <span className="text-xs font-normal text-on-surface-variant">
                          per pet / calendar day
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleSelectService('daycare')}
                    className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-98 text-sm font-bold px-6 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all"
                  >
                    <span>Choose Daycare</span>
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Card 3: Boarding */}
              <div className="bg-surface rounded-3xl border border-outline-variant overflow-hidden shadow-soft hover:shadow-medium transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src="/images/service-boarding.jpg"
                      alt="Comfortable Overnight Pet Boarding with Staff Supervision"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary">
                      8 PM – 8 AM Window
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <h2 className="text-2xl font-bold text-on-surface">Boarding</h2>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      Overnight care for pets when you are away with loving 24/7 attentive supervision.
                    </p>
                    <div className="pt-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Standard Rate
                      </span>
                      <div className="text-2xl font-extrabold text-primary">
                        ₦25,000{' '}
                        <span className="text-xs font-normal text-on-surface-variant">
                          per pet / night
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <button
                    onClick={() => handleSelectService('boarding')}
                    className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-98 text-sm font-bold px-6 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all"
                  >
                    <span>Choose Boarding</span>
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SERVICE-SPECIFIC BOOKING ENTRY */}
        {step === 2 && service && (
          <div className="space-y-8 animate-fadeIn max-w-3xl mx-auto">
            {/* Header with back navigation */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Change Service
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                {service} Entry
              </span>
            </div>

            {/* GROOMING ENTRY */}
            {service === 'grooming' && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface">Grooming Packages</h1>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Select your pet type and size to view tailored packages. Appointments last 90 minutes.
                  </p>
                </div>

                {/* Pet Species Selection */}
                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4">
                  <label className="text-sm font-bold text-on-surface block">
                    What type of pet are you booking for?
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSpecies('dog')}
                      className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border text-sm font-bold transition-all ${
                        species === 'dog'
                          ? 'border-primary bg-primary-container text-on-primary-container shadow-soft'
                          : 'border-outline-variant hover:border-outline text-on-surface'
                      }`}
                    >
                      <span>🐶</span>
                      <span>Dog</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecies('cat')}
                      className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border text-sm font-bold transition-all ${
                        species === 'cat'
                          ? 'border-primary bg-primary-container text-on-primary-container shadow-soft'
                          : 'border-outline-variant hover:border-outline text-on-surface'
                      }`}
                    >
                      <span>🐱</span>
                      <span>Cat</span>
                    </button>
                  </div>
                </div>

                {/* Dog Size Selection (Only if Dog) */}
                {species === 'dog' && (
                  <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 animate-fadeIn">
                    <label className="text-sm font-bold text-on-surface block">
                      Dog Weight & Size Tier
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setDogSize('small')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          dogSize === 'small'
                            ? 'border-primary bg-primary-container text-on-primary-container ring-2 ring-primary/20'
                            : 'border-outline-variant hover:border-outline text-on-surface'
                        }`}
                      >
                        <div className="font-bold text-sm">Small Dog</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">Under 10 kg</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDogSize('medium')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          dogSize === 'medium'
                            ? 'border-primary bg-primary-container text-on-primary-container ring-2 ring-primary/20'
                            : 'border-outline-variant hover:border-outline text-on-surface'
                        }`}
                      >
                        <div className="font-bold text-sm">Medium Dog</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">10 – 25 kg</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDogSize('large')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          dogSize === 'large'
                            ? 'border-primary bg-primary-container text-on-primary-container ring-2 ring-primary/20'
                            : 'border-outline-variant hover:border-outline text-on-surface'
                        }`}
                      >
                        <div className="font-bold text-sm">Large Dog</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">Over 25 kg</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Packages Matrix */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-on-surface">Available Packages</h2>
                    <span className="text-xs font-semibold text-primary">90-minute appointment</span>
                  </div>

                  {species === 'dog' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Basic Bath */}
                      <div
                        onClick={() => setGroomingPackage('basic')}
                        className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          groomingPackage === 'basic'
                            ? 'border-primary bg-surface ring-2 ring-primary shadow-soft'
                            : 'border-outline-variant bg-surface hover:border-outline'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-on-surface text-base">Basic Bath</h3>
                            <input
                              type="radio"
                              name="grooming_package"
                              checked={groomingPackage === 'basic'}
                              onChange={() => setGroomingPackage('basic')}
                              className="accent-primary"
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                            Warm bath, ear cleaning, paw hygiene, and blow-dry.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/50">
                          <div className="text-xl font-extrabold text-primary">
                            ₦{dogSize === 'small' ? '12,000' : dogSize === 'medium' ? '16,000' : '22,000'}
                          </div>
                          <div className="text-[11px] text-on-surface-variant capitalize">
                            For {dogSize} dog
                          </div>
                        </div>
                      </div>

                      {/* Full Groom */}
                      <div
                        onClick={() => setGroomingPackage('full')}
                        className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          groomingPackage === 'full'
                            ? 'border-primary bg-surface ring-2 ring-primary shadow-soft'
                            : 'border-outline-variant bg-surface hover:border-outline'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-on-surface text-base">Full Groom</h3>
                            <input
                              type="radio"
                              name="grooming_package"
                              checked={groomingPackage === 'full'}
                              onChange={() => setGroomingPackage('full')}
                              className="accent-primary"
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                            Bath, sanitary trim, nail clip, breed styling & ear care.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/50">
                          <div className="text-xl font-extrabold text-primary">
                            ₦{dogSize === 'small' ? '20,000' : dogSize === 'medium' ? '27,000' : '35,000'}
                          </div>
                          <div className="text-[11px] text-on-surface-variant capitalize">
                            For {dogSize} dog
                          </div>
                        </div>
                      </div>

                      {/* Premium Groom */}
                      <div
                        onClick={() => setGroomingPackage('premium')}
                        className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          groomingPackage === 'premium'
                            ? 'border-primary bg-surface ring-2 ring-primary shadow-soft'
                            : 'border-outline-variant bg-surface hover:border-outline'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-on-surface text-base">Premium Groom</h3>
                            <input
                              type="radio"
                              name="grooming_package"
                              checked={groomingPackage === 'premium'}
                              onChange={() => setGroomingPackage('premium')}
                              className="accent-primary"
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                            Full styling, coat conditioning mask, paw balm & teeth brushing.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/50">
                          <div className="text-xl font-extrabold text-primary">
                            ₦{dogSize === 'small' ? '25,000' : dogSize === 'medium' ? '33,000' : '42,000'}
                          </div>
                          <div className="text-[11px] text-on-surface-variant capitalize">
                            For {dogSize} dog
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Cat Packages */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Basic Cat */}
                      <div
                        onClick={() => setGroomingPackage('basic')}
                        className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          groomingPackage === 'basic'
                            ? 'border-primary bg-surface ring-2 ring-primary shadow-soft'
                            : 'border-outline-variant bg-surface hover:border-outline'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-on-surface text-base">Basic Cat Groom</h3>
                            <input
                              type="radio"
                              name="grooming_cat_package"
                              checked={groomingPackage === 'basic'}
                              onChange={() => setGroomingPackage('basic')}
                              className="accent-primary"
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                            Gentle waterless bath or brush-out, ear cleaning, and nail trimming.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/50">
                          <div className="text-xl font-extrabold text-primary">₦15,000</div>
                          <div className="text-[11px] text-on-surface-variant">All cats</div>
                        </div>
                      </div>

                      {/* Full Cat */}
                      <div
                        onClick={() => setGroomingPackage('full')}
                        className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                          groomingPackage === 'full'
                            ? 'border-primary bg-surface ring-2 ring-primary shadow-soft'
                            : 'border-outline-variant bg-surface hover:border-outline'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-on-surface text-base">Full Cat Groom</h3>
                            <input
                              type="radio"
                              name="grooming_cat_package"
                              checked={groomingPackage === 'full'}
                              onChange={() => setGroomingPackage('full')}
                              className="accent-primary"
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                            De-shedding treatment, gentle coat bath & dry, sanitary trim & ear care.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/50">
                          <div className="text-xl font-extrabold text-primary">₦22,000</div>
                          <div className="text-[11px] text-on-surface-variant">All cats</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/70 text-xs text-on-surface-variant flex items-start gap-2.5">
                  <span className="text-primary text-base leading-none">ℹ️</span>
                  <span>
                    Grooming appointments are 90 minutes. Availability is subject to existing booking rules and live slot capacity. No account is needed to explore options.
                  </span>
                </div>
              </div>
            )}

            {/* DAYCARE ENTRY */}
            {service === 'daycare' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface">Daycare Booking</h1>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Care, exercise, and attention in Victoria Island, Lagos.
                  </p>
                </div>

                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Daycare Price
                      </div>
                      <div className="text-3xl font-extrabold text-primary mt-1">
                        ₦12,000{' '}
                        <span className="text-sm font-normal text-on-surface-variant">
                          per pet / calendar day
                        </span>
                      </div>
                    </div>
                    <div className="bg-secondary-container text-on-secondary-container px-3.5 py-1.5 rounded-full text-xs font-bold">
                      Operating Hours: 8 AM – 8 PM
                    </div>
                  </div>

                  <hr className="border-outline-variant/60" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-on-surface-variant">
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Supervised play areas grouped by temperament and size</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Scheduled hydration, meal breaks, and quiet rest periods</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Pickups permitted any time before 8:00 PM closing</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>All calendar days included with both end dates counted</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BOARDING ENTRY */}
            {service === 'boarding' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface">Boarding Booking</h1>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Safe overnight pet boarding with continuous 24/7 staff supervision.
                  </p>
                </div>

                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Boarding Price
                      </div>
                      <div className="text-3xl font-extrabold text-primary mt-1">
                        ₦25,000{' '}
                        <span className="text-sm font-normal text-on-surface-variant">
                          per pet / night
                        </span>
                      </div>
                    </div>
                    <div className="bg-secondary-container text-on-secondary-container px-3.5 py-1.5 rounded-full text-xs font-bold">
                      Check-in/Check-out: 8 PM – 8 AM Window
                    </div>
                  </div>

                  <hr className="border-outline-variant/60" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-on-surface-variant">
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Private, climate-controlled, sanitized sleeping suites</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Overnight caregiver present at all hours for safety</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Complimentary morning and evening outdoor breaks</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success font-bold">✓</span>
                      <span>Quantity counted by overnight stays from check-in to check-out</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-outline-variant">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Current Estimate
                </span>
                <div className="text-2xl font-extrabold text-on-surface">
                  ₦{getPrice().toLocaleString('en-NG')}
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueFromServiceOptions}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-95 text-base font-bold px-8 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all"
              >
                <span>Continue to Booking</span>
                <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: AUTHENTICATION GATE */}
        {step === 3 && (
          <div className="max-w-md mx-auto space-y-6 animate-fadeIn">
            {/* Header explaining why account is required */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-secondary-container text-on-secondary-container mb-2">
                <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
                {authMode === 'signin' ? 'Sign in to continue' : 'Create your account'}
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">
                An account is needed to save your pet’s profiles, secure your reserved place, and manage your bookings.
              </p>
            </div>

            {/* Current Selection summary chip */}
            <div className="bg-surface-container rounded-2xl p-3 border border-outline-variant flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-primary">
                  {service}
                </span>
                <span className="text-on-surface-variant">•</span>
                <span className="text-on-surface font-semibold capitalize">
                  {service === 'grooming' ? `${species} (${groomingPackage})` : service}
                </span>
              </div>
              <span className="font-bold text-on-surface">₦{getPrice().toLocaleString('en-NG')}</span>
            </div>

            {/* Tabs for Sign In vs Create Account */}
            <div className="flex rounded-full bg-surface-container-high p-1 border border-outline-variant">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-all ${
                  authMode === 'signin'
                    ? 'bg-surface text-on-surface shadow-soft'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError(null);
                  setAuthSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-full transition-all ${
                  authMode === 'signup'
                    ? 'bg-surface text-on-surface shadow-soft'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Success or Error messages */}
            {authSuccessMsg && (
              <div className="bg-success-container text-on-success-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>{authSuccessMsg}</span>
              </div>
            )}
            {authError && (
              <div className="bg-error-container text-on-error-container p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{authError}</span>
              </div>
            )}

            {/* Sign In Form */}
            {authMode === 'signin' ? (
              <form onSubmit={handleSignIn} className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1" htmlFor="signin-email">
                    Email Address
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signInErrors.email ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signInErrors.email && (
                    <p className="text-xs text-error mt-1 font-semibold">{signInErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-on-surface" htmlFor="signin-password">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => alert('Password reset link will be sent to your email address per Flow 12.')}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="signin-password"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signInErrors.password ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signInErrors.password && (
                    <p className="text-xs text-error mt-1 font-semibold">{signInErrors.password}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-98 text-sm font-bold py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50"
                >
                  {authLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <span>Sign In & Continue Booking</span>
                  )}
                </button>

                <p className="text-center text-xs text-on-surface-variant pt-2">
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className="font-bold text-primary hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleSignUp} className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1" htmlFor="signup-name">
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="e.g. Juliet Ogunleye"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.name ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.name && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1" htmlFor="signup-email">
                    Email Address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.email ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.email && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1" htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.password ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.password && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1" htmlFor="signup-confirm-password">
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.confirmPassword ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.confirmPassword && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.confirmPassword}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-98 text-sm font-bold py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50"
                >
                  {authLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    <span>Create Account & Continue</span>
                  )}
                </button>

                <p className="text-center text-xs text-on-surface-variant pt-2">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className="font-bold text-primary hover:underline"
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                ← Back to Service Options
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: RESUME BOOKING CONTEXT / NEXT STEP (STEP 5 OF PROMPT) */}
        {step === 4 && service && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            {/* Success Banner */}
            <div className="bg-success-container/70 border border-success/30 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-success text-xl">✓</span>
              <div>
                <h3 className="text-sm font-bold text-on-success-container">
                  Authenticated as {user?.name || 'Customer'}
                </h3>
                <p className="text-xs text-on-success-container/90 mt-0.5">
                  Your booking context has been preserved and restored. Proceed with pet selection and booking dates.
                </p>
              </div>
            </div>

            {/* Preserved Booking Summary Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Selected Service Details
                </span>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Modify Selection
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-on-surface-variant block">Service</span>
                  <span className="font-bold text-on-surface capitalize text-sm">{service}</span>
                </div>
                {service === 'grooming' && (
                  <>
                    <div>
                      <span className="text-on-surface-variant block">Species</span>
                      <span className="font-bold text-on-surface capitalize text-sm">{species}</span>
                    </div>
                    {species === 'dog' && (
                      <div>
                        <span className="text-on-surface-variant block">Dog Size</span>
                        <span className="font-bold text-on-surface capitalize text-sm">{dogSize}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-on-surface-variant block">Package</span>
                      <span className="font-bold text-on-surface capitalize text-sm">{groomingPackage}</span>
                    </div>
                  </>
                )}
                {service === 'daycare' && (
                  <div>
                    <span className="text-on-surface-variant block">Hours</span>
                    <span className="font-bold text-on-surface text-sm">8 AM – 8 PM</span>
                  </div>
                )}
                {service === 'boarding' && (
                  <div>
                    <span className="text-on-surface-variant block">Window</span>
                    <span className="font-bold text-on-surface text-sm">8 PM – 8 AM</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant">Estimated Total:</span>
                <span className="text-2xl font-extrabold text-primary">
                  ₦{getPrice().toLocaleString('en-NG')}
                </span>
              </div>
            </div>

            {/* Next Step Transition: Pet Selection */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">
                    {service === 'grooming'
                      ? 'Select Pet & Appointment Time'
                      : service === 'daycare'
                      ? 'Select Pet & Daycare Dates'
                      : 'Select Pet & Stay Dates'}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Choose which pet this {service} booking is for:
                  </p>
                </div>
              </div>

              {/* Pet selection options */}
              <div className="space-y-3">
                <div
                  onClick={() => setSelectedPet('milo')}
                  className={`cursor-pointer p-4 rounded-xl border flex items-center justify-between transition-all ${
                    selectedPet === 'milo'
                      ? 'border-primary bg-primary-container/40 ring-1 ring-primary'
                      : 'border-outline-variant hover:border-outline'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🐕</span>
                    <div>
                      <div className="font-bold text-sm text-on-surface">Milo</div>
                      <div className="text-xs text-on-surface-variant">Golden Retriever • 18 kg (Medium)</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="pet_select"
                    checked={selectedPet === 'milo'}
                    onChange={() => setSelectedPet('milo')}
                    className="accent-primary"
                  />
                </div>

                {!showAddPetForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddPetForm(true)}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-outline hover:border-primary text-xs font-bold text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <span>+</span>
                    <span>Add a new pet profile</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-low space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface">Add New Pet</span>
                      <button
                        type="button"
                        onClick={() => setShowAddPetForm(false)}
                        className="text-xs text-on-surface-variant hover:text-on-surface"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Pet Name</label>
                        <input
                          type="text"
                          value={newPetName}
                          onChange={(e) => setNewPetName(e.target.value)}
                          placeholder="e.g. Luna"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Breed & Weight</label>
                        <input
                          type="text"
                          placeholder="e.g. French Bulldog (12 kg)"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newPetName.trim()) {
                          setSelectedPet(newPetName.trim());
                          setShowAddPetForm(false);
                        }
                      }}
                      className="text-xs font-bold bg-primary text-on-primary px-4 py-2 rounded-full"
                    >
                      Save Pet
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Notice */}
              <div className="mt-6 pt-4 border-t border-outline-variant text-center space-y-2">
                <p className="text-xs text-on-surface-variant">
                  <strong>Steps 1–5 Complete:</strong> You have selected your service, customized your package, authenticated, and preserved your context into the pet selection stage.
                </p>
                <button
                  type="button"
                  disabled={!selectedPet}
                  onClick={() =>
                    alert(
                      `Ready for Date & Capacity Reservation: Next stage will query live availability for ${service} and proceed to Paystack capacity hold.`
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary hover:brightness-105 active:scale-95 text-sm font-bold px-8 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-40"
                >
                  <span>Proceed to Available Dates</span>
                  <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                {!selectedPet && (
                  <p className="text-[11px] text-on-surface-variant">
                    Please select a pet above to proceed to date selection.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant py-6 bg-surface-container-lowest mt-12 text-center text-xs text-on-surface-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Good Pets Ltd. Victoria Island, Lagos. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
