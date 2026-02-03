/**
 * Firebase Storage 서비스
 * 
 * 이미지 업로드 및 URL 관리를 담당합니다.
 * Base64 이미지를 Firebase Storage에 업로드하고 다운로드 URL을 반환합니다.
 */

import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Base64 이미지를 Firebase Storage에 업로드
 * 
 * @param base64Image Base64 인코딩된 이미지 문자열 (data:image/...;base64,... 형식)
 * @param folder 저장할 폴더명 ('thumbnails' | 'proofImages' | 'reviewImages')
 * @param fileName 파일명 (확장자 제외, 기본값: 타임스탬프)
 * @returns 업로드된 이미지의 다운로드 URL
 */
export const uploadImage = async (
    base64Image: string,
    folder: 'thumbnails' | 'proofImages' | 'reviewImages',
    fileName?: string
): Promise<string> => {
    // 파일명 생성 (지정되지 않은 경우 타임스탬프 사용)
    const name = fileName || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // MIME 타입 추출
    const mimeMatch = base64Image.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    // 확장자 결정
    const extension = mimeType.split('/')[1] || 'jpg';

    // Storage 참조 생성
    const storageRef = ref(storage, `${folder}/${name}.${extension}`);

    // Base64 데이터만 추출 (data:image/...;base64, 부분 제거)
    const base64Data = base64Image.includes(',')
        ? base64Image.split(',')[1]
        : base64Image;

    // 업로드 실행
    await uploadString(storageRef, base64Data, 'base64', {
        contentType: mimeType
    });

    // 다운로드 URL 반환
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

/**
 * 썸네일 이미지 업로드
 */
export const uploadThumbnail = async (base64Image: string): Promise<string> => {
    return uploadImage(base64Image, 'thumbnails');
};

/**
 * 구매 인증 이미지 업로드
 */
export const uploadProofImage = async (base64Image: string): Promise<string> => {
    return uploadImage(base64Image, 'proofImages');
};

/**
 * 후기 인증 이미지 업로드
 */
export const uploadReviewImage = async (base64Image: string): Promise<string> => {
    return uploadImage(base64Image, 'reviewImages');
};
