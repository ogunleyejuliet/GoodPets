import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/pets/[id]
// Returns a single pet record, strictly isolated to the authenticated owner
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser(['CUSTOMER', 'FRONT_DESK', 'MANAGER']);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const pet = await prisma.pet.findFirst({
      where: {
        id: params.id,
        ownerId: user.id,
        archivedAt: null,
      },
    });

    // PRD 11.2 & BR-032: Requests for another customer's record return 404
    if (!pet) {
      return NextResponse.json(
        { success: false, error: 'Pet not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pet: {
        id: pet.id,
        ownerId: pet.ownerId,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        weightKg: pet.weightKg !== null ? Number(pet.weightKg) : null,
        careNotes: pet.careNotes,
        archivedAt: pet.archivedAt?.toISOString() ?? null,
        createdAt: pet.createdAt.toISOString(),
        updatedAt: pet.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
