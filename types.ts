
// MissionStatus for multi-step mission flow
export enum MissionStatus {
  NOT_STARTED = 'NOT_STARTED',
  PURCHASE_PENDING = 'PURCHASE_PENDING',
  PURCHASE_VERIFIED = 'PURCHASE_VERIFIED',
  REVIEW_PENDING = 'REVIEW_PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

// Mission interface used by MissionList, MissionDetail, and AdminDashboard
export interface Mission {
  id: string;
  title: string;
  thumbnail: string;
  rewardAmount: number;
  description: string;
  guideUrl: string;
  steps: string[];
}

// UserSubmission interface used by mission-based components
export interface UserSubmission {
  missionId: string;
  status: MissionStatus;
  submittedAt: number;
  lastUpdatedAt: number;
  userName?: string;
  bankName?: string;
  accountNumber?: string;
  purchaseProofImage?: string;
  reviewProofImage?: string;
}

export interface Product {
  id: string;
  name: string;        // 품목명 (키워드)
  guideText: string;   // 구매 가이드 문구
  reviewGuideText: string; // 후기 가이드 문구
  refundAmount: number; // 환금액
  totalQuota: number;  // 일일 배정 갯수
  remainingQuota: number; // 남은 갯수
  thumbnail?: string;  // 썸네일 이미지 (Base64)
}

export interface Submission {
  id: string;
  productId?: string;
  productName?: string;
  itemNumber?: number;
  date: string;
  kakaoNick: string;
  phoneNumber: string; // 추가: 대조용 전화번호
  ordererName: string;
  orderNumber: string;
  address: string;
  refundAmount: number;
  bankInfo: string;
  proofImage?: string;       // 구매 인증샷 (여러 장일 경우 쉼표로 구분된 URL)
  reviewProofImage?: string; // 추가: 후기 인증샷
  type: 'purchase' | 'review' | 'both'; // 타입 구분
}

export type AppMode = 'customer' | 'admin';
export type CustomerView = 'landing' | 'apply' | 'review';
