
import React, { useState, useEffect, useRef } from 'react';
import { Product, Submission, AppMode, CustomerView, GlobalSettings } from './types';
import {
  subscribeToProducts,
  subscribeToSubmissions,
  subscribeToGlobalSettings,
  updateGlobalSettings,
  addProduct,
  updateProduct,
  deleteProduct,
  addSubmission,
  updateSubmission,
  deleteSubmission,
  findSubmissionByUserInfo
} from './services/firestoreService';
import { uploadThumbnail, uploadProofImage, uploadReviewImage } from './services/storageService';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('customer');
  const [customerView, setCustomerView] = useState<CustomerView>('landing');

  // Admin Authentication
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminLoginError, setShowAdminLoginError] = useState(false);

  // Firebase에서 실시간으로 데이터 로드
  const [products, setProducts] = useState<Product[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ reviewGuideText: '' });
  const [isLoading, setIsLoading] = useState(true);

  // UI States
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSubmittedType, setLastSubmittedType] = useState<'apply' | 'review' | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null); // 이미지 미리보기 모달
  const [adminTab, setAdminTab] = useState<'purchase' | 'review'>('purchase'); // 관리자 탭 (신청/후기)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Admin states
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', guideText: '', refundAmount: 0, totalQuota: 10, thumbnail: ''
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(''); // 로컬 미리보기용

  // Customer states
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    kakaoNick: '', phoneNumber: '', bankName: '', accountHolder: '', accountNumber: '', proofImages: [] as string[]
  });
  const [reviewForm, setReviewForm] = useState({
    kakaoNick: '', phoneNumber: '', bankName: '', accountHolder: '', accountNumber: '', reviewImages: [] as string[]
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Firebase 실시간 구독
  useEffect(() => {
    setIsLoading(true);

    // Products 구독
    const unsubProducts = subscribeToProducts((data) => {
      setProducts(data);
      setIsLoading(false);
    });

    // Submissions 구독
    const unsubSubmissions = subscribeToSubmissions((data) => {
      setSubmissions(data);
    });

    // Global Settings 구독
    const unsubSettings = subscribeToGlobalSettings((data) => {
      setGlobalSettings(data);
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubProducts();
      unsubSubmissions();
      unsubSettings();
    };
  }, []);

  // 탭 변경 시 선택 해제
  useEffect(() => {
    setSelectedIds([]);
  }, [adminTab]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Firebase Auth로 대체 가능 (현재는 간단한 비밀번호 인증)
    if (adminPassword === '1234') {
      setIsAdminAuthenticated(true);
      setShowAdminLoginError(false);
    } else {
      setShowAdminLoginError(true);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setThumbnailPreview(base64); // 로컬 미리보기
      setNewProduct({ ...newProduct, thumbnail: base64 });
    };
    reader.readAsDataURL(file);
  };

  const saveProduct = async () => {
    if (!newProduct.name) {
      alert("품목명을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 썸네일 이미지가 있으면 Storage에 업로드
      let thumbnailUrl = newProduct.thumbnail || '';
      if (newProduct.thumbnail && newProduct.thumbnail.startsWith('data:')) {
        thumbnailUrl = await uploadThumbnail(newProduct.thumbnail);
      }

      if (editingProductId) {
        // 기존 품목 수정
        await updateProduct(editingProductId, {
          name: newProduct.name!,
          guideText: newProduct.guideText || '',
          refundAmount: newProduct.refundAmount || 0,
          totalQuota: newProduct.totalQuota || 0,
          remainingQuota: newProduct.totalQuota || 0,
          thumbnail: thumbnailUrl
        });
        alert("품목 정보가 수정되었습니다.");
        setEditingProductId(null);
      } else {
        // 새 품목 추가
        await addProduct({
          name: newProduct.name,
          guideText: newProduct.guideText || '',
          refundAmount: newProduct.refundAmount || 0,
          totalQuota: newProduct.totalQuota || 10,
          remainingQuota: newProduct.totalQuota || 10,
          thumbnail: thumbnailUrl
        });
        alert("품목이 등록되었습니다.");
      }

      setNewProduct({ name: '', guideText: '', refundAmount: 0, totalQuota: 10, thumbnail: '' });
      setThumbnailPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('품목 저장 실패:', error);
      alert('품목 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      guideText: product.guideText,
      refundAmount: product.refundAmount,
      totalQuota: product.totalQuota,
      thumbnail: product.thumbnail
    });
    setThumbnailPreview(product.thumbnail || '');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setNewProduct({ name: '', guideText: '', refundAmount: 0, totalQuota: 10, thumbnail: '' });
    setThumbnailPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 구매 인증샷 업로드 핸들러 (다중 이미지 지원)
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    setIsSubmitting(true);
    const files = Array.from(e.target.files) as File[];
    const newImages: string[] = [];

    for (const file of files) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onloadend = () => {
          newImages.push(reader.result as string);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setCustomerForm({
      ...customerForm,
      proofImages: [...customerForm.proofImages, ...newImages]
    });
    setIsSubmitting(false);
    // input 초기화 (같은 파일 다시 선택 가능하도록)
    e.target.value = '';
  };

  // 특정 인증샷 삭제
  const removeProofImage = (index: number) => {
    setCustomerForm({
      ...customerForm,
      proofImages: customerForm.proofImages.filter((_, i) => i !== index)
    });
  };

  const handleApplyFinalSubmit = async () => {
    if (!selectedProductId || customerForm.proofImages.length === 0) return;
    if (!customerForm.kakaoNick || !customerForm.phoneNumber) {
      alert("정보를 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const product = products.find(p => p.id === selectedProductId);
      const today = new Date();

      // 모든 이미지를 Firebase Storage에 업로드하고 URL들을 쉼표로 연결
      const uploadPromises = customerForm.proofImages.map(img => uploadProofImage(img));
      const proofImageUrls = await Promise.all(uploadPromises);
      const combinedProofImageUrl = proofImageUrls.join(',');

      // Firestore에 신청 데이터 저장
      const newId = await addSubmission({
        productId: product?.id,
        productName: product?.name,
        date: `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`,
        kakaoNick: customerForm.kakaoNick,
        phoneNumber: customerForm.phoneNumber,
        ordererName: "",
        orderNumber: "",
        address: "",
        refundAmount: product?.refundAmount || 0,
        bankInfo: `${customerForm.bankName}/${customerForm.accountNumber}/${customerForm.accountHolder}`,
        proofImage: combinedProofImageUrl,
        type: 'purchase'
      });

      // 품목 잔여 수량 감소

      // 품목 잔여 수량 감소
      if (product) {
        await updateProduct(product.id, {
          remainingQuota: product.remainingQuota - 1
        });
      }

      setLastSubmittedType('apply');
      setShowSuccess(true);
    } catch (error) {
      console.error('신청 제출 실패:', error);
      alert('신청 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 후기 이미지 업로드 핸들러 (특정 인덱스 지정)
  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    if (!e.target.files?.[0]) return;
    if (!reviewForm.kakaoNick || !reviewForm.phoneNumber) {
      alert("카톡 닉네임과 전화번호를 먼저 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64 = reader.result as string;
      const updatedImages = [...reviewForm.reviewImages];
      updatedImages[slotIndex] = base64; // 해당 슬롯에 이미지 저장

      setReviewForm({
        ...reviewForm,
        reviewImages: updatedImages
      });
      setIsSubmitting(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 특정 후기 인증샷 삭제
  const removeReviewImage = (index: number) => {
    setReviewForm({
      ...reviewForm,
      reviewImages: reviewForm.reviewImages.filter((_, i) => i !== index)
    });
  };

  // 후기 최종 제출 핸들러 (2단계)
  const handleReviewFinalSubmit = async () => {
    if (reviewForm.reviewImages.filter(img => !!img).length < 2) {
      alert("주문서 캡처와 후기 캡처 2장을 모두 업로드해주세요.");
      return;
    }
    if (!reviewForm.kakaoNick || !reviewForm.phoneNumber) {
      alert("카톡 닉네임과 전화번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date();

      // 모든 사진 업로드 및 URL 통합
      const uploadPromises = reviewForm.reviewImages.map(img => uploadReviewImage(img));
      const reviewImageUrls = await Promise.all(uploadPromises);
      const combinedReviewImageUrl = reviewImageUrls.join(',');

      // 기존 신청 데이터 찾기
      const existingSub = await findSubmissionByUserInfo(reviewForm.kakaoNick, reviewForm.phoneNumber);

      if (existingSub) {
        // 기존 신청에 후기 정보 추가
        await updateSubmission(existingSub.id, {
          reviewProofImage: combinedReviewImageUrl,
          bankInfo: `${reviewForm.bankName}/${reviewForm.accountNumber}/${reviewForm.accountHolder}`,
          type: existingSub.type === 'purchase' ? 'both' : existingSub.type
        });



      } else {
        // 새 후기 전용 신청 생성
        const newId = await addSubmission({
          date: `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`,
          kakaoNick: reviewForm.kakaoNick,
          phoneNumber: reviewForm.phoneNumber,
          ordererName: "",
          orderNumber: "",
          address: "",
          refundAmount: 0,
          bankInfo: `${reviewForm.bankName}/${reviewForm.accountNumber}/${reviewForm.accountHolder}`,
          reviewProofImage: combinedReviewImageUrl,
          type: 'review'
        });


      }

      setLastSubmittedType('review');
      setShowSuccess(true);
    } catch (error) {
      console.error('후기 제출 실패:', error);
      alert('후기 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCustomerFlow = () => {
    setShowSuccess(false);
    setLastSubmittedType(null);
    setCustomerView('landing');
    setSelectedProductId(null);
    setCustomerForm({ kakaoNick: '', phoneNumber: '', bankName: '', accountHolder: '', accountNumber: '', proofImages: [] });
    setReviewForm({ kakaoNick: '', phoneNumber: '', bankName: '', accountHolder: '', accountNumber: '', reviewImages: [] });
  };

  const handleSaveGlobalReviewGuide = async (text: string) => {
    setIsSubmitting(true);
    try {
      await updateGlobalSettings({ reviewGuideText: text });
      alert("공통 후기 가이드가 저장되었습니다.");
    } catch (error) {
      console.error("가이드 저장 실패:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };


  // 엑셀 다운로드 (CSV 가상 생성)
  const downloadExcel = (filterType: 'purchase' | 'review') => {
    let baseList = submissions.filter(s =>
      filterType === 'purchase' ? (s.type === 'purchase' || s.type === 'both') : (s.type === 'review' || s.type === 'both')
    );

    // 선택된 항목이 있으면 선택된 것만, 없으면 전체 다운로드
    const filteredSubmissions = selectedIds.length > 0
      ? baseList.filter(s => selectedIds.includes(s.id))
      : baseList;

    if (filteredSubmissions.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // 날짜순 정렬 (내림차순)
    filteredSubmissions.sort((a, b) => b.date.localeCompare(a.date));
    if (filterType === 'purchase') {
      // 신청목록 양식: 순번, 품목명, 날짜, 카톡닉네임, 주문자명, 주문번호, 주소, 전화번호, 환금액, 비상연락망, 입금정보
      const headers = ["순번", "품목명", "날짜", "카톡닉네임", "주문자명", "주문번호", "주소", "전화번호", "환금액", "비상연락망", "입금정보"];
      const rows = filteredSubmissions.map((s, index) => {
        const bankParts = s.bankInfo ? s.bankInfo.split('/') : ['', '', ''];
        const bankInfoFormatted = bankParts.join(' ').trim();
        return [
          index + 1,                    // 순번
          s.productName || '알수없음',   // 품목명
          s.date,                       // 날짜
          s.kakaoNick,                  // 카톡닉네임
          s.ordererName || '',          // 주문자명
          s.orderNumber || '',          // 주문번호
          '',                           // 주소 (빈칸 유지)
          '',                           // 전화번호 (빈칸 유지)
          s.refundAmount,               // 환금액
          s.phoneNumber || '',          // 비상연락망
          `"${bankInfoFormatted}"`      // 입금정보
        ];
      });

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `신청_내역_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      // 후기목록 양식: 카톡닉네임, 주문번호
      const headers = ["카톡닉네임", "주문번호"];
      const rows = filteredSubmissions.map(s => {
        return [
          s.kakaoNick,                  // 카톡닉네임
          s.orderNumber || ''           // 주문번호
        ];
      });

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `후기_내역_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  };

  const removeProduct = async (id: string) => {
    if (window.confirm("정말로 이 품목을 삭제하시겠습니까?")) {
      try {
        await deleteProduct(id);
        if (editingProductId === id) cancelEdit();
      } catch (error) {
        console.error('품목 삭제 실패:', error);
        alert('품목 삭제에 실패했습니다.');
      }
    }
  };

  // 선택된 제출 내역 삭제
  const handleDeleteSelectedSubmissions = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.length}개의 내역을 정말로 삭제하시겠습니까?`)) return;

    setIsSubmitting(true);
    try {
      await Promise.all(selectedIds.map(id => deleteSubmission(id)));
      setSelectedIds([]);
      alert("삭제되었습니다.");
    } catch (error) {
      console.error('삭제 실패:', error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 행 선택 핸들러
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 전체 선택 핸들러
  const handleSelectAll = (tab: 'purchase' | 'review') => {
    const currentSubmissions = submissions.filter(s =>
      tab === 'purchase' ? (s.type === 'purchase' || s.type === 'both') : (s.type === 'review' || s.type === 'both')
    );

    if (selectedIds.length === currentSubmissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentSubmissions.map(s => s.id));
    }
  };

  // 날짜별 그룹 선택 핸들러
  const handleSelectDateGroup = (items: Submission[]) => {
    const itemIds = items.map(s => s.id);
    const allSelected = itemIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      // 해당 날짜 항목 모두 해제
      setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      // 해당 날짜 항목 중 미선택 항목만 추가
      const newIds = itemIds.filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...newIds]);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetCustomerFlow}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">M</div>
            <span className="font-black text-xl tracking-tighter uppercase">미션 허브</span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => { setMode('customer'); setCustomerView('landing'); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'customer' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>체험단 모드</button>
            <button onClick={() => setMode('admin')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'admin' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>관리자 모드</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {mode === 'admin' ? (
          !isAdminAuthenticated ? (
            <div className="flex items-center justify-center pt-20 animate-in fade-in zoom-in duration-300">
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                  <div className="text-4xl">🔐</div>
                  <h2 className="text-2xl font-black">관리자 로그인</h2>
                  <p className="text-gray-400 font-bold text-sm">비밀번호를 입력하여 접속하세요.</p>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <input
                    type="password"
                    placeholder="비밀번호"
                    className={`w-full p-4 bg-gray-50 rounded-2xl font-bold border-2 outline-none transition-all ${showAdminLoginError ? 'border-red-500 bg-red-50' : 'border-transparent focus:border-blue-600'}`}
                    value={adminPassword}
                    onChange={(e) => { setAdminPassword(e.target.value); setShowAdminLoginError(false); }}
                  />
                  {showAdminLoginError && <p className="text-red-500 text-xs font-bold text-center">비밀번호가 올바르지 않습니다.</p>}
                  <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100">접속하기</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <section ref={formRef} className={`bg-white p-8 rounded-[32px] border transition-all duration-300 ${editingProductId ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-200 shadow-sm'} space-y-6`}>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black">{editingProductId ? '품목 정보 수정' : '품목 관리 (미션 등록)'}</h2>
                  <button onClick={() => setIsAdminAuthenticated(false)} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">로그아웃</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  <div className="md:col-span-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">썸네일 이미지</p>
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="thumb-upload"
                        onChange={handleThumbnailChange}
                        ref={fileInputRef}
                      />
                      <label htmlFor="thumb-upload" className="block w-full aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all overflow-hidden">
                        {thumbnailPreview || newProduct.thumbnail ? (
                          <img src={thumbnailPreview || newProduct.thumbnail} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <>
                            <span className="text-3xl mb-1">🖼️</span>
                            <span className="text-[10px] font-black text-gray-400">이미지 선택</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-9 h-full">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">구매 미션 가이드 문구</p>
                    <textarea
                      placeholder="신청 시 고객이 참고할 가이드 문구를 입력하세요."
                      className="w-full h-32 md:h-40 p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-blue-600 outline-none resize-none text-sm leading-relaxed"
                      value={newProduct.guideText}
                      onChange={e => setNewProduct({ ...newProduct, guideText: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-4 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">상품명</label>
                      <input type="text" placeholder="품목명 (필수)" className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-blue-600 outline-none" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">환급액</label>
                        <input type="number" placeholder="환급액" className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-blue-600 outline-none text-blue-600" value={newProduct.refundAmount || ''} onChange={e => setNewProduct({ ...newProduct, refundAmount: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">수량</label>
                        <input type="number" placeholder="수량" className="w-full p-4 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-blue-600 outline-none" value={newProduct.totalQuota || ''} onChange={e => setNewProduct({ ...newProduct, totalQuota: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <button onClick={saveProduct} disabled={isSubmitting} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            저장 중...
                          </div>
                        ) : editingProductId ? '수정 내용 저장' : '품목 등록하기'}
                      </button>
                      {editingProductId && (
                        <button onClick={cancelEdit} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm">수정 취소</button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">현재 등록된 품목 ({products.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {products.map(p => (
                      <div key={p.id} className={`p-4 rounded-2xl flex items-center gap-4 border transition-all group relative ${editingProductId === p.id ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-md'}`}>
                        <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border">
                          {p.thumbnail ? <img src={p.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                        </div>
                        <div className="flex-grow">
                          <div className="font-black text-sm text-gray-800 line-clamp-1">{p.name}</div>
                          <div className="text-xs text-blue-600 font-bold">{p.refundAmount.toLocaleString()}원</div>
                          <div className="text-[10px] text-gray-400">잔여: {p.remainingQuota} / {p.totalQuota}</div>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => startEdit(p)} className="p-1 bg-white border rounded shadow-sm text-blue-500 hover:bg-blue-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button onClick={() => removeProduct(p.id)} className="p-1 bg-white border rounded shadow-sm text-red-400 hover:bg-red-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejout="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 전역 후기 가이드 설정 섹션 */}
              <section className="bg-white p-8 rounded-[32px] border border-orange-200 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📢</span>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">공통 후기 가이드 설정</h2>
                    <p className="text-xs font-bold text-gray-400 italic">후기 인증 화면 상단에 항상 표시되는 안내 문구입니다.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <textarea
                    placeholder="후기 작성 시 공통으로 안내할 내용을 입력해 주세요."
                    className="w-full h-32 p-4 bg-orange-50 rounded-xl font-bold border-2 border-transparent focus:border-orange-500 outline-none resize-none text-sm leading-relaxed text-orange-900"
                    defaultValue={globalSettings.reviewGuideText}
                    onBlur={(e) => handleSaveGlobalReviewGuide(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <p className="text-[10px] font-black text-orange-300 uppercase tracking-widest italic">* 입력 후 입력창 밖을 클릭하면 자동 저장됩니다.</p>
                  </div>
                </div>
              </section>

              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <h3 className="text-2xl font-black">신청 및 후기 전체 현황</h3>
                  {/* 탭 버튼 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdminTab('purchase')}
                      className={`px-5 py-3 rounded-xl font-black text-sm transition-all ${adminTab === 'purchase' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      🛍️ 신청 목록
                    </button>
                    <button
                      onClick={() => setAdminTab('review')}
                      className={`px-5 py-3 rounded-xl font-black text-sm transition-all ${adminTab === 'review' ? 'bg-orange-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      ⭐ 후기 목록
                    </button>
                  </div>
                </div>

                {/* 다운로드 및 관리 도구 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500 ml-2">선택된 항목: <span className="text-gray-900">{selectedIds.length}개</span></span>
                    {selectedIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelectedSubmissions}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs hover:bg-red-100 transition-all flex items-center gap-1"
                      >
                        🗑️ 선택 삭제
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => downloadExcel(adminTab)}
                    className={`px-5 py-3 text-white rounded-xl font-black text-sm hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 ${adminTab === 'purchase' ? 'bg-indigo-600' : 'bg-orange-600'}`}
                  >
                    📥 {selectedIds.length > 0 ? '선택 항목' : (adminTab === 'purchase' ? '신청' : '후기')} 내역 엑셀 다운로드
                  </button>
                </div>

                {/* 신청 목록 테이블 */}
                {adminTab === 'purchase' && (
                  <div className="bg-white rounded-[32px] border overflow-x-auto shadow-sm">
                    <table className="w-full text-left min-w-[1000px]">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                        <tr>
                          <th className="px-4 py-4 text-center w-12">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={submissions.filter(s => s.type === 'purchase' || s.type === 'both').length > 0 && selectedIds.length === submissions.filter(s => s.type === 'purchase' || s.type === 'both').length}
                              onChange={() => handleSelectAll('purchase')}
                            />
                          </th>
                          <th className="px-4 py-4 text-center w-12">순번</th>
                          <th className="px-4 py-4 w-32">날짜</th>
                          <th className="px-4 py-4">품목명</th>
                          <th className="px-4 py-4">카톡닉네임</th>
                          <th className="px-4 py-4">주문번호</th>
                          <th className="px-4 py-4 text-right">환금액</th>
                          <th className="px-4 py-4 text-center">인증샷</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const filtered = submissions
                            .filter(s => s.type === 'purchase' || s.type === 'both')
                            .sort((a, b) => b.date.localeCompare(a.date));

                          if (filtered.length === 0) {
                            return <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-300 font-bold">아직 신청 데이터가 없습니다.</td></tr>;
                          }

                          // 날짜별 그룹화
                          const grouped: Record<string, Submission[]> = filtered.reduce((acc, current) => {
                            if (!acc[current.date]) acc[current.date] = [];
                            acc[current.date].push(current);
                            return acc;
                          }, {} as Record<string, Submission[]>);

                          const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
                          let globalIndex = 0;

                          return sortedDates.map(date => {
                            const items = grouped[date];
                            return (
                              <React.Fragment key={date}>
                                {/* 날짜 헤더 */}
                                <tr className="bg-gray-50 border-y border-gray-100 italic">
                                  <td className="px-4 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                      checked={items.every(item => selectedIds.includes(item.id))}
                                      onChange={() => handleSelectDateGroup(items)}
                                    />
                                  </td>
                                  <td colSpan={6} className="px-4 py-2">
                                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">{date}</span>
                                  </td>
                                </tr>
                                {/* 내역 항목 */}
                                {items.map(s => {
                                  const currentIndex = globalIndex++;
                                  return (
                                    <tr key={s.id} className={`text-sm transition-colors ${selectedIds.includes(s.id) ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                      <td className="px-4 py-4 text-center">
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                          checked={selectedIds.includes(s.id)}
                                          onChange={() => handleSelectRow(s.id)}
                                        />
                                      </td>
                                      <td className="px-4 py-4 text-center font-bold text-gray-400">{currentIndex + 1}</td>
                                      <td className="px-4 py-4 text-gray-600 text-xs font-bold">{s.date}</td>
                                      <td className="px-4 py-4 font-bold text-gray-800 max-w-[120px] truncate">{s.productName || '-'}</td>
                                      <td className="px-4 py-4 font-bold text-gray-800">{s.kakaoNick}</td>
                                      <td className="px-4 py-4 text-gray-600 text-xs">
                                        <input
                                          type="text"
                                          className="w-full bg-transparent border-b border-transparent focus:border-indigo-600 focus:bg-white outline-none font-medium text-gray-600 px-1 transition-all"
                                          value={s.orderNumber || ''}
                                          placeholder="주문번호 입력"
                                          onChange={(e) => updateSubmission(s.id, { orderNumber: e.target.value })}
                                        />
                                      </td>
                                      <td className="px-4 py-4 text-right font-black text-blue-600">{s.refundAmount?.toLocaleString() || 0}원</td>
                                      <td className="px-4 py-4 text-center">
                                        {s.proofImage ? (
                                          <div className="flex flex-wrap justify-center gap-1">
                                            {s.proofImage.split(',').map((url, idx) => (
                                              <button
                                                key={idx}
                                                onClick={() => setPreviewImage(url)}
                                                className="w-8 h-8 rounded border border-indigo-200 hover:border-indigo-500 transition-all hover:scale-110 overflow-hidden shadow-sm"
                                              >
                                                <img src={url} className="w-full h-full object-cover" alt={`구매인증 ${idx + 1}`} />
                                              </button>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-300 text-xs">없음</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* 날짜별 총계 (하단) */}
                                <tr className="bg-indigo-50/30 border-b border-indigo-100/50">
                                  <td colSpan={10} className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{date} 일일 총계:</span>
                                      <span className="text-sm font-black text-indigo-600">{items.length}건</span>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {adminTab === 'review' && (
                  <div className="bg-white rounded-[32px] border overflow-x-auto shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                        <tr>
                          <th className="px-6 py-4 w-12 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              checked={submissions.filter(s => s.type === 'review' || s.type === 'both').length > 0 && selectedIds.length === submissions.filter(s => s.type === 'review' || s.type === 'both').length}
                              onChange={() => handleSelectAll('review')}
                            />
                          </th>
                          <th className="px-4 py-4 w-32">날짜</th>
                          <th className="px-6 py-4">카톡닉네임</th>
                          <th className="px-6 py-4">주문번호 (수정가능)</th>
                          <th className="px-6 py-4 text-center">업로드한 사진들</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(() => {
                          const filtered = submissions
                            .filter(s => s.type === 'review' || s.type === 'both')
                            .sort((a, b) => b.date.localeCompare(a.date));

                          if (filtered.length === 0) {
                            return <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-300 font-bold">아직 후기 데이터가 없습니다.</td></tr>;
                          }

                          // 날짜별 그룹화
                          const grouped: Record<string, Submission[]> = filtered.reduce((acc, current) => {
                            if (!acc[current.date]) acc[current.date] = [];
                            acc[current.date].push(current);
                            return acc;
                          }, {} as Record<string, Submission[]>);

                          const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                          return sortedDates.map(date => {
                            const items = grouped[date];
                            return (
                              <React.Fragment key={`review-group-${date}`}>
                                {/* 날짜 헤더 */}
                                <tr className="bg-gray-50 border-y border-gray-100 italic">
                                  <td className="px-6 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                      checked={items.every(item => selectedIds.includes(item.id))}
                                      onChange={() => handleSelectDateGroup(items)}
                                    />
                                  </td>
                                  <td colSpan={4} className="px-6 py-2">
                                    <span className="text-[10px] font-black bg-orange-600 text-white px-2 py-0.5 rounded-full">{date}</span>
                                  </td>
                                </tr>
                                {/* 내역 항목 */}
                                {items.map(s => (
                                  <tr key={s.id} className={`text-sm transition-colors ${selectedIds.includes(s.id) ? 'bg-orange-50/50 hover:bg-orange-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4 text-center">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                        checked={selectedIds.includes(s.id)}
                                        onChange={() => handleSelectRow(s.id)}
                                      />
                                    </td>
                                    <td className="px-4 py-4 text-gray-600 text-xs font-bold">{s.date}</td>
                                    <td className="px-6 py-4 font-bold text-gray-800">{s.kakaoNick}</td>
                                    <td className="px-6 py-4">
                                      <input
                                        type="text"
                                        className="w-full bg-transparent border-b border-transparent focus:border-orange-500 focus:bg-white outline-none font-medium text-gray-600 px-1 transition-all"
                                        value={s.orderNumber || ''}
                                        placeholder="주문번호 입력"
                                        onChange={(e) => updateSubmission(s.id, { orderNumber: e.target.value })}
                                      />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {s.proofImage?.split(',').map((url, idx) => (
                                          <div key={`proof-${idx}`} className="flex flex-col items-center gap-1">
                                            <button
                                              onClick={() => setPreviewImage(url)}
                                              className="w-10 h-10 rounded border border-gray-200 hover:border-indigo-500 transition-all hover:scale-110 overflow-hidden shadow-sm"
                                            >
                                              <img src={url} className="w-full h-full object-cover" alt="주문서" />
                                            </button>
                                            <span className="text-[8px] font-black text-gray-400">주문서</span>
                                          </div>
                                        ))}
                                        {s.reviewProofImage?.split(',').map((url, idx) => (
                                          <div key={`review-${idx}`} className="flex flex-col items-center gap-1">
                                            <button
                                              onClick={() => setPreviewImage(url)}
                                              className="w-10 h-10 rounded border border-orange-200 hover:border-orange-500 transition-all hover:scale-110 overflow-hidden shadow-sm"
                                            >
                                              <img src={url} className="w-full h-full object-cover" alt="후기" />
                                            </button>
                                            <span className="text-[8px] font-black text-orange-400">후기</span>
                                          </div>
                                        ))}
                                        {!s.proofImage && !s.reviewProofImage && <span className="text-gray-300 text-xs">없음</span>}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {/* 날짜별 총계 (하단) */}
                                <tr className="bg-orange-50/30 border-b border-orange-100/50">
                                  <td colSpan={5} className="px-6 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{date} 일일 총계:</span>
                                      <span className="text-sm font-black text-orange-600">{items.length}건</span>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 이미지 미리보기 모달 */}
                {previewImage && (
                  <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                  >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-xl font-bold z-10"
                      >
                        ✕
                      </button>
                      <img src={previewImage} className="max-w-full max-h-[85vh] object-contain" alt="미리보기" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
            {showSuccess ? (
              <>
                <div className="bg-white p-12 rounded-[40px] text-center space-y-6 shadow-2xl border-4 border-blue-50">
                  <div className="text-7xl animate-bounce">✅</div>
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black text-gray-900">제출 완료!</h2>

                    {lastSubmittedType === 'apply' ? (
                      <div className="space-y-3">
                        <p className="text-2xl font-black text-blue-600 leading-tight">감사합니다.<br />후기때 뵈어요!</p>
                        <p className="text-gray-500 font-medium">신청 내역이 정상적으로 접수되었습니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xl text-gray-600 font-bold leading-tight text-center">후기 인증이 정상 접수되었습니다.<br />빠르게 확인해 드릴게요!</p>
                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mt-6 shadow-inner text-center">
                          <p className="text-blue-700 font-black text-lg leading-relaxed">입금 예정 시간 안내</p>
                          <p className="text-blue-600 font-bold mt-2">
                            영업일 오후 3~5시 사이 입금 진행<br />
                            <span className="text-sm opacity-80">(토/일/공휴일 제외)</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={resetCustomerFlow} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all active:scale-95 shadow-xl">처음으로 돌아가기</button>
              </>
            ) : customerView === 'landing' ? (
              <div className="space-y-6 pt-6">
                <header className="text-center space-y-4">
                  <div className="inline-block px-4 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">체험단 포털</div>
                  <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-none">미션 허브</h1>
                  <p className="text-gray-400 text-base font-bold">참여하실 단계를 선택해 주세요.</p>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <button onClick={() => setCustomerView('apply')} className="group bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-blue-600 shadow-lg transition-all text-left space-y-4 hover:-translate-y-1">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">🛍️</div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-800">신청하기</h3>
                      <p className="text-blue-600 text-xs font-black">체험단 신청하기</p>
                    </div>
                  </button>
                  <button onClick={() => setCustomerView('review')} className="group bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-orange-500 shadow-lg transition-all text-left space-y-4 hover:-translate-y-1">
                    <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-sm">⭐</div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-800">후기 인증</h3>
                      <p className="text-orange-500 text-xs font-black">리뷰 작성 후 캡쳐본 제출</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : customerView === 'apply' ? (
              <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <button
                  onClick={() => selectedProductId ? setSelectedProductId(null) : setCustomerView('landing')}
                  className="text-sm font-black text-gray-400 flex items-center gap-1 hover:text-gray-900 transition-colors"
                >
                  ← 뒤로가기
                </button>
                {!selectedProductId ? (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black mb-4">참여할 미션 선택</h2>
                    {products.length === 0 ? (
                      <div className="bg-white p-16 rounded-[40px] text-center text-gray-400 font-black border-2 border-dashed border-gray-100 shadow-inner">
                        <span className="block text-4xl mb-4">🔍</span>
                        현재 등록된 미션 상품이 없습니다.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {products.map(p => (
                          <button key={p.id} onClick={() => setSelectedProductId(p.id)} className="bg-white p-5 rounded-[24px] shadow-sm border-2 border-transparent hover:border-blue-600 flex items-center gap-4 transition-all group hover:shadow-md">
                            <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                              {p.thumbnail ? <img src={p.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                            </div>
                            <div className="text-left flex-grow space-y-0.5">
                              <div className="font-black text-lg text-gray-800 leading-none">{p.name}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-black text-lg">{p.refundAmount.toLocaleString()}원 환급</span>
                                <span className="text-gray-300 text-base font-bold">|</span>
                                <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">잔여: {p.remainingQuota}개</span>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <span className="font-bold text-sm">→</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-xl space-y-8">
                    <div className="space-y-8">
                      {/* 1단계: 가이드 확인 */}
                      <div className="space-y-4">
                        <div className="w-full bg-indigo-600 p-5 rounded-[24px] shadow-md flex items-center justify-center text-center">
                          <div className="space-y-1">
                            <span className="text-2xl block">📖</span>
                            <span className="text-lg font-black text-white block">1단계: 가이드를 읽어주세요</span>
                            <span className="text-xs font-bold text-indigo-100 block opacity-80">안내 문구를 꼭 확인해 주세요.</span>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-start">
                          <div className="w-full md:w-1/2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-2 flex items-center justify-center">
                            {selectedProduct?.thumbnail ? (
                              <img src={selectedProduct.thumbnail} className="w-full h-auto max-h-[250px] object-contain rounded-xl" alt="Product" />
                            ) : (
                              <div className="aspect-square flex items-center justify-center text-4xl">📦</div>
                            )}
                          </div>
                          <div className="w-full md:w-1/2 bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex flex-col self-stretch shadow-inner">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">💡</span>
                              <h4 className="font-black text-indigo-900 uppercase text-[10px] tracking-widest">미션 안내</h4>
                            </div>
                            <div className="flex-grow bg-white/60 p-4 rounded-xl border border-indigo-100 overflow-y-auto">
                              <p className="text-indigo-800 font-bold text-xs leading-relaxed whitespace-pre-wrap">
                                {selectedProduct?.guideText || "등록된 가이드 문구가 없습니다."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2단계: 구매인증샷 업로드 */}
                      <div className="space-y-4">
                        <div className="w-full bg-blue-600 p-5 rounded-[24px] shadow-md flex items-center justify-center text-center">
                          <div className="space-y-1">
                            <span className="text-2xl block">📸</span>
                            <span className="text-lg font-black text-white block">2단계: 구매인증샷을 올려주세요</span>
                            <span className="text-xs font-black text-yellow-300 block bg-blue-700/50 py-1 px-3 rounded-lg border border-blue-400 mt-1">⚠️ 주문번호가 반드시 보여야 합니다!</span>
                          </div>
                        </div>

                        <div className="p-5 bg-blue-50 rounded-2xl space-y-4 shadow-inner border border-blue-100">
                          <label className="text-xs font-black text-blue-600 block uppercase tracking-widest border-l-4 border-blue-500 pl-2">구매 인증샷 업로드 (여러 장 가능)</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {customerForm.proofImages.map((img, idx) => (
                              <div key={idx} className="relative group aspect-square bg-white rounded-xl overflow-hidden border border-blue-200">
                                <img src={img} className="w-full h-full object-cover" alt={`Preview ${idx + 1}`} />
                                <button onClick={() => removeProofImage(idx)} className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs">✕</button>
                              </div>
                            ))}
                            <label className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${isSubmitting ? 'bg-gray-100 border-gray-200' : 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50'}`}>
                              <input type="file" multiple className="hidden" onChange={handleScreenshotUpload} disabled={isSubmitting} />
                              <div className="text-center text-blue-500">
                                <span className="text-2xl block">⭐</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">사진 추가</span>
                              </div>
                            </label>
                          </div>

                          {customerForm.proofImages.length > 0 && (
                            <div className="w-full bg-green-500 p-4 rounded-xl flex items-center justify-between shadow-md">
                              <div className="flex items-center gap-3 text-white">
                                <span className="text-base">✓</span>
                                <span className="text-sm font-black italic">인증샷 {customerForm.proofImages.length}장 확인</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3단계: 정보 입력하기 */}
                      {customerForm.proofImages.length > 0 && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                          <div className="w-full bg-indigo-600 p-5 rounded-[24px] shadow-md flex items-center justify-center text-center">
                            <div className="space-y-1">
                              <span className="text-2xl block">✍️</span>
                              <span className="text-lg font-black text-white block">3단계: 정보 입력하기</span>
                              <span className="text-xs font-bold text-indigo-100 block opacity-80 italic">환급을 받으실 정보입니다</span>
                            </div>
                          </div>

                          <div className="p-6 bg-white rounded-2xl border border-indigo-50 shadow-sm space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">카톡 닉네임</label>
                                <input type="text" placeholder="예: 홍길동" className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl border border-indigo-50 focus:border-indigo-600 outline-none placeholder:text-gray-300" value={customerForm.kakaoNick} onChange={e => setCustomerForm({ ...customerForm, kakaoNick: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">비상 연락망</label>
                                <input type="text" placeholder="01012345678" className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl border border-indigo-50 focus:border-indigo-600 outline-none placeholder:text-gray-300" value={customerForm.phoneNumber} onChange={e => setCustomerForm({ ...customerForm, phoneNumber: e.target.value })} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">환급 은행명</label>
                                <input type="text" placeholder="예: 국민은행" className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl border border-indigo-50 focus:border-indigo-600 outline-none placeholder:text-gray-300" value={customerForm.bankName} onChange={e => setCustomerForm({ ...customerForm, bankName: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">환급 예금주</label>
                                <input type="text" placeholder="예: 홍길동" className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl border border-indigo-50 focus:border-indigo-600 outline-none placeholder:text-gray-300" value={customerForm.accountHolder} onChange={e => setCustomerForm({ ...customerForm, accountHolder: e.target.value })} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-indigo-600 block uppercase tracking-widest">환급 계좌번호</label>
                              <input type="text" placeholder="숫자만 입력" className="w-full p-4 bg-gray-50 rounded-xl font-black text-xl border border-indigo-50 focus:border-indigo-600 outline-none placeholder:text-gray-300" value={customerForm.accountNumber} onChange={e => setCustomerForm({ ...customerForm, accountNumber: e.target.value })} />
                            </div>
                            <div className="pt-2">
                              <button onClick={handleApplyFinalSubmit} disabled={isSubmitting} className="w-full py-5 bg-black text-white rounded-xl text-lg font-black hover:bg-gray-800 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 disabled:opacity-50">
                                {isSubmitting ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> 제출 중...</> : "최종 제출하기"}
                              </button>
                              <p className="text-center text-[10px] text-gray-400 font-bold mt-3 uppercase">최종 제출 버튼을 눌러 신청을 완료해 주세요</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <button
                  onClick={() => setCustomerView('landing')}
                  className="text-sm font-black text-gray-400 flex items-center gap-1 hover:text-gray-900 transition-colors"
                >
                  ← 뒤로가기
                </button>
                <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-xl space-y-8 border-t-4 border-orange-500">
                  <div className="space-y-8">
                    {/* 1단계: 정보 확인 */}
                    <div className="space-y-4">
                      <div className="w-full bg-orange-600 p-5 rounded-[24px] shadow-md flex items-center justify-center text-center">
                        <div className="space-y-1">
                          <span className="text-2xl block">📝</span>
                          <span className="text-lg font-black text-white block">1단계: 정보 확인</span>
                          <span className="text-xs font-bold text-orange-100 block opacity-80 italic">확인을 위해 정보를 입력해 주세요</span>
                        </div>
                      </div>

                      <div className="p-6 bg-orange-50 rounded-2xl space-y-4 shadow-inner border border-orange-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-orange-600 block mb-1 uppercase tracking-widest">카톡 닉네임</label>
                            <input
                              type="text"
                              placeholder="예: 홍길동"
                              className="w-full p-4 bg-white rounded-xl font-black text-xl border border-orange-100 focus:border-orange-600 outline-none shadow-sm placeholder:text-gray-300"
                              value={reviewForm.kakaoNick}
                              onChange={e => setReviewForm({ ...reviewForm, kakaoNick: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-orange-600 block mb-1 uppercase tracking-widest">비상 연락망</label>
                            <input
                              type="text"
                              placeholder="01012345678"
                              className="w-full p-4 bg-white rounded-xl font-black text-xl border border-orange-100 focus:border-orange-600 outline-none shadow-sm placeholder:text-gray-300"
                              value={reviewForm.phoneNumber}
                              onChange={e => setReviewForm({ ...reviewForm, phoneNumber: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 전역 후기 가이드 상시 노출 */}
                    {globalSettings.reviewGuideText && (
                      <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="w-full bg-orange-100 p-5 rounded-[24px] border border-orange-200 shadow-sm flex items-center gap-4">
                          <span className="text-2xl">💡</span>
                          <div className="text-left">
                            <h4 className="font-black text-orange-900 uppercase text-[10px] tracking-widest mb-1">후기 작성 가이드</h4>
                            <p className="text-orange-800 font-bold text-xs whitespace-pre-wrap leading-relaxed">{globalSettings.reviewGuideText}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2단계: 인증샷 업로드 */}
                    {reviewForm.kakaoNick && reviewForm.phoneNumber && (
                      <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="w-full bg-orange-600 p-5 rounded-[24px] shadow-md flex items-center justify-center text-center">
                          <div className="space-y-1">
                            <span className="text-2xl block">📸</span>
                            <span className="text-lg font-black text-white block">2단계: 인증샷 업로드</span>
                            <span className="text-xs font-bold text-orange-100 block opacity-80 italic">환급을 위해 캡처본을 올려주세요</span>
                          </div>
                        </div>

                        <div className="p-6 bg-orange-50 rounded-2xl space-y-6 shadow-inner border border-orange-100">
                          <div className="space-y-4">
                            <label className="text-xs font-black text-orange-600 block uppercase tracking-widest border-l-4 border-orange-500 pl-2">인증샷 업로드 (총 2장 필수)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-gray-500 ml-1 leading-tight">
                                  1. 주문서 캡처<br />
                                  <span className="text-red-500 font-bold">(주문번호가 보여야만 환급이 가능합니다)</span>
                                </div>
                                <label className={`relative aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${reviewForm.reviewImages[0] ? 'border-orange-500 bg-white' : 'border-orange-200 bg-white hover:border-orange-400 hover:bg-orange-50'}`}>
                                  <input type="file" className="hidden" onChange={(e) => handleReviewImageUpload(e, 0)} disabled={isSubmitting} />
                                  {reviewForm.reviewImages[0] ? (
                                    <img src={reviewForm.reviewImages[0]} className="w-full h-full object-cover" alt="Preview 1" />
                                  ) : (
                                    <div className="text-center group">
                                      <span className="text-2xl block mb-1">📄</span>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">주문서 업로드</span>
                                    </div>
                                  )}
                                </label>
                              </div>
                              <div className="space-y-2">
                                <div className="text-[10px] font-black text-gray-500 ml-1 leading-tight">
                                  2. 후기 캡처<br />
                                  <span className="text-orange-600 font-bold">(1장만 올려주세요. 내용 잘려도 됩니다)</span>
                                </div>
                                <label className={`relative aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${reviewForm.reviewImages[1] ? 'border-orange-500 bg-white' : 'border-orange-200 bg-white hover:border-orange-400 hover:bg-orange-50'}`}>
                                  <input type="file" className="hidden" onChange={(e) => handleReviewImageUpload(e, 1)} disabled={isSubmitting} />
                                  {reviewForm.reviewImages[1] ? (
                                    <img src={reviewForm.reviewImages[1]} className="w-full h-full object-cover" alt="Preview 2" />
                                  ) : (
                                    <div className="text-center group">
                                      <span className="text-2xl block mb-1">⭐</span>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">후기 업로드</span>
                                    </div>
                                  )}
                                </label>
                              </div>
                            </div>
                          </div>

                          {reviewForm.reviewImages.filter(img => !!img).length === 2 && (
                            <div className="pt-4 space-y-4 animate-in fade-in zoom-in duration-500">
                              <div className="w-full bg-green-500 p-4 rounded-xl flex items-center justify-center shadow-md">
                                <div className="flex items-center gap-2 text-white">
                                  <span className="text-base">✓</span>
                                  <span className="text-sm font-black italic">모든 인증 정보 준비완료!</span>
                                </div>
                              </div>
                              <button
                                onClick={handleReviewFinalSubmit}
                                disabled={isSubmitting}
                                className="w-full py-5 bg-black text-white rounded-xl text-lg font-black hover:bg-gray-800 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                              >
                                {isSubmitting ? (
                                  <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    제출 중...
                                  </>
                                ) : "최종 제출하기"}
                              </button>
                              <p className="text-center text-[10px] text-gray-400 font-bold mt-2 uppercase">최종 제출 버튼을 눌러 제출을 완료해 주세요</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
