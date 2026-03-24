import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminAuth, getAdminDb } from '@/src/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, password, displayName, role, specialties, bio, phoneNumber, experienceYears } = await req.json();

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
      });
    } catch (authError: any) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    try {
      await adminDb.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role,
        phoneNumber: phoneNumber || '',
        experienceYears: experienceYears ? parseInt(experienceYears, 10) : 0,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalConsultations: 0,
        activeConsultations: 0,
        completedConsultations: 0,
      });

      if (role === 'consultant') {
        await adminDb.collection('consultantProfiles').doc(userRecord.uid).set({
          uid: userRecord.uid,
          name: displayName,
          specialties: specialties ? specialties.split(',').map((s: string) => s.trim()) : [],
          bio: bio || '',
          experienceYears: experienceYears ? parseInt(experienceYears, 10) : 0,
          rating: 5,
          completedConsultations: 0,
          professionalSummary: bio || '',
        });
      }
    } catch (firestoreError: any) {
      console.error('Error creating Firestore profile, rolling back Auth user:', firestoreError);
      try {
        await adminAuth.deleteUser(userRecord.uid);
      } catch (rollbackError) {
        console.error('CRITICAL: Failed to rollback Auth user after Firestore error:', rollbackError);
      }
      return NextResponse.json({ error: 'Failed to create user profile. User creation rolled back.' }, { status: 500 });
    }

    return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
