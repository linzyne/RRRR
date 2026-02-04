/**
 * Firestore 데이터베이스 서비스
 * 
 * Products(품목)와 Submissions(신청/후기) 컬렉션에 대한 CRUD 작업을 제공합니다.
 */

import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Submission, GlobalSettings } from '../types';

// 컬렉션 참조
const productsCollection = collection(db, 'products');
const submissionsCollection = collection(db, 'submissions');
const settingsCollection = collection(db, 'settings');

// ==================== Global Settings (전역 설정) ====================

/**
 * 전역 설정 실시간 구독
 */
export const subscribeToGlobalSettings = (callback: (settings: GlobalSettings) => void) => {
    const docRef = doc(db, 'settings', 'review_guide');
    return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data() as GlobalSettings);
        } else {
            // 기본값 제공
            callback({ reviewGuideText: '' });
        }
    }, (error) => {
        console.error('Global Settings 구독 에러:', error);
    });
};

/**
 * 전역 설정 수정
 */
export const updateGlobalSettings = async (updates: Partial<GlobalSettings>): Promise<void> => {
    const docRef = doc(db, 'settings', 'review_guide');
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    }).catch(async (error) => {
        // 문서가 없으면 만듦
        if (error.code === 'not-found') {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(docRef, {
                ...updates,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            throw error;
        }
    });
};

// ==================== Products (품목) ====================

/**
 * 모든 품목 조회
 */
export const getProducts = async (): Promise<Product[]> => {
    const snapshot = await getDocs(query(productsCollection, orderBy('createdAt', 'desc')));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Product));
};

/**
 * 품목 실시간 구독
 * @param callback 데이터 변경 시 호출될 콜백 함수
 * @returns 구독 해제 함수
 */
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
    // createdAt 필드가 없는 문서도 처리하기 위해 기본 쿼리 사용
    return onSnapshot(productsCollection, (snapshot) => {
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Product));
        // 클라이언트에서 정렬 (createdAt이 없을 수도 있음)
        products.sort((a, b) => {
            const aTime = (a as any).createdAt?.toMillis?.() || 0;
            const bTime = (b as any).createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        callback(products);
    }, (error) => {
        console.error('Products 구독 에러:', error);
        callback([]);
    });
};

/**
 * 새 품목 추가
 */
export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
    const docRef = await addDoc(productsCollection, {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * 품목 수정
 */
export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * 품목 삭제
 */
export const deleteProduct = async (id: string): Promise<void> => {
    const docRef = doc(db, 'products', id);
    await deleteDoc(docRef);
};

// ==================== Submissions (신청/후기) ====================

/**
 * 모든 신청/후기 조회
 */
export const getSubmissions = async (): Promise<Submission[]> => {
    const snapshot = await getDocs(query(submissionsCollection, orderBy('createdAt', 'desc')));
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Submission));
};

/**
 * 신청/후기 실시간 구독
 * @param callback 데이터 변경 시 호출될 콜백 함수
 * @returns 구독 해제 함수
 */
export const subscribeToSubmissions = (callback: (submissions: Submission[]) => void) => {
    // createdAt 필드가 없는 문서도 처리하기 위해 기본 쿼리 사용
    return onSnapshot(submissionsCollection, (snapshot) => {
        const submissions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Submission));
        // 클라이언트에서 정렬
        submissions.sort((a, b) => {
            const aTime = (a as any).createdAt?.toMillis?.() || 0;
            const bTime = (b as any).createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });
        callback(submissions);
    }, (error) => {
        console.error('Submissions 구독 에러:', error);
        callback([]);
    });
};

/**
 * 새 신청 추가
 */
export const addSubmission = async (submission: Omit<Submission, 'id'>): Promise<string> => {
    const docRef = await addDoc(submissionsCollection, {
        ...submission,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * 신청/후기 수정
 */
export const updateSubmission = async (id: string, updates: Partial<Submission>): Promise<void> => {
    const docRef = doc(db, 'submissions', id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * 신청/후기 삭제
 */
export const deleteSubmission = async (id: string): Promise<void> => {
    const docRef = doc(db, 'submissions', id);
    await deleteDoc(docRef);
};

/**
 * 닉네임과 전화번호로 기존 신청 찾기 (후기 등록 시 사용)
 */
export const findSubmissionByUserInfo = async (kakaoNick: string, phoneNumber: string): Promise<Submission | null> => {
    const submissions = await getSubmissions();
    const found = submissions.find(s =>
        s.kakaoNick.trim() === kakaoNick.trim() &&
        s.phoneNumber.trim() === phoneNumber.trim()
    );
    return found || null;
};
