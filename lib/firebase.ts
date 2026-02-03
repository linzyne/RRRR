/**
 * Firebase 초기화 및 서비스 설정
 * 
 * 이 파일은 Firebase 앱을 초기화하고 Firestore, Auth, Storage 서비스를 export합니다.
 * 환경변수에서 Firebase 설정값을 로드합니다.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase 설정 객체
// Vite에서는 import.meta.env를 사용하여 환경변수에 접근합니다
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore 데이터베이스 인스턴스
export const db = getFirestore(app);

// Firebase Authentication 인스턴스
export const auth = getAuth(app);

// Firebase Storage 인스턴스
export const storage = getStorage(app);

export default app;
