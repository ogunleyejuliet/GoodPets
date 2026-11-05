import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  PaystackVerifyData,
} from '@/lib/paystack';
import { releaseExpiredHolds } from '@/lib/capacity';

/**
 * Good Pets - Payments Domain Service
 *
 * Implements end-to-end payment lifecycle for Paystack integration:
 * - Payment initialization with capacity-hold enforcement (FR-014, BR-017, BR-044)
 * - Atomic payment verification & booking confirmation (FR-015, FR-016, BR-015, BR-016)
 * - Safe exception handling for late payments after hold expiry (FR-019, BR-018)
 * - Idempotent event processing & webhook handling
 */

export interface InitializePaymentInput {
  bookingReference: string;
  user: {
    id: string;
    email: string;
  };
  channel?: 'card' | 'bank_transfer';
  callbackUrl?: string;
}

export interface ConfirmPaymentResult {
  success: boolean;
  status:
    | 'CONFIRMED'
    | 'NEEDS_ATTENTION'
    | 'ALREADY_PROCESSED'
    | 'DUPLICATE_SUCCESS'
    | 'FAILED';
  booking?: any;
  payment?: any;
  error?: string;
}

/**
 * Generates a unique, traceable payment reference.
 * Format: PAY-GP-{bookingRef}-{hex8}
 */
export function generatePaymentReference(bookingReference: string): string {
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PAY-${bookingReference}-${randomSuffix}`;
}

/**
 * Initializes a payment attempt for a booking awaiting payment.
 * PRD FR-014, BR-017, BR-044.
 */
export async function initializeBookingPayment(
  input: InitializePaymentInput
): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const { bookingReference, user, channel = 'card', callbackUrl } = input;

  // 1. Fetch booking with customer relationship
  const booking = await prisma.booking.findUnique({
    where: { reference: bookingReference },
    include: {
      payment: true,
    },
  });

  if (!booking) {
    const error: any = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Strict ownership check (PRD BR-032)
  if (booking.customerId !== user.id) {
    const error: any = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  // 3. Confirm status is PENDING_PAYMENT
  if (booking.status !== 'PENDING_PAYMENT') {
    const error: any = new Error(
      `Booking is in ${booking.status} status and cannot be paid.`
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Confirm capacity hold has not expired
  const now = new Date();
  if (booking.holdExpiresAt && booking.holdExpiresAt < now) {
    // Release expired hold asynchronously to free up units
    releaseExpiredHolds().catch((err) =>
      console.error('Error releasing expired hold on init:', err)
    );

    const error: any = new Error(
      'The 10-minute capacity hold for this booking has expired. Please select new dates.'
    );
    error.statusCode = 400;
    error.code = 'HOLD_EXPIRED';
    throw error;
  }

  // 5. Handle open INITIATED payments & prevent duplicate initialization (PRD FR-014 & BR-044)
  const openPayment = booking.payment?.status === 'INITIATED' ? booking.payment : null;
  if (openPayment) {
    // In one atomic transaction:
    // Verify if openPayment was already paid with Paystack
    try {
      const verifyRes = await verifyPaystackTransaction(openPayment.reference);
      if (verifyRes.data.status === 'success') {
        // Payment succeeded; confirm the booking and stop
        await confirmBookingPayment(openPayment.reference, {
          verifiedData: verifyRes.data,
        });
        const error: any = new Error(
          'This booking has already been paid and confirmed.'
        );
        error.statusCode = 400;
        throw error;
      }
    } catch {
      // If verification fails or payment was not completed, mark open payment ABANDONED
      await prisma.payment.update({
        where: { id: openPayment.id },
        data: {
          status: 'ABANDONED',
          gatewayResponse: 'Abandoned for new payment attempt',
        },
      });
    }
  }

  // 6. Generate fresh unique payment reference
  const paymentReference = generatePaymentReference(booking.reference);

  // 7. Initialize transaction with Paystack (never passing client amount; using booking.totalKobo)
  const paystackChannels = channel === 'bank_transfer' ? (['bank_transfer'] as const) : (['card'] as const);

  const paystackData = await initializePaystackTransaction({
    email: user.email,
    amountKobo: booking.totalKobo,
    reference: paymentReference,
    callbackUrl,
    channels: [...paystackChannels],
    metadata: {
      bookingId: booking.id,
      bookingReference: booking.reference,
      customerId: user.id,
      channel,
    },
  });

  // 8. Persist new Payment record in database (status INITIATED)
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      reference: paymentReference,
      amountKobo: booking.totalKobo,
      currency: 'NGN',
      status: 'INITIATED',
      channel,
      accessCode: paystackData.access_code,
      initiatedAt: new Date(),
    },
  });

  return {
    authorizationUrl: paystackData.authorization_url,
    accessCode: paystackData.access_code,
    reference: paymentReference,
  };
}

/**
 * Confirms a booking after verified payment.
 * Shared atomic confirmation function used by:
 * - Return page / status polling endpoint (FR-015)
 * - Paystack webhook handler (FR-016)
 * - Reconciliation job (FR-018)
 *
 * Implements PRD FR-015, FR-016, FR-019, BR-015, BR-016, BR-018.
 */
export async function confirmBookingPayment(
  paymentReference: string,
  options?: { verifiedData?: PaystackVerifyData }
): Promise<ConfirmPaymentResult> {
  // 1. Fetch verified data from Paystack if not already supplied
  let verifiedData: PaystackVerifyData;
  if (options?.verifiedData) {
    verifiedData = options.verifiedData;
  } else {
    const res = await verifyPaystackTransaction(paymentReference);
    verifiedData = res.data;
  }

  // 2. Locate payment record in database
  const payment = await prisma.payment.findUnique({
    where: { reference: paymentReference },
    include: {
      booking: {
        include: {
          units: {
            include: { capacityUnit: true },
          },
        },
      },
    },
  });

  if (!payment) {
    console.warn(`Payment record with reference ${paymentReference} not found`);
    return {
      success: false,
      status: 'FAILED',
      error: `Payment record ${paymentReference} not found.`,
    };
  }

  // If this payment was already marked SUCCEEDED, return immediately (idempotent)
  if (payment.status === 'SUCCEEDED') {
    return {
      success: true,
      status: 'ALREADY_PROCESSED',
      booking: payment.booking,
      payment,
    };
  }

  const booking = payment.booking;

  // 3. Verify gateway status, currency, and amount (PRD BR-015)
  if (verifiedData.status !== 'success') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: verifiedData.status === 'abandoned' ? 'ABANDONED' : 'FAILED',
        gatewayResponse: verifiedData.gateway_response || 'Payment not successful',
        verifySummary: verifiedData as any,
      },
    });

    return {
      success: false,
      status: 'FAILED',
      booking,
      payment,
      error: `Payment status is ${verifiedData.status}.`,
    };
  }

  if (verifiedData.currency !== 'NGN') {
    console.error(
      `Currency mismatch for payment ${paymentReference}: expected NGN, got ${verifiedData.currency}`
    );
    return {
      success: false,
      status: 'FAILED',
      booking,
      payment,
      error: 'Currency mismatch: only NGN transactions are accepted.',
    };
  }

  if (verifiedData.amount !== booking.totalKobo) {
    console.error(
      `Amount mismatch for payment ${paymentReference}: expected ${booking.totalKobo}, got ${verifiedData.amount}`
    );
    return {
      success: false,
      status: 'FAILED',
      booking,
      payment,
      error: 'Amount mismatch: payment does not match booking total.',
    };
  }

  // 4. Atomic Booking Confirmation & Status Synchronization
  return await prisma.$transaction(async (tx) => {
    // Re-read current booking state inside transaction
    const currentBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: {
        units: { include: { capacityUnit: true } },
      },
    });

    if (!currentBooking) {
      throw new Error(`Booking ${booking.id} missing during confirmation`);
    }

    // Edge Case B: Booking is already CONFIRMED (e.g. duplicate webhook or second payment)
    if (currentBooking.status === 'CONFIRMED') {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'DUPLICATE_SUCCESS',
          paidAt: verifiedData.paid_at ? new Date(verifiedData.paid_at) : new Date(),
          verifiedAt: new Date(),
          channel: verifiedData.channel,
          paystackTransactionId: String(verifiedData.id),
          gatewayResponse: verifiedData.gateway_response,
          verifySummary: verifiedData as any,
        },
      });

      return {
        success: true,
        status: 'DUPLICATE_SUCCESS',
        booking: currentBooking,
        payment: updatedPayment,
      };
    }

    // Edge Case A: Booking is EXPIRED (customer completed payment after hold expired)
    // PRD BR-018: "A verified payment for an EXPIRED booking triggers one attempt to re-reserve the same units.
    // Success confirms the booking. Failure sets NEEDS_ATTENTION."
    if (currentBooking.status === 'EXPIRED') {
      console.warn(
        `Late payment received for EXPIRED booking ${currentBooking.reference}. Attempting to re-reserve units...`
      );

      // Check if all needed capacity units have free capacity (reserved < capacity)
      let canReReserve = true;
      for (const unit of currentBooking.units) {
        const cap = await tx.capacityUnit.findUnique({
          where: { id: unit.capacityUnitId },
        });
        if (!cap || cap.reserved >= cap.capacity) {
          canReReserve = false;
          break;
        }
      }

      if (canReReserve) {
        // Re-reserve capacity
        for (const unit of currentBooking.units) {
          await tx.capacityUnit.update({
            where: { id: unit.capacityUnitId },
            data: { reserved: { increment: 1 } },
          });

          await tx.bookingUnit.update({
            where: { id: unit.id },
            data: { releasedAt: null },
          });
        }

        // Confirm booking
        const updatedBooking = await tx.booking.update({
          where: { id: currentBooking.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: verifiedData.paid_at ? new Date(verifiedData.paid_at) : new Date(),
            verifiedAt: new Date(),
            channel: verifiedData.channel,
            paystackTransactionId: String(verifiedData.id),
            gatewayResponse: verifiedData.gateway_response,
            verifySummary: verifiedData as any,
          },
        });

        return {
          success: true,
          status: 'CONFIRMED',
          booking: updatedBooking,
          payment: updatedPayment,
        };
      } else {
        // Cannot re-reserve: set status to NEEDS_ATTENTION for manager action
        const updatedBooking = await tx.booking.update({
          where: { id: currentBooking.id },
          data: {
            status: 'NEEDS_ATTENTION',
          },
        });

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: verifiedData.paid_at ? new Date(verifiedData.paid_at) : new Date(),
            verifiedAt: new Date(),
            channel: verifiedData.channel,
            paystackTransactionId: String(verifiedData.id),
            gatewayResponse: verifiedData.gateway_response,
            verifySummary: verifiedData as any,
          },
        });

        return {
          success: true,
          status: 'NEEDS_ATTENTION',
          booking: updatedBooking,
          payment: updatedPayment,
          error:
            'We received your payment but could not secure your dates. The front desk will contact you.',
        };
      }
    }

    // Standard Case: PENDING_PAYMENT booking
    if (currentBooking.status === 'PENDING_PAYMENT') {
      const updatedBooking = await tx.booking.update({
        where: { id: currentBooking.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          paidAt: verifiedData.paid_at ? new Date(verifiedData.paid_at) : new Date(),
          verifiedAt: new Date(),
          channel: verifiedData.channel,
          paystackTransactionId: String(verifiedData.id),
          gatewayResponse: verifiedData.gateway_response,
          verifySummary: verifiedData as any,
        },
      });

      return {
        success: true,
        status: 'CONFIRMED',
        booking: updatedBooking,
        payment: updatedPayment,
      };
    }

    throw new Error(
      `Unhandled booking status transition from ${currentBooking.status}`
    );
  });
}

