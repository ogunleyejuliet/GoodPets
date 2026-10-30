import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Helper to format Prisma Pet record for JSON response
function serializePet(pet: {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  weightKg: Prisma.Decimal | null;
  careNotes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
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
  };
}

// GET /api/pets
// Returns all non-archived pets for the authenticated customer
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const user = await requireUser(['CUSTOMER', 'FRONT_DESK', 'MANAGER']);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const pets = await prisma.pet.findMany({
      where: {
        ownerId: user.id,
        archivedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      pets: pets.map(serializePet),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${timestamp}] GET /api/pets - Status: 500 - ${errorMessage}`);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve pets. Please try again later.' },
      { status: 500 }
    );
  }
}

// POST /api/pets
// Creates a new pet under the authenticated customer's account
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const user = await requireUser(['CUSTOMER', 'FRONT_DESK', 'MANAGER']);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, species, breed, weightKg, careNotes } = body;

    // 1. Validate pet name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pet name is required.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Pet name cannot exceed 50 characters.' },
        { status: 400 }
      );
    }

    // 2. Validate species (PRD Species enum: DOG, CAT)
    const normalizedSpecies = typeof species === 'string' ? species.trim().toUpperCase() : '';
    if (normalizedSpecies !== 'DOG' && normalizedSpecies !== 'CAT') {
      return NextResponse.json(
        { success: false, error: 'Species must be either DOG or CAT.' },
        { status: 400 }
      );
    }

    // 3. Validate breed (optional)
    let trimmedBreed: string | null = null;
    if (breed !== undefined && breed !== null && typeof breed === 'string') {
      const tb = breed.trim();
      if (tb.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Breed cannot exceed 50 characters.' },
          { status: 400 }
        );
      }
      trimmedBreed = tb.length > 0 ? tb : null;
    }

    // 4. Validate weightKg (optional, positive number between 0.1 and 150.0 kg)
    let parsedWeight: number | null = null;
    if (weightKg !== undefined && weightKg !== null && weightKg !== '') {
      const numWeight = Number(weightKg);
      if (isNaN(numWeight) || numWeight <= 0 || numWeight > 150) {
        return NextResponse.json(
          { success: false, error: 'Weight must be a valid positive number up to 150 kg.' },
          { status: 400 }
        );
      }
      // Round to 1 decimal place matching Decimal(4,1)
      parsedWeight = Math.round(numWeight * 10) / 10;
    }

    // 5. Validate care notes (optional)
    let trimmedNotes: string | null = null;
    if (careNotes !== undefined && careNotes !== null && typeof careNotes === 'string') {
      const tn = careNotes.trim();
      if (tn.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Care notes cannot exceed 500 characters.' },
          { status: 400 }
        );
      }
      trimmedNotes = tn.length > 0 ? tn : null;
    }

    // 6. Persist pet in database
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
        name: trimmedName,
        species: normalizedSpecies as 'DOG' | 'CAT',
        breed: trimmedBreed,
        weightKg: parsedWeight !== null ? new Prisma.Decimal(parsedWeight) : null,
        careNotes: trimmedNotes,
      },
    });

    console.log(
      `[${timestamp}] POST /api/pets - Status: 201 - Pet created - ID: ${pet.id} - Name: ${pet.name} - Owner: ${user.id}`
    );

    return NextResponse.json(
      {
        success: true,
        pet: serializePet(pet),
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${timestamp}] POST /api/pets - Status: 500 - ${errorMessage}`);
    return NextResponse.json(
      { success: false, error: 'Failed to save pet profile. Please try again later.' },
      { status: 500 }
    );
  }
}
