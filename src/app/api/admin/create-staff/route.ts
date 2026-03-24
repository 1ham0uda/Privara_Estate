import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';
import type { StaffRole } from '@/src/types';

const allowedStaffRoles = new Set<StaffRole>(['admin', 'consultant', 'quality']);

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 'unauthorized', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return errorResponse('Forbidden', 'forbidden', 403);
    }

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const role = body.role as StaffRole;
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const specialties = typeof body.specialties === 'string' ? body.specialties : '';
    const rawExperienceYears = body.experienceYears;
    const experienceYears = Number(rawExperienceYears ?? 0);

    if (!email || !password || !displayName || !role) {
      return errorResponse('Missing required fields', 'missing-required-fields', 400);
    }

    if (!allowedStaffRoles.has(role)) {
      return errorResponse('Invalid staff role', 'invalid-role', 400);
    }

    if (!Number.isFinite(experienceYears) || experienceYears < 0) {
      return errorResponse('Invalid experience years', 'invalid-experience', 400);
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
      });
    } catch (authError: any) {
      console.error('Error creating auth user:', authError);
      return errorResponse(authError.message, authError.code || 'auth-create-failed', 400);
    }

    try {
      const batch = adminDb.batch();
      const userRef = adminDb.collection('users').doc(userRecord.uid);

      batch.set(userRef, {
        uid: userRecord.uid,
        email,
        displayName,
        role,
        phoneNumber,
        experienceYears,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalConsultations: 0,
        activeConsultations: 0,
        completedConsultations: 0,
      });

      if (role === 'consultant') {
        const consultantProfileRef = adminDb.collection('consultantProfiles').doc(userRecord.uid);
        const specialtiesList = specialties
          ? specialties.split(',').map((specialty: string) => specialty.trim()).filter(Boolean)
          : [];

        batch.set(consultantProfileRef, {
          uid: userRecord.uid,
          name: displayName,
          specialties: specialtiesList,
          bio,
          experienceYears,
          rating: 0,
          completedConsultations: 0,
          professionalSummary: bio,
          status: 'active',
        });
      }

      await batch.commit();
    } catch (firestoreError: any) {
      console.error('Error creating Firestore profile, rolling back Auth user:', firestoreError);
      try {
        await adminAuth.deleteUser(userRecord.uid);
      } catch (rollbackError) {
        console.error('CRITICAL: Failed to rollback Auth user after Firestore error:', rollbackError);
      }
      return errorResponse('Failed to create user profile. User creation rolled back.', 'profile-create-failed', 500);
    }

    return NextResponse.json({ uid: userRecord.uid, role }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return errorResponse(error.message || 'Unexpected server error', 'server-error', 500);
  }
}
