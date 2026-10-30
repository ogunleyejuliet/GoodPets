'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  calculatePrice,
  formatNaira,
  calculateDogSizeTier,
} from '@/lib/pricing';
import {
  GROOMING_SLOTS,
  getEarliestServiceDateLagos,
  addDaysToDateString,
  countDaycareDays,
  countBoardingNights,
} from '@/lib/dates';

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
  step?: number;
}

interface UserProfile {
  id?: string;
  name: string;
  email: string;
  role?: string;
}

interface SavedPet {
  id: string;
  ownerId: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string | null;
  weightKg: number | null;
  careNotes: string | null;
  createdAt: string;
}

// Dog size tier helper per BR-003 (<10kg Small, 10-25kg Medium, >25kg Large)
function getDogSizeTier(weightKg: number | null): string {
  if (weightKg === null || weightKg === undefined) return '';
  if (weightKg < 10) return 'Small';
  if (weightKg <= 25) return 'Medium';
  return 'Large';
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

  // Pet selection and persistence state
  const [pets, setPets] = useState<SavedPet[]>([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [petsError, setPetsError] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [showAddPetForm, setShowAddPetForm] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const [savePetError, setSavePetError] = useState<string | null>(null);

  // New pet form fields
  const [newPetName, setNewPetName] = useState('');
  const [newPetSpecies, setNewPetSpecies] = useState<'DOG' | 'CAT'>('DOG');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetWeight, setNewPetWeight] = useState('');
  const [newPetCareNotes, setNewPetCareNotes] = useState('');

  // Step 5: Date Selection & Availability state
  const earliestDate = getEarliestServiceDateLagos();
  const [groomingDate, setGroomingDate] = useState<string>(earliestDate);
  const [groomingSlot, setGroomingSlot] = useState<string>('09:00');
  const [groomingSlotsData, setGroomingSlotsData] = useState<
    Array<{
      slotCode: string;
      startTime: string;
      endTime: string;
      label: string;
      durationMinutes: number;
      available: boolean;
      reason?: string;
    }>
  >([]);
  const [loadingGroomingSlots, setLoadingGroomingSlots] = useState<boolean>(false);
  const [groomingError, setGroomingError] = useState<string | null>(null);

  const [daycareMode, setDaycareMode] = useState<'single' | 'range'>('single');
  const [daycareStartDate, setDaycareStartDate] = useState<string>(earliestDate);
  const [daycareEndDate, setDaycareEndDate] = useState<string>(earliestDate);
  const [daycareAvailData, setDaycareAvailData] = useState<{
    available: boolean;
    totalDays: number;
    days: Array<{ date: string; available: boolean; reason?: string }>;
    firstUnavailableDate?: string;
  } | null>(null);
  const [loadingDaycareAvail, setLoadingDaycareAvail] = useState<boolean>(false);
  const [daycareError, setDaycareError] = useState<string | null>(null);

  const [boardingCheckIn, setBoardingCheckIn] = useState<string>(earliestDate);
  const [boardingCheckOut, setBoardingCheckOut] = useState<string>(
    addDaysToDateString(earliestDate, 1)
  );
  const [boardingAvailData, setBoardingAvailData] = useState<{
    available: boolean;
    totalNights: number;
    nights: Array<{ nightDate: string; available: boolean; reason?: string }>;
    firstUnavailableNight?: string;
  } | null>(null);
  const [loadingBoardingAvail, setLoadingBoardingAvail] = useState<boolean>(false);
  const [boardingError, setBoardingError] = useState<string | null>(null);

  // Step 6: Booking Review State
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [loadingReview, setLoadingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Step 7: Booking Creation & Capacity Hold (Stage 4) State
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState<string>('');
  const [createdBooking, setCreatedBooking] = useState<any | null>(null);
  const [creatingBooking, setCreatingBooking] = useState<boolean>(false);
  const [createBookingError, setCreateBookingError] = useState<string | null>(null);

  // Validate selections and advance to Stage 3 Review
  const handleProceedToReview = async () => {
    if (!service || !selectedPet) return;
    setLoadingReview(true);
    setReviewError(null);

    const payload = {
      petId: selectedPet,
      serviceType: service.toUpperCase(),
      groomingPackage: groomingPackage.toUpperCase(),
      groomingDate,
      groomingSlot,
      daycareMode,
      daycareStartDate,
      daycareEndDate: daycareMode === 'single' ? daycareStartDate : daycareEndDate,
      boardingCheckIn,
      boardingCheckOut,
    };

    try {
      const res = await fetch('/api/bookings/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.review) {
        setReviewData(data.review);
        // Generate or refresh idempotency key for this review session (FR-013)
        const key =
          typeof window !== 'undefined' && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `gp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        setBookingIdempotencyKey(key);
        setStep(6);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setReviewError(data.error || 'Server validation failed. Please check your selections.');
      }
    } catch {
      setReviewError('Unable to connect to the booking review service.');
    } finally {
      setLoadingReview(false);
    }
  };

  // Submit validated review and create booking with atomic capacity hold (Stage 4)
  const handleCreateBooking = async () => {
    if (!service || !selectedPet || !reviewData) return;
    setCreatingBooking(true);
    setCreateBookingError(null);

    const key =
      bookingIdempotencyKey ||
      (typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `gp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

    if (!bookingIdempotencyKey) {
      setBookingIdempotencyKey(key);
    }

    const payload = {
      idempotencyKey: key,
      petId: selectedPet,
      serviceType: service.toUpperCase(),
      groomingPackage: groomingPackage.toUpperCase(),
      groomingDate,
      groomingSlot,
      daycareMode,
      daycareStartDate,
      daycareEndDate: daycareMode === 'single' ? daycareStartDate : daycareEndDate,
      boardingCheckIn,
      boardingCheckOut,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.booking) {
        setCreatedBooking(data.booking);
        setStep(7);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setCreateBookingError(
          data.error || 'Failed to create booking and reserve capacity. Please try again.'
        );
      }
    } catch {
      setCreateBookingError('Unable to connect to the booking server. Please try again.');
    } finally {
      setCreatingBooking(false);
    }
  };

  // Restore saved session & booking context from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Synchronously restore local auth for immediate rehydration
      const savedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (savedAuth) {
        try {
          setUser(JSON.parse(savedAuth));
        } catch {
          // ignore
        }
      }

      // Verify real server session and update/revoke as appropriate
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated && data.user) {
            const authUser: UserProfile = {
              id: data.user.id,
              name: data.user.name || data.user.email.split('@')[0],
              email: data.user.email,
              role: data.user.role,
            };
            setUser(authUser);
            sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
          } else {
            setUser(null);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
          }
        })
        .catch(() => {
          // keep local session if server check unreachable
        });

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
            if (parsed.step && typeof parsed.step === 'number') {
              setStep(parsed.step);
            } else {
              setStep(2);
            }
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
        step,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    }
  }, [service, species, dogSize, groomingPackage, getPrice, step]);

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

  // Fetch customer's pets from database
  const fetchPets = useCallback(async () => {
    setLoadingPets(true);
    setPetsError(null);
    try {
      const res = await fetch('/api/pets');
      const data = await res.json();
      if (res.ok && data.success) {
        setPets(data.pets);
        if (data.pets.length > 0) {
          setSelectedPet((prev) => {
            const exists = data.pets.some((p: SavedPet) => p.id === prev);
            return exists ? prev : data.pets[0].id;
          });
        } else {
          setSelectedPet('');
        }
      } else {
        setPetsError(data.error || 'Failed to load saved pets');
      }
    } catch {
      setPetsError('Unable to connect to the server to load pets.');
    } finally {
      setLoadingPets(false);
    }
  }, []);

  // Fetch pets whenever user is signed in and step 4 or 5 is active
  useEffect(() => {
    if (user && (step === 4 || step === 5)) {
      fetchPets();
    }
  }, [user, step, fetchPets]);

  // Fetch Grooming Slots
  const fetchGroomingAvailability = useCallback(async (date: string) => {
    setLoadingGroomingSlots(true);
    setGroomingError(null);
    try {
      const res = await fetch(`/api/availability?service=GROOMING&startDate=${date}`);
      const data = await res.json();
      if (res.ok && data.slots) {
        setGroomingSlotsData(data.slots);
        const currentSlotObj = data.slots.find((s: { slotCode: string; available: boolean }) => s.slotCode === groomingSlot);
        if (!currentSlotObj || !currentSlotObj.available) {
          const firstAvail = data.slots.find((s: { available: boolean }) => s.available);
          if (firstAvail) setGroomingSlot(firstAvail.slotCode);
        }
      } else {
        setGroomingError(data.error || 'Failed to check grooming availability');
      }
    } catch {
      setGroomingError('Unable to connect to availability service');
    } finally {
      setLoadingGroomingSlots(false);
    }
  }, [groomingSlot]);

  // Fetch Daycare Availability
  const fetchDaycareAvailability = useCallback(async (start: string, end: string) => {
    setLoadingDaycareAvail(true);
    setDaycareError(null);
    try {
      const res = await fetch(`/api/availability?service=DAYCARE&startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (res.ok) {
        setDaycareAvailData(data);
      } else {
        setDaycareError(data.error || 'Failed to check daycare availability');
      }
    } catch {
      setDaycareError('Unable to connect to availability service');
    } finally {
      setLoadingDaycareAvail(false);
    }
  }, []);

  // Fetch Boarding Availability
  const fetchBoardingAvailability = useCallback(async (checkIn: string, checkOut: string) => {
    setLoadingBoardingAvail(true);
    setBoardingError(null);
    try {
      const res = await fetch(`/api/availability?service=BOARDING&startDate=${checkIn}&endDate=${checkOut}`);
      const data = await res.json();
      if (res.ok) {
        setBoardingAvailData(data);
      } else {
        setBoardingError(data.error || 'Failed to check boarding availability');
      }
    } catch {
      setBoardingError('Unable to connect to availability service');
    } finally {
      setLoadingBoardingAvail(false);
    }
  }, []);

  // Trigger availability checks when entering Step 5 or dates change
  useEffect(() => {
    if (step === 5 && service === 'grooming' && groomingDate) {
      fetchGroomingAvailability(groomingDate);
    }
  }, [step, service, groomingDate, fetchGroomingAvailability]);

  useEffect(() => {
    if (step === 5 && service === 'daycare') {
      const end = daycareMode === 'single' ? daycareStartDate : daycareEndDate;
      if (daycareStartDate && end && end >= daycareStartDate) {
        fetchDaycareAvailability(daycareStartDate, end);
      }
    }
  }, [step, service, daycareMode, daycareStartDate, daycareEndDate, fetchDaycareAvailability]);

  useEffect(() => {
    if (step === 5 && service === 'boarding') {
      if (boardingCheckIn && boardingCheckOut && boardingCheckOut > boardingCheckIn) {
        fetchBoardingAvailability(boardingCheckIn, boardingCheckOut);
      }
    }
  }, [step, service, boardingCheckIn, boardingCheckOut, fetchBoardingAvailability]);

  // Sign In handler - Real server-side authentication
  const handleSignIn = async (e: React.FormEvent) => {
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

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInEmail.trim().toLowerCase(),
          password: signInPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthLoading(false);
        setAuthError(data.error || 'Email or password is incorrect.');
        return;
      }

      setAuthLoading(false);
      const loggedUser: UserProfile = {
        id: data.user.id,
        name: data.user.name || signInEmail.split('@')[0],
        email: data.user.email,
        role: data.user.role,
      };
      setUser(loggedUser);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedUser));
      }
      setAuthSuccessMsg('Signed in successfully! Returning to your booking...');
      setTimeout(() => {
        setStep(4);
      }, 700);
    } catch {
      setAuthLoading(false);
      setAuthError('Unable to connect to the server. Please check your connection and try again.');
    }
  };

  // Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
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

    // Real database persistence via POST /api/auth/signup
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: signUpName.trim(),
          email: signUpEmail.trim().toLowerCase(),
          password: signUpPassword,
          confirmPassword: signUpConfirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthLoading(false);
        setAuthError(data.error || 'Failed to create account. Please check your details.');
        return;
      }

      setAuthLoading(false);
      const newUser: UserProfile = {
        id: data.user.id,
        name: data.user.name || signUpName.trim(),
        email: data.user.email,
        role: data.user.role,
      };
      setUser(newUser);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
      }
      setAuthSuccessMsg('Account created and saved to database! Resuming your booking...');
      setTimeout(() => {
        setStep(4);
      }, 700);
    } catch {
      setAuthLoading(false);
      setAuthError('Unable to connect to the server. Please check your connection and try again.');
    }
  };

  const handleSignOut = async () => {
    setUser(null);
    setSelectedPet('');
    setPets([]);
    setStep(3); // Return to auth gate upon signing out
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  // Add new pet handler - Real database persistence via POST /api/pets
  const handleSavePet = async () => {
    setSavePetError(null);
    const trimmed = newPetName.trim();
    if (!trimmed) {
      setSavePetError('Pet name is required.');
      return;
    }
    if (trimmed.length > 50) {
      setSavePetError('Pet name cannot exceed 50 characters.');
      return;
    }

    let parsedWeight: number | undefined = undefined;
    if (newPetWeight.trim()) {
      const w = Number(newPetWeight.trim());
      if (isNaN(w) || w <= 0 || w > 150) {
        setSavePetError('Weight must be a valid number between 0.1 and 150 kg.');
        return;
      }
      parsedWeight = Math.round(w * 10) / 10;
    }

    setSavingPet(true);
    try {
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          species: newPetSpecies,
          breed: newPetBreed.trim() || undefined,
          weightKg: parsedWeight,
          careNotes: newPetCareNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSavingPet(false);
        setSavePetError(data.error || 'Failed to save pet profile.');
        return;
      }

      const createdPet: SavedPet = data.pet;
      setPets((prev) => [createdPet, ...prev]);
      setSelectedPet(createdPet.id);
      setNewPetName('');
      setNewPetBreed('');
      setNewPetWeight('');
      setNewPetCareNotes('');
      setShowAddPetForm(false);
      setSavingPet(false);
    } catch {
      setSavingPet(false);
      setSavePetError('Network error while saving pet. Please try again.');
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
                className="type-label-large text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5"
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
                  className="type-label-large text-primary hover:text-on-primary-container px-5 py-2.5 rounded-full border border-primary/20 hover:border-primary transition-all cursor-pointer"
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
          <ol className="flex items-center justify-between max-w-2xl mx-auto type-label-medium font-semibold text-on-surface-variant">
            <li className={`flex items-center gap-1.5 sm:gap-2 ${step >= 1 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 1
                    ? 'bg-primary text-on-primary'
                    : step === 1
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 1 ? '✓' : '1'}
              </span>
              <span className="hidden sm:inline">Service</span>
            </li>
            <span className="h-0.5 w-4 sm:w-10 bg-outline-variant"></span>
            <li className={`flex items-center gap-1.5 sm:gap-2 ${step >= 2 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 2
                    ? 'bg-primary text-on-primary'
                    : step === 2
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 2 ? '✓' : '2'}
              </span>
              <span className="hidden sm:inline">Details</span>
            </li>
            <span className="h-0.5 w-4 sm:w-10 bg-outline-variant"></span>
            <li className={`flex items-center gap-1.5 sm:gap-2 ${step >= 3 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 3
                    ? 'bg-primary text-on-primary'
                    : step === 3
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 3 ? '✓' : '3'}
              </span>
              <span className="hidden sm:inline">Account</span>
            </li>
            <span className="h-0.5 w-4 sm:w-10 bg-outline-variant"></span>
            <li className={`flex items-center gap-1.5 sm:gap-2 ${step >= 4 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 4
                    ? 'bg-primary text-on-primary'
                    : step === 4
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 4 ? '✓' : '4'}
              </span>
              <span className="hidden sm:inline">Pet</span>
            </li>
            <span className="h-0.5 w-3 sm:w-8 bg-outline-variant"></span>
            <li className={`flex items-center gap-1 sm:gap-1.5 ${step >= 5 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > 5
                    ? 'bg-primary text-on-primary'
                    : step === 5
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {step > 5 ? '✓' : '5'}
              </span>
              <span className="hidden sm:inline">Dates</span>
            </li>
            <span className="h-0.5 w-3 sm:w-8 bg-outline-variant"></span>
            <li className={`flex items-center gap-1 sm:gap-1.5 ${step >= 6 ? 'text-primary font-bold' : ''}`}>
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 6
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                6
              </span>
              <span className="hidden sm:inline">Review</span>
            </li>
          </ol>
        </nav>

        {/* STEP 1: CHOOSE A SERVICE */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
            <div className="space-y-1">
              <h1 className="type-headline-large font-bold text-on-surface tracking-tight">
                What would you like to book?
              </h1>
              <p className="type-body-medium text-on-surface-variant">
                Select a service to see packages, availability and pricing.
              </p>
            </div>

            <div className="space-y-3">
              {/* Row 1: Grooming */}
              <button
                type="button"
                onClick={() => handleSelectService('grooming')}
                className="w-full group flex items-center justify-between gap-4 bg-surface border border-outline-variant hover:border-primary hover:shadow-soft active:scale-[0.99] rounded-2xl px-5 py-4 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-2xl shrink-0" aria-hidden="true">✂️</span>
                  <div className="min-w-0">
                    <div className="type-title-medium font-bold text-on-surface leading-tight">Grooming</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      Dogs &amp; cats · 90-min session · packages from{' '}
                      <span className="type-label-large font-bold text-on-surface">₦12,000</span>
                    </div>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 stroke-current stroke-2 fill-none text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Row 2: Daycare */}
              <button
                type="button"
                onClick={() => handleSelectService('daycare')}
                className="w-full group flex items-center justify-between gap-4 bg-surface border border-outline-variant hover:border-primary hover:shadow-soft active:scale-[0.99] rounded-2xl px-5 py-4 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-2xl shrink-0" aria-hidden="true">🐾</span>
                  <div className="min-w-0">
                    <div className="type-title-medium font-bold text-on-surface leading-tight">Daycare</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      8 AM – 8 PM ·{' '}
                      <span className="type-label-large font-bold text-on-surface">₦12,000</span>
                      {' '}per pet / calendar day
                    </div>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 stroke-current stroke-2 fill-none text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Row 3: Boarding */}
              <button
                type="button"
                onClick={() => handleSelectService('boarding')}
                className="w-full group flex items-center justify-between gap-4 bg-surface border border-outline-variant hover:border-primary hover:shadow-soft active:scale-[0.99] rounded-2xl px-5 py-4 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-2xl shrink-0" aria-hidden="true">🌙</span>
                  <div className="min-w-0">
                    <div className="type-title-medium font-bold text-on-surface leading-tight">Boarding</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      Overnight · 24/7 supervision ·{' '}
                      <span className="type-label-large font-bold text-on-surface">₦25,000</span>
                      {' '}per pet / night
                    </div>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 stroke-current stroke-2 fill-none text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant text-center">
              Not sure?{' '}
              <a href="/#services" className="font-semibold text-primary underline underline-offset-2">
                Browse Services &amp; Pricing
              </a>
              {' '}on the home page first.
            </p>
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
                {service === 'grooming'
                  ? 'Grooming Details'
                  : service === 'daycare'
                  ? 'Daycare Details'
                  : 'Boarding Details'}
              </span>
            </div>

            {/* GROOMING ENTRY */}
            {service === 'grooming' && (
              <div className="space-y-8">
                <div>
                  <h1 className="type-headline-large font-bold text-on-surface">Grooming Packages</h1>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Select your pet type and size to view tailored packages. Appointments last 90 minutes.
                  </p>
                </div>

                {/* Pet Species Selection */}
                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4">
                  <label className="type-label-large font-bold text-on-surface block">
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
                    <label className="type-label-large font-bold text-on-surface block">
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
                    <h2 className="type-title-large font-bold text-on-surface">Available Packages</h2>
                    <span className="type-label-small font-semibold text-primary">90-minute appointment</span>
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
                            <h3 className="type-title-medium font-bold text-on-surface">Basic Bath</h3>
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
                          <div className="type-headline-small font-extrabold text-primary">
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
                            <h3 className="type-title-medium font-bold text-on-surface">Full Groom</h3>
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
                          <div className="type-headline-small font-extrabold text-primary">
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
                            <h3 className="type-title-medium font-bold text-on-surface">Premium Groom</h3>
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
                          <div className="type-headline-small font-extrabold text-primary">
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
                          <div className="type-headline-small font-extrabold text-primary">₦15,000</div>
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
                          <div className="type-headline-small font-extrabold text-primary">₦22,000</div>
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
                  <h1 className="type-headline-large font-bold text-on-surface">Daycare Booking</h1>
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
                  <h1 className="type-headline-large font-bold text-on-surface">Boarding Booking</h1>
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
                className="type-label-large w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all"
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
              <h1 className="type-headline-large font-bold text-on-surface">
                {authMode === 'signin' ? 'Sign in to continue' : 'Create your account'}
              </h1>
              <p className="type-body-medium text-on-surface-variant max-w-sm mx-auto">
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
                  <label className="block type-label-medium font-bold text-on-surface mb-1" htmlFor="signin-email">
                    Email Address
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
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
                  className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
                  <label className="block type-label-medium font-bold text-on-surface mb-1" htmlFor="signup-name">
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="e.g. Juliet Ogunleye"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.name ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.name && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block type-label-medium font-bold text-on-surface mb-1" htmlFor="signup-email">
                    Email Address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.email ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.email && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block type-label-medium font-bold text-on-surface mb-1" htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
                      signUpErrors.password ? 'border-error ring-1 ring-error' : 'border-outline-variant'
                    }`}
                  />
                  {signUpErrors.password && (
                    <p className="text-xs text-error mt-1 font-semibold">{signUpErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block type-label-medium font-bold text-on-surface mb-1" htmlFor="signup-confirm-password">
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm-password"
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border type-body-medium bg-background text-on-background focus:outline-none focus:ring-2 focus:ring-primary ${
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
                  className="type-label-large w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
                {loadingPets ? (
                  <div className="p-8 text-center bg-surface-container-low rounded-xl border border-outline-variant">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
                    <p className="text-xs text-on-surface-variant">Loading your saved pets...</p>
                  </div>
                ) : petsError ? (
                  <div className="p-4 bg-error-container/20 border border-error rounded-xl flex items-center justify-between text-xs">
                    <span className="text-error font-medium">{petsError}</span>
                    <button
                      type="button"
                      onClick={fetchPets}
                      className="font-bold text-primary hover:underline ml-3"
                    >
                      Retry
                    </button>
                  </div>
                ) : pets.length === 0 ? (
                  <div className="p-6 text-center bg-surface-container-low rounded-xl border border-outline-variant space-y-1">
                    <p className="font-bold text-sm text-on-surface">No pet profiles yet</p>
                    <p className="text-xs text-on-surface-variant">
                      Add your pet below to associate them with this {service} booking.
                    </p>
                  </div>
                ) : (
                  pets.map((pet) => {
                    const isSelected = selectedPet === pet.id;
                    const tier = pet.species === 'DOG' && pet.weightKg !== null ? getDogSizeTier(pet.weightKg) : null;
                    const details: string[] = [];
                    if (pet.breed) details.push(pet.breed);
                    if (pet.weightKg !== null) {
                      details.push(tier ? `${pet.weightKg} kg (${tier})` : `${pet.weightKg} kg`);
                    }
                    if (pet.careNotes) details.push(`Note: ${pet.careNotes}`);
                    const subtitle = details.length > 0 ? details.join(' • ') : (pet.species === 'DOG' ? 'Dog' : 'Cat');

                    return (
                      <div
                        key={pet.id}
                        onClick={() => setSelectedPet(pet.id)}
                        className={`cursor-pointer p-4 rounded-xl border flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-primary bg-primary-container/40 ring-1 ring-primary'
                            : 'border-outline-variant hover:border-outline'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" role="img" aria-label={pet.species}>
                            {pet.species === 'CAT' ? '🐱' : '🐕'}
                          </span>
                          <div>
                            <div className="font-bold text-sm text-on-surface">{pet.name}</div>
                            <div className="text-xs text-on-surface-variant">{subtitle}</div>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="pet_select"
                          checked={isSelected}
                          onChange={() => setSelectedPet(pet.id)}
                          className="accent-primary"
                        />
                      </div>
                    );
                  })
                )}

                {!showAddPetForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPetSpecies(species === 'cat' ? 'CAT' : 'DOG');
                      setShowAddPetForm(true);
                    }}
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
                        onClick={() => {
                          setShowAddPetForm(false);
                          setSavePetError(null);
                        }}
                        className="text-xs text-on-surface-variant hover:text-on-surface"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                          Pet Name *
                        </label>
                        <input
                          type="text"
                          value={newPetName}
                          onChange={(e) => setNewPetName(e.target.value)}
                          placeholder="e.g. Luna"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                          Species *
                        </label>
                        <select
                          value={newPetSpecies}
                          onChange={(e) => setNewPetSpecies(e.target.value as 'DOG' | 'CAT')}
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="DOG">Dog</option>
                          <option value="CAT">Cat</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                          Breed (optional)
                        </label>
                        <input
                          type="text"
                          value={newPetBreed}
                          onChange={(e) => setNewPetBreed(e.target.value)}
                          placeholder="e.g. Golden Retriever"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                          Weight in kg (optional)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="150"
                          value={newPetWeight}
                          onChange={(e) => setNewPetWeight(e.target.value)}
                          placeholder="e.g. 18.5"
                          className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                        Care Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={newPetCareNotes}
                        onChange={(e) => setNewPetCareNotes(e.target.value)}
                        placeholder="e.g. Sensitive skin, timid around loud noises"
                        className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs bg-surface text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {savePetError && (
                      <p className="text-xs text-error font-semibold">{savePetError}</p>
                    )}
                    <button
                      type="button"
                      disabled={savingPet}
                      onClick={handleSavePet}
                      className="text-xs font-bold bg-primary text-on-primary px-4 py-2 rounded-full disabled:opacity-50 hover:brightness-105 active:scale-[0.98] transition-all"
                    >
                      {savingPet ? 'Saving Pet...' : 'Save Pet'}
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Notice */}
              <div className="mt-6 pt-4 border-t border-outline-variant text-center space-y-2">
                <p className="text-xs text-on-surface-variant">
                  Pet selected: <strong>{pets.find((p) => p.id === selectedPet)?.name || 'None'}</strong>. Proceed to pick appointment or stay dates.
                </p>
                <button
                  type="button"
                  disabled={!selectedPet}
                  onClick={() => {
                    setStep(5);
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-40 cursor-pointer"
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

        {/* STEP 5: DATE SELECTION & AVAILABILITY */}
        {step === 5 && service && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            {/* Context Summary Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Pet Selection
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                Step 5 of 5 · Schedule &amp; Availability
              </span>
            </div>

            {/* Preserved Booking & Pet Details Banner */}
            {(() => {
              const activePet = pets.find((p) => p.id === selectedPet);
              const petWeight = activePet?.weightKg !== null && activePet?.weightKg !== undefined ? Number(activePet.weightKg) : null;
              const dogTier = activePet?.species === 'DOG' ? calculateDogSizeTier(petWeight) : null;

              return (
                <div className="bg-surface rounded-2xl border border-outline-variant p-5 shadow-soft space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                      Selected Service &amp; Pet
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Change Pet
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-on-surface-variant block">Service</span>
                      <span className="font-bold text-on-surface capitalize text-sm">{service}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Pet Name</span>
                      <span className="font-bold text-on-surface text-sm">{activePet?.name || 'Selected Pet'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Species</span>
                      <span className="font-bold text-on-surface capitalize text-sm">{activePet?.species === 'CAT' ? 'Cat' : 'Dog'}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">
                        {service === 'grooming' ? 'Package / Tier' : 'Rate Basis'}
                      </span>
                      <span className="font-bold text-on-surface capitalize text-sm">
                        {service === 'grooming'
                          ? activePet?.species === 'DOG'
                            ? `${groomingPackage} (${dogTier || 'No weight'})`
                            : `${groomingPackage === 'premium' ? 'full' : groomingPackage}`
                          : service === 'daycare'
                          ? 'Per calendar day'
                          : 'Per night'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SERVICE-SPECIFIC DATE SELECTION */}
            {/* 1. GROOMING DATE & SLOT SELECTOR */}
            {service === 'grooming' && (() => {
              const activePet = pets.find((p) => p.id === selectedPet);
              const isDog = activePet?.species === 'DOG';
              const petWeight = activePet?.weightKg !== null && activePet?.weightKg !== undefined ? Number(activePet.weightKg) : null;
              const dogTier = isDog ? calculateDogSizeTier(petWeight) : null;
              const missingDogWeight = isDog && dogTier === null;

              // Price computation
              let priceResult = null;
              let priceError = null;
              if (!missingDogWeight) {
                try {
                  const effectivePkg = (activePet?.species === 'CAT' && groomingPackage === 'premium' ? 'full' : groomingPackage).toUpperCase() as 'BASIC' | 'FULL' | 'PREMIUM';
                  priceResult = calculatePrice({
                    serviceType: 'GROOMING',
                    species: activePet?.species === 'CAT' ? 'CAT' : 'DOG',
                    weightKg: petWeight,
                    groomingPackage: effectivePkg,
                    quantity: 1,
                  });
                } catch (e: any) {
                  priceError = e.message;
                }
              }

              return (
                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-6 shadow-soft">
                  <div>
                    <h2 className="type-title-medium font-bold text-on-surface">
                      Choose Appointment Date &amp; Time Slot
                    </h2>
                    <p className="type-body-small text-on-surface-variant mt-0.5">
                      Grooming appointments are 90 minutes. 2 groomers are on duty across 3 daily slots (09:00, 12:00, 15:00 Africa/Lagos).
                    </p>
                  </div>

                  {missingDogWeight && (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1">
                      <p className="font-bold text-error">Dog Weight Required (BR-003, FR-005)</p>
                      <p className="text-on-surface-variant">
                        Dog grooming prices require an accurate weight to determine size tier (Small &lt;10kg, Medium 10–25kg, Large &gt;25kg).
                        Please return to Pet Selection and edit or add your dog with weight.
                      </p>
                    </div>
                  )}

                  {/* Date Input */}
                  <div className="space-y-2">
                    <label htmlFor="grooming-date" className="type-label-medium font-bold text-on-surface block">
                      Select Date (Earliest: Tomorrow per BR-043)
                    </label>
                    <input
                      id="grooming-date"
                      type="date"
                      min={earliestDate}
                      value={groomingDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGroomingDate(val);
                      }}
                      className="w-full sm:w-72 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                    />
                    <p className="text-[11px] text-on-surface-variant">
                      Same-day bookings are not offered (BR-043). Earliest available date is {earliestDate}.
                    </p>
                  </div>

                  {/* Slot Selector */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="type-label-medium font-bold text-on-surface">
                        Available 90-Minute Slots for {groomingDate}
                      </label>
                      {loadingGroomingSlots && (
                        <span className="text-xs text-primary flex items-center gap-1.5">
                          <svg className="animate-spin h-3.5 w-3.5 text-primary" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Checking slot capacity...
                        </span>
                      )}
                    </div>

                    {groomingError && (
                      <div className="p-3 bg-error-container/20 border border-error rounded-xl text-xs text-error font-medium">
                        {groomingError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {GROOMING_SLOTS.map((defaultSlot) => {
                        const slotData = groomingSlotsData.find((s) => s.slotCode === defaultSlot.slotCode);
                        const isAvailable = slotData ? slotData.available : true;
                        const reason = slotData?.reason;
                        const isSelected = groomingSlot === defaultSlot.slotCode && isAvailable;

                        return (
                          <div
                            key={defaultSlot.slotCode}
                            onClick={() => {
                              if (isAvailable) setGroomingSlot(defaultSlot.slotCode);
                            }}
                            className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                              !isAvailable
                                ? 'bg-surface-container-high/40 border-outline-variant opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-primary-container/40 border-primary ring-2 ring-primary cursor-pointer'
                                : 'bg-surface border-outline-variant hover:border-primary cursor-pointer'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="type-title-medium font-bold text-on-surface">
                                  {defaultSlot.startTime}
                                </span>
                                <span
                                  className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                                    isAvailable
                                      ? 'bg-success-container text-on-success-container'
                                      : 'bg-error-container text-on-error-container'
                                  }`}
                                >
                                  {isAvailable ? 'Available' : reason || 'Full'}
                                </span>
                              </div>
                              <p className="type-body-small text-on-surface-variant mt-1">
                                {defaultSlot.label}
                              </p>
                              <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                                90-minute grooming session
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-outline-variant/50 flex items-center justify-between">
                              <span className="text-[11px] text-on-surface-variant font-medium">
                                {isAvailable ? '2 places / slot' : 'No places left'}
                              </span>
                              <input
                                type="radio"
                                name="grooming_slot"
                                checked={isSelected}
                                disabled={!isAvailable}
                                onChange={() => isAvailable && setGroomingSlot(defaultSlot.slotCode)}
                                className="accent-primary"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Card */}
                  {priceResult && (
                    <div className="bg-surface-container-low rounded-xl border border-outline-variant p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">Grooming Fee ({priceResult.sizeTier ? `${priceResult.sizeTier} dog` : 'Cat'})</span>
                        <span className="font-bold text-on-surface">{priceResult.formattedUnitPrice}</span>
                      </div>
                      <div className="pt-2 border-t border-outline-variant flex items-center justify-between">
                        <span className="type-label-large font-bold text-on-surface">Estimated Total:</span>
                        <span className="type-headline-large font-extrabold text-primary">
                          {priceResult.formattedTotal}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Review Error Notification */}
                  {reviewError && (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1 animate-fadeIn">
                      <p className="font-bold text-error">Validation / Availability Notice</p>
                      <p className="text-on-surface">{reviewError}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
                    >
                      ← Back to Pet Selection
                    </button>
                    <button
                      type="button"
                      disabled={
                        loadingReview ||
                        missingDogWeight ||
                        !groomingSlot ||
                        loadingGroomingSlots ||
                        (groomingSlotsData.length > 0 &&
                          !groomingSlotsData.find((s) => s.slotCode === groomingSlot)?.available)
                      }
                      onClick={handleProceedToReview}
                      className="w-full sm:w-auto type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loadingReview ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Validating Quote...
                        </span>
                      ) : (
                        <>
                          <span>Proceed to Booking Review</span>
                          <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 2. DAYCARE DATE SELECTOR */}
            {service === 'daycare' && (() => {
              const activePet = pets.find((p) => p.id === selectedPet);
              const effectiveEnd = daycareMode === 'single' ? daycareStartDate : daycareEndDate;
              const totalDays = daycareStartDate && effectiveEnd ? countDaycareDays(daycareStartDate, effectiveEnd) : 0;
              const isDateRangeValid = daycareStartDate && effectiveEnd && effectiveEnd >= daycareStartDate && totalDays > 0;

              const priceResult = isDateRangeValid
                ? calculatePrice({
                    serviceType: 'DAYCARE',
                    species: activePet?.species === 'CAT' ? 'CAT' : 'DOG',
                    quantity: totalDays,
                  })
                : null;

              const isAvailable = daycareAvailData?.available ?? true;
              const firstUnavailable = daycareAvailData?.firstUnavailableDate;

              return (
                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-6 shadow-soft">
                  <div>
                    <h2 className="type-title-medium font-bold text-on-surface">
                      Select Daycare Date or Date Range
                    </h2>
                    <p className="type-body-small text-on-surface-variant mt-0.5">
                      Daycare hours: <strong>8:00 AM – 8:00 PM</strong> (Lagos Time). ₦12,000 per pet / calendar day. Maximum 20 daycare places per day.
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDaycareMode('single');
                        setDaycareEndDate(daycareStartDate);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        daycareMode === 'single'
                          ? 'bg-primary text-on-primary shadow-soft'
                          : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDaycareMode('range');
                        if (daycareEndDate <= daycareStartDate) {
                          setDaycareEndDate(addDaysToDateString(daycareStartDate, 1));
                        }
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        daycareMode === 'range'
                          ? 'bg-primary text-on-primary shadow-soft'
                          : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Consecutive Date Range
                    </button>
                  </div>

                  {/* Date Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="daycare-start" className="type-label-medium font-bold text-on-surface block">
                        {daycareMode === 'single' ? 'Service Date' : 'Start Date'}
                      </label>
                      <input
                        id="daycare-start"
                        type="date"
                        min={earliestDate}
                        value={daycareStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDaycareStartDate(val);
                          if (daycareMode === 'single' || val > daycareEndDate) {
                            setDaycareEndDate(val);
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                      />
                    </div>

                    {daycareMode === 'range' && (
                      <div className="space-y-1.5">
                        <label htmlFor="daycare-end" className="type-label-medium font-bold text-on-surface block">
                          End Date (Inclusive)
                        </label>
                        <input
                          id="daycare-end"
                          type="date"
                          min={daycareStartDate || earliestDate}
                          value={daycareEndDate}
                          onChange={(e) => setDaycareEndDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                        />
                      </div>
                    )}
                  </div>

                  {/* Availability Status Banner */}
                  {loadingDaycareAvail ? (
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex items-center gap-2 text-xs text-primary">
                      <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Checking daycare capacity for {totalDays} calendar day(s)...
                    </div>
                  ) : daycareError ? (
                    <div className="p-4 bg-error-container/20 border border-error rounded-xl text-xs text-error font-medium">
                      {daycareError}
                    </div>
                  ) : isAvailable ? (
                    <div className="p-4 bg-success-container/60 border border-success/30 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-on-success-container flex items-center gap-2">
                        <span className="text-base">✓</span>
                        Daycare Available: All {totalDays} day(s) have open capacity.
                      </span>
                      <span className="text-[11px] font-semibold text-on-success-container/80">
                        {totalDays} day(s) · 8 AM – 8 PM
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1">
                      <p className="font-bold text-error">Selected Range Unavailable</p>
                      <p className="text-on-surface-variant">
                        One or more selected days are fully booked or closed (First unavailable: <strong>{firstUnavailable}</strong>). Please choose alternative dates.
                      </p>
                    </div>
                  )}

                  {/* Pricing Card */}
                  {priceResult && (
                    <div className="bg-surface-container-low rounded-xl border border-outline-variant p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">
                          Daycare Rate (₦12,000 × {priceResult.quantity} day{priceResult.quantity > 1 ? 's' : ''})
                        </span>
                        <span className="font-bold text-on-surface">{priceResult.formattedTotal}</span>
                      </div>
                      <div className="pt-2 border-t border-outline-variant flex items-center justify-between">
                        <span className="type-label-large font-bold text-on-surface">Estimated Total:</span>
                        <span className="type-headline-large font-extrabold text-primary">
                          {priceResult.formattedTotal}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Review Error Notification */}
                  {reviewError && (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1 animate-fadeIn">
                      <p className="font-bold text-error">Validation / Availability Notice</p>
                      <p className="text-on-surface">{reviewError}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
                    >
                      ← Back to Pet Selection
                    </button>
                    <button
                      type="button"
                      disabled={loadingReview || !isDateRangeValid || loadingDaycareAvail || !isAvailable}
                      onClick={handleProceedToReview}
                      className="w-full sm:w-auto type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loadingReview ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Validating Quote...
                        </span>
                      ) : (
                        <>
                          <span>Proceed to Booking Review</span>
                          <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3. BOARDING DATE SELECTOR */}
            {service === 'boarding' && (() => {
              const activePet = pets.find((p) => p.id === selectedPet);
              const totalNights = boardingCheckIn && boardingCheckOut ? countBoardingNights(boardingCheckIn, boardingCheckOut) : 0;
              const isStayValid = boardingCheckIn && boardingCheckOut && boardingCheckOut > boardingCheckIn && totalNights > 0;

              const priceResult = isStayValid
                ? calculatePrice({
                    serviceType: 'BOARDING',
                    species: activePet?.species === 'CAT' ? 'CAT' : 'DOG',
                    quantity: totalNights,
                  })
                : null;

              const isAvailable = boardingAvailData?.available ?? true;
              const firstUnavailable = boardingAvailData?.firstUnavailableNight;

              return (
                <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-6 shadow-soft">
                  <div>
                    <h2 className="type-title-medium font-bold text-on-surface">
                      Select Boarding Check-In &amp; Check-Out Dates
                    </h2>
                    <p className="type-body-small text-on-surface-variant mt-0.5">
                      Stay Window: Check-in from <strong>8:00 PM</strong>, Check-out by <strong>8:00 AM</strong> (Lagos Time). ₦25,000 per pet / night.
                      Maximum 16 kennel spaces per night. The check-out day does not use a kennel space (BR-010).
                    </p>
                  </div>

                  {/* Dates Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="boarding-checkin" className="type-label-medium font-bold text-on-surface block">
                        Check-In Date (from 8:00 PM)
                      </label>
                      <input
                        id="boarding-checkin"
                        type="date"
                        min={earliestDate}
                        value={boardingCheckIn}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBoardingCheckIn(val);
                          if (val >= boardingCheckOut) {
                            setBoardingCheckOut(addDaysToDateString(val, 1));
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="boarding-checkout" className="type-label-medium font-bold text-on-surface block">
                        Check-Out Date (by 8:00 AM)
                      </label>
                      <input
                        id="boarding-checkout"
                        type="date"
                        min={addDaysToDateString(boardingCheckIn || earliestDate, 1)}
                        value={boardingCheckOut}
                        onChange={(e) => setBoardingCheckOut(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {/* Availability Status Banner */}
                  {loadingBoardingAvail ? (
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex items-center gap-2 text-xs text-primary">
                      <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Checking kennel availability across {totalNights} night(s)...
                    </div>
                  ) : boardingError ? (
                    <div className="p-4 bg-error-container/20 border border-error rounded-xl text-xs text-error font-medium">
                      {boardingError}
                    </div>
                  ) : isAvailable ? (
                    <div className="p-4 bg-success-container/60 border border-success/30 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-on-success-container flex items-center gap-2">
                        <span className="text-base">✓</span>
                        Kennel Available: All {totalNights} night(s) have open kennel places.
                      </span>
                      <span className="text-[11px] font-semibold text-on-success-container/80">
                        {totalNights} night(s) (8 PM – 8 AM)
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1">
                      <p className="font-bold text-error">Kennel Capacity Unavailable</p>
                      <p className="text-on-surface-variant">
                        One or more nights in your requested stay are fully booked or closed (First full night: <strong>{firstUnavailable}</strong>).
                        Please adjust your check-in or check-out dates.
                      </p>
                    </div>
                  )}

                  {/* Pricing Card */}
                  {priceResult && (
                    <div className="bg-surface-container-low rounded-xl border border-outline-variant p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">
                          Boarding Fee (₦25,000 × {priceResult.quantity} night{priceResult.quantity > 1 ? 's' : ''})
                        </span>
                        <span className="font-bold text-on-surface">{priceResult.formattedTotal}</span>
                      </div>
                      <div className="pt-2 border-t border-outline-variant flex items-center justify-between">
                        <span className="type-label-large font-bold text-on-surface">Estimated Total:</span>
                        <span className="type-headline-large font-extrabold text-primary">
                          {priceResult.formattedTotal}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Review Error Notification */}
                  {reviewError && (
                    <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1 animate-fadeIn">
                      <p className="font-bold text-error">Validation / Availability Notice</p>
                      <p className="text-on-surface">{reviewError}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
                    >
                      ← Back to Pet Selection
                    </button>
                    <button
                      type="button"
                      disabled={loadingReview || !isStayValid || loadingBoardingAvail || !isAvailable}
                      onClick={handleProceedToReview}
                      className="w-full sm:w-auto type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-6 py-3 rounded-full shadow-soft hover:shadow-medium transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loadingReview ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Validating Quote...
                        </span>
                      ) : (
                        <>
                          <span>Proceed to Booking Review</span>
                          <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP 6: BOOKING REVIEW (STAGE 3) */}
        {step === 6 && reviewData && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            {/* Context Navigation Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <button
                type="button"
                disabled={creatingBooking}
                onClick={() => setStep(5)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Edit Schedule
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                Step 6 of 6 · Booking Review
              </span>
            </div>

            {/* Advisory Quote Notice Banner */}
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex items-start gap-3">
              <span className="text-primary text-xl">ℹ️</span>
              <div className="space-y-0.5">
                <h3 className="type-label-large font-bold text-on-surface">
                  Estimated Booking Quote
                </h3>
                <p className="type-body-small text-on-surface-variant">
                  {reviewData.disclaimer} Please review your selections, price breakdown, and policy conditions before continuing.
                </p>
              </div>
            </div>

            {/* 1. Pet & Service Summary Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl" aria-hidden="true">
                    {reviewData.serviceType === 'GROOMING' ? '✂️' : reviewData.serviceType === 'DAYCARE' ? '🐾' : '🌙'}
                  </span>
                  <div>
                    <h2 className="type-title-medium font-bold text-on-surface capitalize">
                      {reviewData.serviceType.toLowerCase()} Service
                    </h2>
                    <span className="text-xs text-on-surface-variant">Selected pet and package details</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Change Pet
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-on-surface-variant block font-medium">Pet Name</span>
                  <span className="type-body-medium font-bold text-on-surface">{reviewData.pet.name}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">Species</span>
                  <span className="type-body-medium font-bold text-on-surface capitalize">
                    {reviewData.pet.species === 'CAT' ? 'Cat' : 'Dog'}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">Breed</span>
                  <span className="type-body-medium font-bold text-on-surface">{reviewData.pet.breed}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">
                    {reviewData.pet.species === 'DOG' ? 'Weight & Size Tier' : 'Weight'}
                  </span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {reviewData.pet.formattedWeight
                      ? reviewData.pet.sizeTier
                        ? `${reviewData.pet.formattedWeight} (${reviewData.pet.sizeTier})`
                        : reviewData.pet.formattedWeight
                      : 'Not recorded'}
                  </span>
                </div>
              </div>

              {reviewData.pet.careNotes && (
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-xs text-on-surface-variant">
                  <span className="font-bold text-on-surface mr-1.5">Care Notes:</span>
                  {reviewData.pet.careNotes}
                </div>
              )}
            </div>

            {/* 2. Schedule Details Card (Service-Specific) */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <div>
                  <h2 className="type-title-medium font-bold text-on-surface">
                    Appointment &amp; Stay Schedule
                  </h2>
                  <span className="text-xs text-on-surface-variant">Confirmed arrival and service schedule</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Edit Schedule
                </button>
              </div>

              {reviewData.serviceType === 'GROOMING' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-on-surface-variant block font-medium">Appointment Date</span>
                    <span className="type-body-medium font-bold text-on-surface">{reviewData.schedule.appointmentDate}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block font-medium">Appointment Time</span>
                    <span className="type-body-medium font-bold text-on-surface">{reviewData.schedule.appointmentHours}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block font-medium">Session Duration</span>
                    <span className="type-body-medium font-bold text-on-surface">
                      {reviewData.schedule.durationMinutes} minutes ({reviewData.schedule.groomingPackage} Package)
                    </span>
                  </div>
                </div>
              )}

              {reviewData.serviceType === 'DAYCARE' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-on-surface-variant block font-medium">
                        {reviewData.schedule.mode === 'single' ? 'Service Date' : 'Booking Period'}
                      </span>
                      <span className="type-body-medium font-bold text-on-surface">
                        {reviewData.schedule.mode === 'single'
                          ? reviewData.schedule.startDate
                          : `${reviewData.schedule.startDate} to ${reviewData.schedule.endDate}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block font-medium">Total Calendar Days</span>
                      <span className="type-body-medium font-bold text-on-surface">
                        {reviewData.schedule.totalDays} calendar day{reviewData.schedule.totalDays > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block font-medium">Operating Hours</span>
                      <span className="type-body-medium font-bold text-on-surface">{reviewData.schedule.operatingHours}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Drop-off begins at 8:00 AM; collection is required by 8:00 PM (Africa/Lagos).
                  </p>
                </div>
              )}

              {reviewData.serviceType === 'BOARDING' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-on-surface-variant block font-medium">Check-In Date</span>
                      <span className="type-body-medium font-bold text-on-surface">
                        {reviewData.schedule.checkInDate} ({reviewData.schedule.checkInWindow})
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block font-medium">Check-Out Date</span>
                      <span className="type-body-medium font-bold text-on-surface">
                        {reviewData.schedule.checkOutDate} ({reviewData.schedule.checkOutWindow})
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block font-medium">Stay Length</span>
                      <span className="type-body-medium font-bold text-on-surface">
                        {reviewData.schedule.totalNights} night{reviewData.schedule.totalNights > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    {reviewData.schedule.kennelRule}. Kennel capacity is allocated exclusively across the {reviewData.schedule.totalNights} overnight period(s).
                  </p>
                </div>
              )}
            </div>

            {/* 3. Itemized Price Breakdown Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="border-b border-outline-variant pb-3">
                <h2 className="type-title-medium font-bold text-on-surface">
                  Itemized Price Breakdown
                </h2>
                <span className="text-xs text-on-surface-variant">
                  Calculated using exact integer kobo to prevent floating-point rounding errors
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant font-medium">
                    Base Rate ({reviewData.pricing.formattedUnitPrice} / {reviewData.pricing.quantityUnit})
                  </span>
                  <span className="font-semibold text-on-surface">
                    {reviewData.pricing.quantity} × {reviewData.pricing.formattedUnitPrice}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-outline-variant/60">
                  <span className="text-on-surface-variant font-medium">Subtotal</span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {reviewData.pricing.formattedSubtotal}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-outline-variant/60">
                  <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                    <span>Applicable Tax ({reviewData.pricing.taxRatePercent}%)</span>
                    <span className="text-[10px] text-on-surface-variant/70">(Lagos State Standard)</span>
                  </span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {reviewData.pricing.formattedTax}
                  </span>
                </div>

                <div className="pt-3 border-t-2 border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="type-label-large font-bold text-on-surface block">
                      Total Estimated Amount Payable
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Stored as {reviewData.pricing.totalKobo.toLocaleString()} kobo
                    </span>
                  </div>
                  <span className="type-headline-large font-extrabold text-primary">
                    {reviewData.pricing.formattedTotal}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Booking Policy Information Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="border-b border-outline-variant pb-3">
                <h2 className="type-title-medium font-bold text-on-surface">
                  Booking Policies &amp; Terms
                </h2>
                <span className="text-xs text-on-surface-variant">
                  Please review our business and cancellation rules before proceeding
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Cancellation Policy */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                  <span className="text-base text-primary shrink-0">🛡️</span>
                  <div>
                    <span className="font-bold text-on-surface block">No Cancellations or Refunds</span>
                    <p className="text-on-surface-variant mt-0.5">
                      {reviewData.policies.cancellation} Once payment is verified, bookings cannot be cancelled and no funds are refunded or credited.
                    </p>
                  </div>
                </div>

                {/* Rescheduling Policy */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                  <span className="text-base text-primary shrink-0">📅</span>
                  <div>
                    <span className="font-bold text-on-surface block">Rescheduling Deadline</span>
                    <p className="text-on-surface-variant mt-0.5">
                      {reviewData.policies.rescheduling}
                    </p>
                    <p className="font-semibold text-primary mt-1">
                      Deadline: {reviewData.policies.rescheduleDeadline}.
                    </p>
                  </div>
                </div>

                {/* Health & Vaccination Policy */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                  <span className="text-base text-primary shrink-0">💉</span>
                  <div>
                    <span className="font-bold text-on-surface block">In-Person Vaccination Evidence</span>
                    <p className="text-on-surface-variant mt-0.5">
                      {reviewData.policies.vaccinationNotice} Evidence must be verified at check-in counter (BR-007).
                    </p>
                  </div>
                </div>

                {/* Late Pickup Notice (if Daycare) */}
                {reviewData.policies.latePickupNotice && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                    <span className="text-base text-warning shrink-0">⚠️</span>
                    <div>
                      <span className="font-bold text-on-surface block">Daycare Closing &amp; Late Penalty</span>
                      <p className="text-on-surface-variant mt-0.5">
                        {reviewData.policies.latePickupNotice}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Creation Error Notification */}
            {createBookingError && (
              <div className="p-4 bg-error-container/30 border border-error rounded-xl text-xs space-y-1.5 animate-fadeIn">
                <p className="font-bold text-error">Booking Reservation Failed</p>
                <p className="text-on-surface">{createBookingError}</p>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="font-bold text-primary hover:underline block pt-1"
                >
                  Return to Schedule to select an alternative slot or date →
                </button>
              </div>
            )}

            {/* Actions & Navigation */}
            <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={creatingBooking}
                  onClick={() => setStep(5)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  ← Edit Schedule
                </button>
                <button
                  type="button"
                  disabled={creatingBooking}
                  onClick={() => setStep(4)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  Change Pet
                </button>
              </div>

              <button
                type="button"
                disabled={creatingBooking}
                onClick={handleCreateBooking}
                className="w-full sm:w-auto type-label-large inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:brightness-105 active:scale-[0.98] px-8 py-3.5 rounded-full shadow-soft hover:shadow-medium transition-all cursor-pointer font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBooking ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Reserving Capacity...
                  </span>
                ) : (
                  <>
                    <span>Confirm &amp; Hold Capacity (Stage 4)</span>
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: BOOKING CREATED & CAPACITY HOLD CONFIRMED (STAGE 4 SUCCESS) */}
        {step === 7 && createdBooking && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            {/* Success Banner */}
            <div className="bg-success-container/90 border border-success/40 rounded-2xl p-6 text-center space-y-3 shadow-soft">
              <div className="w-14 h-14 bg-success text-on-success rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-soft">
                ✓
              </div>
              <div>
                <h1 className="type-headline-large font-extrabold text-on-success-container">
                  Capacity Hold Confirmed!
                </h1>
                <p className="type-body-small text-on-success-container/90 mt-1">
                  Your place has been atomically reserved in the database. A unique booking reference has been issued.
                </p>
              </div>

              {/* Booking Reference Display */}
              <div className="bg-surface/90 rounded-2xl border border-outline-variant p-4 max-w-sm mx-auto shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant block">
                  Booking Reference
                </span>
                <span className="text-3xl font-mono font-black text-primary tracking-wider block mt-0.5">
                  {createdBooking.reference}
                </span>
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-warning-container text-on-warning-container">
                  Status: Awaiting Payment (PENDING_PAYMENT)
                </span>
              </div>
            </div>

            {/* Hold Expiry Notice Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-5 shadow-soft space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0" aria-hidden="true">⏳</span>
                <div className="space-y-1">
                  <h3 className="type-title-medium font-bold text-on-surface">
                    10-Minute Capacity Hold Active
                  </h3>
                  <p className="type-body-small text-on-surface-variant">
                    Capacity for your chosen service is held until{' '}
                    <strong className="text-on-surface">
                      {createdBooking.holdExpiresAt
                        ? new Date(createdBooking.holdExpiresAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '10 minutes from now'}{' '}
                      (Africa/Lagos)
                    </strong>
                    . If payment is not completed before hold expiry, the reserved units will be safely released.
                  </p>
                </div>
              </div>
            </div>

            {/* Persisted Booking Summary Card */}
            <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4 shadow-soft">
              <div className="border-b border-outline-variant pb-3">
                <h2 className="type-title-medium font-bold text-on-surface">
                  Persisted Booking Details
                </h2>
                <span className="text-xs text-on-surface-variant">
                  Stored securely in the Good Pets database
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-on-surface-variant block font-medium">Service</span>
                  <span className="type-body-medium font-bold text-on-surface capitalize">
                    {createdBooking.serviceType.toLowerCase()}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">Pet</span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {createdBooking.petNameSnapshot} ({createdBooking.petSpeciesSnapshot.toLowerCase()})
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">Dates / Slot</span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {createdBooking.serviceType === 'GROOMING'
                      ? `${createdBooking.startDate} (${createdBooking.slotCode})`
                      : `${createdBooking.startDate} to ${createdBooking.endDate}`}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block font-medium">Quantity</span>
                  <span className="type-body-medium font-bold text-on-surface">
                    {createdBooking.quantity}{' '}
                    {createdBooking.serviceType === 'GROOMING'
                      ? 'session'
                      : createdBooking.serviceType === 'DAYCARE'
                      ? 'days'
                      : 'nights'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant flex items-center justify-between">
                <div>
                  <span className="type-label-large font-bold text-on-surface block">
                    Total Amount Awaiting Payment:
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {createdBooking.totalKobo.toLocaleString()} kobo
                  </span>
                </div>
                <span className="type-headline-large font-extrabold text-primary">
                  {createdBooking.formattedTotal}
                </span>
              </div>
            </div>

            {/* Payment Integration Boundary Card */}
            <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-5 shadow-soft space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">💳</span>
                <h3 className="type-title-medium font-bold text-on-surface">
                  Payment Status: Not Yet Completed
                </h3>
              </div>
              <p className="type-body-small text-on-surface-variant">
                No payment has been charged and no money has moved. In Stage 5, you will be redirected to Paystack (test mode) to finalize payment by card or bank transfer. Once Paystack reports verified payment, your booking will transition to CONFIRMED.
              </p>
            </div>

            {/* Navigation Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 rounded-full border border-outline hover:border-primary text-xs font-bold text-on-surface hover:text-primary transition-colors text-center"
              >
                Return to Home
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCreatedBooking(null);
                  setReviewData(null);
                  setBookingIdempotencyKey('');
                  setStep(1);
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-primary text-on-primary hover:brightness-105 text-xs font-bold transition-all text-center"
              >
                Book Another Service
              </button>
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
